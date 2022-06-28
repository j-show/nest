import fs from 'fs';
import { isString, omit } from 'lodash';
import moment from 'moment';
import path from 'path';

import { LoggerContext, LogLevel, stringify } from '@jshow/logger';

import { extractMessage } from '../utils';

let fileBulkQueue: string[] = [];
const fileUpdateInterval = 1000; // ms
const fileUpdateBulkSize = 100;

const wrtiteLogToFile = (content: string, dir: string) => {
  process.nextTick(async () => {
    await fs.promises.appendFile(path.resolve(dir, `app-${moment().format('YYYY-MM-DD')}.log`), content);
    fileBulkQueue = [];
  });
};

export const fileTransportFactory =
  (dir: string) =>
  (level: LogLevel, context: LoggerContext, messages: unknown[], getTimestamp: () => string | null) => {
    const timestamp = getTimestamp();
    const { config, namespace = [], tags = {}, extra = {} } = context;

    if (config.format === 'json') {
      fileBulkQueue.push(
        stringify({
          level,
          ...omit(context, 'config'),
          messages: messages
            .map((current) => (isString(current) ? current : `${extractMessage(current as any)}`), '')
            .join(','),
          timestamp,
        }),
      );
    }

    let content = '';
    if (config.format === 'text') {
      if (timestamp) content += timestamp;

      if (config.enableNamespacePrefix && namespace.length) content += `${namespace.join('/')}`;
      if (content) content += ' ';

      if (config.appendTagsForTextPrint && Object.keys(tags).length) content += extractMessage(tags);
      if (content) content += ' ';

      if (config.appendExtraForTextPrint && Object.keys(extra).length) content += extractMessage(extra);

      content += messages.map((msg) => (isString(msg) ? msg : extractMessage(msg as any))).join(' ');

      fileBulkQueue.push(content);
      if (fileBulkQueue.length >= fileUpdateBulkSize) wrtiteLogToFile(`${fileBulkQueue.join('\n')}\n`, dir);

      if (config.hook) config.hook(level, context, ...messages);
    }
  };

export const registerFileTimer = (dir: string) => {
  fs.mkdirSync(dir, { recursive: true });
  setInterval(() => {
    wrtiteLogToFile(fileBulkQueue.join('\n'), dir);
  }, fileUpdateInterval);
};
