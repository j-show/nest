import { isString, omit } from 'lodash';

import { LoggerContext, LogLevel, stringify } from '@jshow/logger';

import { extractMessage } from '../../utils';

import { Logstash } from './client';

export const logstashTransport = (
  level: LogLevel,
  context: LoggerContext,
  messages: unknown[],
  getTimestamp: () => string | null,
) => {
  const timestamp = getTimestamp();
  const { config, namespace = [], tags = {}, extra = {} } = context;

  if (context.config.format === 'json') {
    process.nextTick(async () => {
      await Logstash.sendLog(
        level,
        stringify({
          level,
          ...omit(context, 'config'),
          messages: messages
            .map((current) => (isString(current) ? current : `${extractMessage(current as any)}`), '')
            .join(','),
          timestamp,
        }),
      );
    });
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

    if (config.hook) config.hook(level, context, ...messages);

    process.nextTick(async () => {
      await Logstash.sendLog(level, content);
    });
  }
};
