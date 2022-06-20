/* eslint-disable no-restricted-globals */
import yargs from 'yargs';

import { tsBuild } from './build';
import { run } from './helper';

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
