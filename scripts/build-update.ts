/* eslint-disable no-restricted-globals */
/**
 * 更新单个包的缓存
 */
import path from 'path';
import yargs from 'yargs';

import { packagesFullPath, updatePackageCache } from './build';
import { exists, run } from './helper';

if (require.main === module) {
  run(main);
}

async function main() {
  const packageName = (yargs.argv as { _: string[] })._[0] || '';
  if (!packageName) return;
  const fullPackagePath = path.join(packagesFullPath, packageName);
  if (!(await exists(fullPackagePath))) {
    throw new Error(`package ${JSON.stringify(packageName)} doesn't exist`);
  }
  await updatePackageCache(packageName);
}
