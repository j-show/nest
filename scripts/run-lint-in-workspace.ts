/* eslint-disable no-restricted-globals */
import path from 'path';
import yargs from 'yargs';

import { exec, exists, run } from './helper';

if (require.main === module) {
  run(main);
}

async function main() {
  const rootPath = path.join(__dirname, '..');
  const argvs = (yargs.argv as { _: string[] })._;
  for (const fullFilePath of argvs) {
    const relativeFilePath = fullFilePath.replace(rootPath, '');

    let tslintJson = 'tslint.json';

    const match = relativeFilePath.match(/packages\/(.*?)\//);
    if (match) {
      const packagePath = path.join(rootPath, 'packages', match[1]);
      const localTslintJson = path.join(packagePath, 'tslint.json');
      const stat = await exists(localTslintJson);
      if (stat) tslintJson = localTslintJson.replace(rootPath + '/', '');
    }

    const cmd = `node --stack_size=8192 --max-old-space-size=8192 ./node_modules/.bin/tslint -c ${tslintJson} -p tsconfig.json --fix ${fullFilePath}`;
    console.info(`run: ${cmd}`);
    await exec(cmd);
  }
}
