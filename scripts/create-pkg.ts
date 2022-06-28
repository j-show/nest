/* eslint-disable no-restricted-globals */
import fs from 'fs';
import path from 'path';
import yargs from 'yargs';

import { packagesFullPath, readPackageJson } from './build';
import { copyFiles, exists, mkdirp, run } from './helper';

type Arguments = yargs.Arguments & {
  readonly _: string[];
  readonly desc?: string;
  readonly force?: boolean;
};

if (require.main === module) {
  const argv = yargs
    .strict()
    .alias('d', 'desc')
    .option('desc', {
      type: 'string',
      nargs: 1,
      demandOption: false,
      describe: 'Package description',
    })
    .alias('f', 'force')
    .option('force', {
      type: 'boolean',
      nargs: 0,
      demandOption: false,
      describe: 'Should ignore exists or not',
    })
    .help('h')
    .alias('h', 'help')
    .parse();

  const { _, desc, force } = argv as Arguments;
  const name = (_[0] || '').toString();

  run(async () => {
    return await main({ name, desc, force });
  });
}

interface MainOptions {
  readonly name: string;
  readonly desc?: string;
  readonly force?: boolean;
}

async function main(options: MainOptions) {
  const { name, desc, force } = options;

  if (!name || /^\d+$/.test(name)) {
    return console.info('package name cannot be empty or purely numeric');
  }

  if (/[\^/\\]/.test(name)) {
    return console.info(`pacakge name cannot contain '^', '\\', '/'`);
  }

  const fileNames = (await fs.promises.readdir(packagesFullPath)).filter((x) => !['.DS_Store', '.', '..'].includes(x));
  const packageDirPath = path.join(packagesFullPath, name);
  const packageVersion = new Map<string, string>();

  await Promise.all(
    fileNames.map(async (fileName) => {
      const packageDirName = path.join(packagesFullPath, fileName);
      const stat = await fs.promises.stat(packageDirName);
      if (!stat.isDirectory()) return;

      const packageJsonPath = path.join(packageDirName, 'package.json');
      if (!(await exists(packageJsonPath))) return;

      const { version } = readPackageJson(require(packageJsonPath));

      packageVersion.set(fileName, version);
    }),
  );

  if (packageVersion.has(name)) {
    if (!force) {
      return console.info(`package ${name} already exists, cannot create`);
    }
  }

  await mkdirp(packageDirPath);

  const templateDirPath = path.join(__dirname, '../template');
  await copyFiles(templateDirPath, packageDirPath, { deep: true, allFile: true });

  const packageJsonPath = path.join(packageDirPath, 'package.json');
  if (!(await exists(packageJsonPath))) return;

  let packageJsonData = await fs.promises.readFile(packageJsonPath, 'utf8');
  packageJsonData = packageJsonData.replace(/\{name\}/g, name).replace(/\{description\}/g, desc || `jShow ${name}`);

  for (const [packageName, version] of packageVersion) {
    packageJsonData = packageJsonData.replace(new RegExp(`{${packageName}}`, 'g'), version);
  }

  await fs.promises.writeFile(packageJsonPath, packageJsonData);
}
