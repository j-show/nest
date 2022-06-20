/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-restricted-globals */
import { times } from 'lodash';
import path from 'path';
import { CompilerOptions } from 'typescript';
import yargs from 'yargs';

import { exec, execSafe, readTsConfigFile, run } from '../helper';

const TEMP_DIR_NAME = 'tmp';

type Arguments = yargs.Arguments & {
  readonly _: string[];
  readonly dry?: boolean;
  readonly verbose?: boolean;
};

if (require.main === module) {
  const argv = yargs
    .strict()
    .option('dry', {
      type: 'boolean',
      nargs: 0,
      demandOption: false,
      describe: 'dry run',
    })
    .option('verbose', {
      type: 'boolean',
      nargs: 0,
      demandOption: false,
      describe: 'verbose',
    })
    .help('h')
    .alias('h', 'help')
    .parse();

  const { dry, verbose, _: tsconfigList } = argv as Arguments;

  run(() =>
    tsBuild({
      tsconfigList,
      dry,
      verbose,
    }),
  );
}

export interface MainOptions {
  readonly tsconfigList: readonly string[];
  readonly dry?: boolean;
  readonly verbose?: boolean;
  readonly beforeBuild?: () => unknown;
  readonly onBuild?: () => unknown;
  readonly afterBuild?: (data: ReadonlyDeep<Extract<ReturnType<typeof getCommands>, {}>>) => unknown;
}

export async function tsBuild(options: MainOptions) {
  const ret = getCommands(options.tsconfigList);
  if (!ret) {
    throw new Error(`No tsconfig input is provided`);
  }
  const { removeCommand, buildCommands, cleanupCommands, finalCleanupCommand } = ret;

  const dry = Boolean(options.dry);
  const verbose = Boolean(options.verbose);

  if (verbose) {
    console.info('The following commands will be executed');
    console.info();
  }

  if (dry) return;

  if (verbose) console.info(`  ${removeCommand}`);
  await exec(removeCommand);

  try {
    if (typeof options.beforeBuild === 'function') await options.beforeBuild();

    await Promise.all([
      typeof options.onBuild === 'function' ? options.onBuild() : void 0,
      Promise.all(
        buildCommands.map((command) => {
          if (verbose) console.info(`  ${command}`);
          return exec(command);
        }),
      ),
    ]);

    if (typeof options.afterBuild === 'function') await options.afterBuild(ret);

    await Promise.all(
      cleanupCommands.map((command) => {
        if (verbose) console.info(`  ${command}`);
        return execSafe(command).promise;
      }),
    );
  } finally {
    if (verbose) console.info(`  ${finalCleanupCommand}`);
    await execSafe(finalCleanupCommand).promise;
    if (verbose) console.info();
  }
}

export function getCommands(list: readonly string[]) {
  const cwd = process.cwd();
  const tsconfigFullPathList = list.map((fullPath) => path.resolve(cwd, fullPath));
  if (!tsconfigFullPathList.length) return;

  const tsconfigList = tsconfigFullPathList.map((fullPath) => ensureOutDir(readTsConfigFile(fullPath, cwd), fullPath));
  const tmpDir = getTempDirPrefix(tsconfigList.map((x) => x.outDir));
  const tmpFullPath = path.relative(cwd, tmpDir);

  const removeCommand = `rm -rf ${tmpFullPath}`;

  const buildCommands = times(tsconfigList.length, (i) => {
    const compiler = resolveDefaultCompiler(tsconfigList[i]);
    const relativePath = path.relative(cwd, tsconfigFullPathList[i]);

    return `${compiler} --pretty -p ${relativePath}`;
  });

  const targets = times(tsconfigList.length, (i) => {
    const { outDir } = tsconfigList[i];
    const sourcePath = path.relative(cwd, outDir);
    const targetPath = path.relative(cwd, outDir.slice(tmpDir.length + 1));
    return { sourcePath, targetPath };
  });

  const cleanupCommands = targets.map((item) => {
    const { sourcePath, targetPath } = item;
    return `rm -rf ${targetPath} && mv ${sourcePath} ${targetPath}`;
  });

  const finalCleanupCommand = removeCommand;

  return {
    tmpDir,
    tmpFullPath,
    targets,
    removeCommand,
    buildCommands,
    cleanupCommands,
    finalCleanupCommand,
    tsconfigFullPathList,
  };
}

function getTempDirPrefix(outputDirList: string[]) {
  if (!outputDirList.length) return '';
  const firstItem = outputDirList[0];
  const locator = `/${TEMP_DIR_NAME}/`;
  const tmpPos = firstItem.indexOf(locator);
  if (tmpPos < 0) throw new Error(`No "${locator}" found in ${JSON.stringify(firstItem)}`);

  const prefix = firstItem.slice(0, tmpPos + locator.length);
  for (let i = 1; i < outputDirList.length; i++) {
    if (outputDirList[i].slice(0, prefix.length) !== prefix) {
      throw new Error(`Path ${JSON.stringify(outputDirList[i])} doesn't match prefix ${JSON.stringify(prefix)}`);
    }
  }

  return prefix.slice(0, -1);
}

function ensureOutDir(config: CompilerOptions, fileName: string): CompilerOptions & { outDir: string } {
  if (typeof config.outDir !== 'string') {
    throw new Error(`"outDir" doesn't exist in tsconfig file ${JSON.stringify(fileName)}`);
  }
  return {
    ...config,
    outDir: config.outDir,
  };
}

function resolveDefaultCompiler(tsconfig: CompilerOptions) {
  const { plugins } = tsconfig;
  if (Array.isArray(plugins)) {
    for (const plugin of plugins) {
      if (plugin && typeof plugin === 'object' && 'transform' in plugin) {
        return 'ttsc';
      }
    }
  }
  return 'tsc';
}

/** Object types that should never be mapped */
type AtomicObject =
  | Function
  | Map<unknown, unknown>
  | WeakMap<any, any>
  | Set<any>
  | WeakSet<any>
  | Promise<any>
  | Date
  | RegExp
  | boolean
  | number
  | string;

type ReadonlyDeep<T> = T extends AtomicObject
  ? T
  : T extends object
  ? { readonly [K in keyof T]: ReadonlyDeep<T[K]> }
  : T;
