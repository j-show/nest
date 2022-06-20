/* eslint-disable no-restricted-globals */
import path from 'path';
import { readdirAsync } from 'readdir-enhanced';

import { tsBuild } from './build';
import { copyFiles, exec, run } from './helper';

if (require.main === module) {
  run(main);
}

async function main() {
  let files: string[] = [];

  const cwd = process.cwd();
  const src = path.join(cwd, './src');

  await exec('rm -rf ./lib');
  await exec('rm -rf ./lib-es');

  await tsBuild({
    tsconfigList: [path.join(cwd, './tsconfig.build.json'), path.join(cwd, './tsconfig.build.es.json')],
    async onBuild() {
      files = await readdirAsync(src, { deep: true, filter: (stats) => stats.isFile() });
    },
    async afterBuild() {
      const filesToCopy = files.filter((x) => path.basename(x).match(/\.js$/));
      await Promise.all([
        copyFiles(src, path.resolve(cwd, 'tmp/lib'), { files: filesToCopy }),
        copyFiles(src, path.resolve(cwd, 'tmp/lib-es'), { files: filesToCopy }),
      ]);
    },
  });
}
