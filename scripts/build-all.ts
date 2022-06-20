/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable no-restricted-globals */
/**
 * 根据包之间依赖关系, 按照拓扑排序 build
 */
import chalk, { Chalk } from 'chalk';
import fs from 'fs';
import os from 'os';
import path from 'path';
import yargs from 'yargs';

import {
  cacheFullPath,
  filterTopologicalSorting,
  packagesFullPath,
  readPackageCache,
  readPackageJson,
  resolveRelevantChanges,
  resolveTopologicalSorting,
  StringStringMap,
  updatePackageCache,
} from './build';
import {
  Concurrent,
  createEmptyError,
  createExternalPromise,
  createStringError,
  exec,
  exists,
  ExternalPromise,
  logError,
  mkdirp,
  run,
  Screen,
} from './helper';

type Arguments = yargs.Arguments & {
  readonly concurrent?: number;
  readonly force?: boolean;
  readonly includePackageJson?: boolean;
  readonly tsc?: boolean;
  readonly clear?: boolean;
};

export const DEFAULT_CONCURRENCY = Math.max(1, Math.floor(os.cpus().length / 4));

if (require.main === module) {
  const argv = yargs
    .strict()
    .alias('c', 'concurrent')
    .option('concurrent', {
      type: 'number',
      nargs: 1,
      demandOption: false,
      describe: 'How many builds are allowed to run simultaneously. Non-positive value will be treated as Infinity',
    })
    .alias('f', 'force')
    .option('force', {
      type: 'boolean',
      nargs: 0,
      demandOption: false,
      describe: 'Should ignore cache or not',
    })
    .option('clear', {
      type: 'boolean',
      nargs: 0,
      demandOption: false,
      describe: 'Should clear cache or not',
    })
    .alias('p', 'include-package-json')
    .option('include-package-json', {
      type: 'boolean',
      nargs: 0,
      demandOption: false,
      describe:
        'Should take package.json into consideration or not. If true, changes of package.json will trigger build',
    })
    .alias('t', 'tsc')
    .option('tsc', {
      type: 'boolean',
      nargs: 0,
      demandOption: false,
      describe: 'Should run tsc for unchanged relevant packages',
    })
    .help('h')
    .alias('h', 'help')
    .parse();

  const { concurrent, force, clear, includePackageJson, tsc } = argv as Arguments;

  run(async () => {
    const screen = new Screen();
    screen.renderInterval = 200;
    try {
      return await main({ screen, concurrent, force, clear, includePackageJson, tsc });
    } finally {
      screen.destroy();
    }
  });
}

interface MainOptions {
  readonly screen?: Screen;
  readonly concurrent?: number;
  readonly force?: boolean;
  readonly clear?: boolean;
  readonly includePackageJson?: boolean;
  readonly tsc?: boolean;
  readonly stdin?: NodeJS.ReadStream;
  readonly stdout?: NodeJS.WriteStream;
  readonly stderr?: NodeJS.WriteStream;
}

async function main(options: MainOptions) {
  const { screen, force, includePackageJson, tsc } = options;

  const concurrency = (() => {
    const value = Number(options.concurrent);
    return Number.isNaN(value) ? DEFAULT_CONCURRENCY : value > 0 ? value : Infinity;
  })();

  const fileNames = (await fs.promises.readdir(packagesFullPath)).filter((x) => !x.match(/^\./));

  const packageDeps = new Map<string, Set<string>>();
  const packageScripts = new Map<string, StringStringMap>();

  await Promise.all(
    fileNames.map(async (fileName) => {
      const packageDirName = path.join(packagesFullPath, fileName);
      const stat = await fs.promises.stat(packageDirName);
      if (!stat.isDirectory()) return;
      const packageJsonPath = path.join(packageDirName, 'package.json');
      if (!(await exists(packageJsonPath))) {
        return console.info(`file ${JSON.stringify(`packages/${fileName}/package.json`)} is not found, skipped`);
      }

      const { deps, scripts } = readPackageJson(require(packageJsonPath));

      packageDeps.set(fileName, deps);
      packageScripts.set(fileName, scripts);
    }),
  );

  if (!packageDeps.size) return;

  filterTopologicalSorting(packageDeps);

  const topologicalSorting = Array.from(resolveTopologicalSorting(packageDeps)).filter((x) => {
    const scripts = packageScripts.get(x) as StringStringMap;
    return scripts.build;
  });

  if (!topologicalSorting.length) return;

  console.info(chalk.cyan('Packages will be built in following order:'));
  console.info();

  for (const packageName of topologicalSorting) {
    console.info(`  ${packageName}`);
  }

  console.info();

  if (options.clear) {
    await exec(`rm -rf ${JSON.stringify(cacheFullPath)}`);
  }

  const changedPackages = new Set<string>(topologicalSorting);
  const skippedPackages = new Set<string>();

  await mkdirp(cacheFullPath);

  if (!force) {
    await Promise.all(
      topologicalSorting.map(async (packageName) => {
        const ret = await readPackageCache(packageName);
        if (!ret) return;

        const { cache, srcHash, buildHash, packageJsonHash } = ret;

        if (
          cache.srcMd5 === srcHash &&
          cache.filesMd5 === buildHash &&
          (!includePackageJson || cache.packageJsonMd5 === packageJsonHash)
        ) {
          skippedPackages.add(packageName);
          changedPackages.delete(packageName);
        }
      }),
    );
  }

  const relevantChanges = resolveRelevantChanges(packageDeps, changedPackages);

  const successfulBuilds = new Set<string>();
  const executedBuilds = new Set<string>();
  const failedBuilds = new Set<string>();
  const errors = new Map<string, unknown>();
  const builds = new Map<string, ExternalPromise<void>>(
    topologicalSorting.map((packageName) => [packageName, createExternalPromise<void>()] as const),
  );

  const concurrent = new Concurrent(concurrency);

  if (screen && topologicalSorting.length > skippedPackages.size) {
    {
      const line = screen.createLine();
      line.content = '='.repeat(process.stdout.columns || 40);
    }
    const triggerStatus = createStatusTrigger();
    triggerStatus();
    concurrent.events.on('done', () => {
      triggerStatus();
    });
  }

  const triggerProgress = createProgressRenderer();

  topologicalSorting.forEach((packageName, i) => {
    const { resolve, reject } = builds.get(packageName) as ExternalPromise<void>;
    buildPackage(packageName, i).then(resolve, reject);
  });

  await Promise.all(Array.from(builds.values()).map((x) => x.promise));

  if (errors.size) {
    console.error(chalk.red(`The following packages failed to build:`));
    for (const [packageName, error] of errors) {
      console.error();
      console.error(chalk.bgRed(`[${packageName}]`));
      console.error();
      logError(error);
      console.error();
    }
    throw createEmptyError();
  }

  async function buildPackage(packageName: string, _i: number) {
    let success = false;

    try {
      const commonMsg = `[${packageName}]`;
      const commonHighlightMsg = `[${chalk.cyan(packageName)}]`;

      const deps = packageDeps.get(packageName) || new Set();
      if (deps.size) {
        await Promise.all(Array.from(deps).map((dep) => builds.get(dep)!.promise));
      }

      let execution = `yarn build`;

      if (skippedPackages.has(packageName)) {
        let shouldExecute = false;
        if (tsc) {
          const changedDeps = relevantChanges.get(packageName);
          if (changedDeps) {
            const tscScript = packageScripts.get(packageName)!.tsc;
            if (tscScript) {
              shouldExecute = true;
              execution = 'yarn tsc';
            } else {
              success = true;
              console.info(`${commonMsg} ${chalk.yellow(`no stript found, skip tsc`)}`);
              return;
            }
          }
        }
        if (!shouldExecute) {
          success = true;
          console.info(chalk.grey(`${commonMsg} hit cache, skip building`));
          return;
        }
      }

      const failedUpstream = Array.from(deps).filter((x) => failedBuilds.has(x));
      if (failedUpstream.length) {
        throw createStringError(
          `failed due to failures of upstream ${failedUpstream.map((x) => chalk.yellow(x)).join(', ')}`,
        );
      }

      await concurrent.run(async () => {
        executedBuilds.add(packageName);
        triggerProgress();

        const cmd = `cd packages/${packageName} && ${execution}`;
        console.info(`${commonHighlightMsg} ${cmd}`);

        const t0 = Date.now();
        await exec(cmd);
        const t1 = Date.now();

        console.info(`${commonHighlightMsg} done in ${chalk.green(((t1 - t0) / 1000).toFixed(1))}s`);

        success = true;

        const ok = updatePackageCache(packageName);
        if (!ok) {
          console.info(chalk.yellow(`${commonMsg} unable to cache`));
        }
      });
    } catch (e) {
      errors.set(packageName, e);
    } finally {
      if (success) {
        successfulBuilds.add(packageName);
      } else {
        failedBuilds.add(packageName);
      }
      triggerProgress();
    }
  }

  function createStatusTrigger() {
    if (screen) {
      const line = screen.createLine();
      return function trigger() {
        const current = Math.max(0, concurrent.executed - concurrent.count - skippedPackages.size);
        const total = Math.max(1, topologicalSorting.length - skippedPackages.size);
        const percent = current / total;
        line.content = `${(percent * 100).toFixed(2)}% (${current} / ${total})  concurrency: ${concurrency}`;
      };
    }
    return () => {};
  }

  function createProgressRenderer() {
    if (screen) {
      const packagesToBuild = topologicalSorting.filter(
        (x) => changedPackages.has(x) || (tsc && relevantChanges.has(x)),
      );
      const maxPackageNameLength = Math.max(...packagesToBuild.map((x) => x.length));
      const line = screen.createLine();
      const gap = '  ';

      return function render() {
        const width = process.stdout.columns || 100;
        const columns = Math.max(1, Math.floor(width / (maxPackageNameLength + gap.length)));
        const rows = Math.ceil(packagesToBuild.length / columns);
        const lines: string[] = [];
        let i = 0;
        for (let row = 0; row < rows; row++) {
          const blocks: string[] = [];
          for (let col = 0; col < columns; col++) {
            const packageName = packagesToBuild[i];
            const color: keyof Chalk | '' = successfulBuilds.has(packageName)
              ? 'grey'
              : failedBuilds.has(packageName)
              ? executedBuilds.has(packageName)
                ? 'redBright'
                : 'red'
              : executedBuilds.has(packageName)
              ? skippedPackages.has(packageName)
                ? 'green'
                : 'cyan'
              : '';
            const pad = ' '.repeat(maxPackageNameLength - packageName.length);
            const str = color ? chalk[color](packageName) : packageName;
            blocks.push(`${str}${pad}`);
            i++;
            if (i >= packagesToBuild.length) break;
          }
          lines.push(blocks.join(gap));
        }
        line.content = lines.join('\n');
      };
    }
    return () => {};
  }
}
