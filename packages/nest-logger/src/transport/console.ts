import { isString, omit } from 'lodash';
import stripAnsi from 'strip-ansi';

import { Color, LoggerContext, LogLevel, stringify } from '@jshow/logger';
import { isNode, isTest } from '@jshow/nest-common';

import { coloredLogText, extractMessage } from '../utils';

const makeContentStyle = (content: string): Color.LogColorStyle => {
  const majorColor = Color.makeColorHexFromText(content);
  const enhancedMajorColor = Color.betterLogColor(majorColor);
  return {
    backgroundColor: enhancedMajorColor,
    contentColor: Color.isDarkColor(enhancedMajorColor) ? [0, 0, 0] : [255, 255, 255],
  };
};

const processColoringPrefixChunks: (namespace: NonNullable<LoggerContext['namespace']>) => string[] = isNode
  ? (namespace) => {
      return [namespace.map((ns) => Color.wrapColorANSI(ns, makeContentStyle(ns))).join('/')];
    }
  : (namespace) => {
      const { contents, styles } = namespace
        .map((ns) => Color.wrapColorCSS(ns, makeContentStyle(ns)))
        .reduce(
          (collection, [content, style]) => {
            collection.contents.push(content);
            collection.styles.push(style);

            return collection;
          },
          { contents: [] as string[], styles: [] as string[] },
        );
      return [contents.join('/'), ...styles];
    };

export const consoleTranportFactory =
  () => (level: LogLevel, context: LoggerContext, messages: unknown[], getTimestamp: () => string | null) => {
    const timestamp = getTimestamp();
    const { config, namespace = [], tags = {}, extra = {} } = context;
    const log = console[level];

    if (context.config.format === 'json') {
      log(
        stringify({
          level,
          ...omit(context, 'config'),
          messages: messages
            .map((current) => {
              if (isString(current)) return `${current}`;
              else return `${extractMessage(current as any)}`;
            }, '')
            .join(','),
          timestamp,
        }),
      );
    }

    if (config.format === 'text') {
      const chunks: Array<unknown> = [''];

      if (timestamp) chunks.push(timestamp);

      if (config.enableNamespacePrefix && namespace.length) {
        if (config.enableNamespacePrefixColors) chunks.push(...processColoringPrefixChunks(namespace));
        else chunks.push(`${namespace.join('/')}`);
      }

      chunks.push(...messages);
      if (config.appendTagsForTextPrint && Object.keys(tags).length) {
        if (config.transformTagsForTextPrint) chunks.push(config.transformTagsForTextPrint(tags, context));
        else chunks.push(extractMessage(tags));
      }

      if (config.appendExtraForTextPrint && Object.keys(extra).length) {
        if (config.transformExtraForTextPrint) chunks.push(config.transformExtraForTextPrint(extra, context));
        else chunks.push(extractMessage(extra));
      }

      const consoleInfo = chunks.map((c) => (isString(c) ? c : extractMessage((c as any) ?? {}))).join(' ');

      if (isTest) {
        switch (level) {
          case 'error':
            log(coloredLogText.bgRed(stripAnsi(consoleInfo)));
            break;
          case 'warn':
            log(coloredLogText.bgRedBright(stripAnsi(consoleInfo)));
            break;
          default:
            log(stripAnsi(consoleInfo));
        }
      } else {
        log(consoleInfo);
      }
    }

    if (config.hook) config.hook(level, context, ...messages);
  };
