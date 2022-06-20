/* eslint-disable no-restricted-globals */
import fs from 'fs';
import { fromPairs, sortBy, toPairs } from 'lodash';
import path from 'path';
import yargs from 'yargs';

import {
  dependencyKeys,
  PackageJson,
  packagesFullPath,
  POSSIBLE_SOURCE_FOLDER_NAME,
  readPackageJson,
  scope,
} from './build';
import { aggregateDeps, exists, filterAsync, getDirectories, predicate, run } from './helper';

if (require.main === module) {
  const argv = yargs
    .strict()
    .parserConfiguration({ 'boolean-negation': false })
    .option('checkOnly', {
      type: 'boolean',
      nargs: 0,
      demandOption: false,
      describe: 'only execute validation',
    })
    .help('h')
    .alias('h', 'help')
    .parse();

  const { checkOnly } = argv as { checkOnly: boolean };

  Promise.resolve().then(() => run(() => main({ checkOnly })));
}

async function main(options: { readonly checkOnly?: boolean }) {
  const checkOnly = Boolean(options?.checkOnly);

  // 扫描目录
  const allPackageNames = await filterAsync(
    filterAsync(getDirectories(packagesFullPath), (x) => !x.match(/^\./)),
    (packageName) => exists(path.join(packagesFullPath, packageName, 'package.json')),
  );

  // 读取package.json
  const packageJsonMap = fromPairs(
    allPackageNames.map((packageName) => {
      return [packageName, require(path.join(packagesFullPath, packageName, 'package.json')) as PackageJson];
    }),
  );

  // 读取 package.json 的依赖
  const packageDeps = new Map<string, Set<string>>();
  for (const packageName of allPackageNames) {
    const { deps } = readPackageJson(packageJsonMap[packageName]);
    packageDeps.set(packageName, deps);
  }

  // 从源代码读取引用关系
  const packageSourceDeps = new Map<string, Set<string>>();
  await Promise.all(
    allPackageNames.map(async (packageName) => {
      const sourceFullPathList = (
        await Promise.all(
          POSSIBLE_SOURCE_FOLDER_NAME.map(async (folderName) => {
            const fullPath = path.join(packagesFullPath, packageName, folderName);
            const isExisits = await exists(fullPath);
            if (isExisits) return fullPath;
          }),
        )
      ).filter(predicate);
      const allDepPaths = await aggregateDeps({ sourceFullPathList });
      const scopeDepNames = new Set<string>();
      for (const depPaths of allDepPaths) {
        const match = depPaths.match(new RegExp(`^${scope}/([^/]+?)(/.*?)?$`, 'i'));
        if (match) {
          const depName = match[1];
          if (depName !== packageName) {
            scopeDepNames.add(depName);
          }
        }
      }
      packageSourceDeps.set(packageName, scopeDepNames);
    }),
  );

  const changedPackages = new Set<string>();

  // 如果源代码中引用了, 但是未在 package.json 中显式引用, 抛出warning
  for (const [packageName, sourceDepNames] of packageSourceDeps) {
    const packageJsonDeps = packageDeps.get(packageName) as Set<string>;
    for (const depName of sourceDepNames) {
      if (packageJsonDeps.has(depName) || !packageJsonMap[depName]) continue;
      let key: typeof dependencyKeys[number] = 'dependencies';
      if (packageJsonMap[depName].private) {
        key = 'devDependencies';
      }
      const map = packageJsonMap[packageName][key] || (packageJsonMap[packageName][key] = {});
      map[`${scope}/${depName}`] = `^${packageJsonMap[depName].version}`;
      changedPackages.add(packageName);
    }
  }

  if (checkOnly) {
    if (changedPackages.size) {
      const msg = [
        `The following packages have implicit dependencies, you can run yarn dpes:fix to solve them: `,
        Array.from(changedPackages).join(', '),
      ].join('');
      throw new Error(msg);
    }
  } else {
    await Promise.all(
      Array.from(changedPackages).map(async (packageName) => {
        const packageJson = packageJsonMap[packageName];
        for (const key of dependencyKeys) {
          if (!packageJson[key]) continue;
          packageJson[key] = fromPairs(sortBy(toPairs(packageJson[key]), 0));
        }
        const fullPath = path.join(packagesFullPath, packageName, `package.json`);
        const json = JSON.stringify(packageJsonMap[packageName], null, 2);
        await fs.promises.writeFile(fullPath, json + '\n');
      }),
    );
  }
}
