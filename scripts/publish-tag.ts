/* eslint-disable no-restricted-globals */
import chalk from 'chalk';
import path from 'path';
import yargs from 'yargs';

import { createStringError, exec, existsSync, getCommitMessage, predicate, run } from './helper';

type Arguments = yargs.Arguments & {
  readonly _: string[];
};

if (require.main === module) {
  const argv = yargs.parse() as Arguments;

  run(async () => {
    return main(argv._[0]);
  });
}

async function main(tag: string) {
  const packageMessages = (await getCommitMessage(tag))
    .map((x) => (x.split('- ').at(-1) || '').trim())
    .filter(predicate);

  const packageNames = new Map<string, { relativePath: string; version: string }>();

  for (const msg of packageMessages) {
    const text = msg.split('/').at(-1);
    if (!text) continue;

    const [name, version] = text.split('@');
    if (!name || !version) continue;

    const item = {
      relativePath: path.relative(process.cwd(), path.join(__dirname, `../packages/${name}`)),
      version,
    };
    if (!existsSync(path.join(item.relativePath, 'package.json'))) continue;

    packageNames.set(`@jshow/${name}`, item);
  }

  if (packageNames.size < 1) {
    throw createStringError(`${chalk.redBright(`The tag(${tag}) does not contain the package to be published`)}\n\n`);
  }

  for (const [name, data] of packageNames) {
    console.info(chalk.blueBright(`=== Package ${name}@${data.version} publish ===`));
    await exec(`(cd ${data.relativePath} && npm publish --access public)`);
    console.info(chalk.blueBright(`=== publish done ===`));
    console.info();
  }
}
