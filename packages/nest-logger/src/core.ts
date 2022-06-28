import { flatten } from 'lodash';

import { CoreLoggerFactory, LoggerConfig, LoggerContext } from '@jshow/logger';
import { getConfig, isProd, stripUndefined } from '@jshow/nest-common';

import { consoleTranportFactory, fileTransportFactory, logstashTransport, registerFileTimer } from './transport';
import { getEnabledLogstash } from './transport/logstash/client';
import { createLogTimestamp } from './utils';

const CONFIG_KEY_FORMAT = 'logger.format';
const CONFIG_KEY_PERSISTENCE_FILE_DIR = 'logger.persistence.file';

const getFormat = (key = CONFIG_KEY_FORMAT) =>
  getConfig<LoggerConfig['format']>(key, 'text', (val: unknown) => ['text', 'json'].includes(val as string));

const getLogFileDir = (key = CONFIG_KEY_PERSISTENCE_FILE_DIR) => getConfig(key);

export const LoggerFactory: CoreLoggerFactory<LoggerContext> = (key?: {
  format?: string;
  logstash?: string;
  fileDir?: string;
}) => {
  const format = getFormat(key?.format);
  const fileDir = getLogFileDir(key?.fileDir);
  const enableLogstashClient = getEnabledLogstash(key?.logstash);

  const fileTransport = fileTransportFactory(fileDir);
  const consoleTransport = consoleTranportFactory();
  const logTs = createLogTimestamp();

  if (fileDir) registerFileTimer(fileDir);

  return {
    print: ({ level, context }, ...messages) => {
      consoleTransport(level, context, messages, logTs);
      if (fileDir) fileTransport(level, context, flatten(messages), logTs);
      if (enableLogstashClient && format === 'json') logstashTransport(level, context, flatten(messages), logTs);
    },
  };
};

export const getLoggerConfig = (key?: string): Partial<LoggerConfig> => {
  const format = getFormat(key);

  return stripUndefined({
    format,
    enableNamespacePrefix: true,
    appendExtraForTextPrint: format === 'json' || isProd,
    appendTagsForTextPrint: format === 'json' || isProd,
  } as LoggerConfig);
};
