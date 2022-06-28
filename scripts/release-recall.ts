import fs from 'fs';
import path from 'path';

import { scope } from './build';
import { confirm, exec, getCurrentBranchName, predicate } from './helper';
import { getSuffixByGitFlow } from './release';

~(async () => {
  const branchName = await getCurrentBranchName();
  const packageSuffix = getSuffixByGitFlow(branchName);
  if (!packageSuffix) {
    throw new Error('NOT ALLOWED');
  }

  await exec('git fetch --tags', { silent: true });

  const root = path.resolve(__dirname, '..');
  const packageNames = fs
    .readdirSync(`${root}/packages`)
    .map((name) => {
      if (name.startsWith('.')) return;
      if (!fs.existsSync(`${root}/packages/${name}/package.json`)) return;
      return name;
    })
    .filter(predicate);

  for (const packageName of packageNames) {
    console.info(' - [recall]', `${scope}/${packageName}${packageSuffix}@*`);
  }
  const ok = await confirm('Really? It can not be undo');
  if (!ok) return;

  await Promise.all(
    packageNames.map(async (packageName) => {
      const name = `${packageName}${packageSuffix}`;
      await exec(`npm unpublish @arkie/${name} --force --loglevel=error`).catch(
        (e) => void console.warn(`[${name}] unpublish failed: ${e.message}`),
      );

      const tagBase = `${scope}/${name}@`;
      const tags = await (async () => {
        const ret = await exec(`git tag | grep "${tagBase}"`, { silent: true }).catch(() => '');
        return ret
          .trim()
          .split(/[\r\n]+/)
          .filter(Boolean);
      })();
      await Promise.all(
        tags.map(async (tag) => {
          await exec(`git tag -d "${tag}"`).catch(
            (e) => void console.warn(`[${name}] untag (local) failed: ${e.message}`),
          );
          await exec(`git push -d origin "${tag}"`).catch(
            (e) => void console.warn(`[${name}] untag (remote) failed: ${e.message}`),
          );
        }),
      );
    }),
  );
})().then(
  () => {
    process.exit(0);
  },
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
