/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable no-restricted-globals */
const path = require('path');

module.exports = {
  extends: [path.resolve(__dirname, '../../.eslintrc.js')],
  root: true,
  env: {
    node: true,
  },
  parserOptions: {
    tsconfigRootDir: path.resolve(__dirname),
  },
  rules: {
    'simple-import-sort/imports': [
      'error',
      {
        groups: [['\\u0000'], ['^@nestjs', '^mongo', 'ioredis', '^@?[a-zA-Z]'], ['^@jshow/'], ['^\\.\\./'], ['^\\./']],
      },
    ],
  },
};
