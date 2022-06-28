import chalk from 'chalk';
import fs from 'fs';
import moment from 'moment';
import path from 'path';
import { renderString } from 'prettyjson';
import stripAnsi from 'strip-ansi';
import { v4 as uuidV4 } from 'uuid';

import { LogMeta } from '@jshow/logger';
import { getConfig, isProd, serialize } from '@jshow/nest-common';

const CONFIG_KEY_TIME_FORMAT = 'logger.timeFormat';
const CONFIG_KEY_PERSISTENCE_FILE_META = 'logger.persistence.file.meta';

const getFormatMixed =
  (key = CONFIG_KEY_PERSISTENCE_FILE_META) =>
  (data: unknown) => {
    const meta = getConfig(key);
    return meta ? smartMeta(meta, data) : normalMeta(data);
  };

const padIndent = (text: string) => {
  const prefix = ''.padStart(4, ' ');
  return text.replace(/^/gm, prefix);
};

const metaIdent = new Array(16).fill(' ').join('');

const prettyOptions = isProd ? { noColor: true } : {};

const normalMeta = (data: unknown) => {
  return renderString(serialize(data), prettyOptions);
};

const writeFileMeta = (filename: string, data: unknown) => {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, data as string);
};

export const smartMeta = (meta: string, data: unknown) => {
  let output = normalMeta(data);
  if (output.split('\n').length > 8) {
    const filename = `${meta}/${moment().format('YYYY-MM/DD')}/${uuidV4()}`;
    writeFileMeta(filename, stripAnsi(output));
    // starts with "file:///" for WebStorm user
    output = coloredLogText.gray(` . . . big meta wrote to "file://${filename}"`);
  }
  return output.replace(/^/gm, metaIdent);
};

export const coloredLogText = chalk;

export const createLogTimestamp = (key = CONFIG_KEY_TIME_FORMAT) => {
  const timeFormat = getConfig(key);
  if (!timeFormat) return () => null;

  return () => {
    const text = moment().format(timeFormat);
    return isProd ? text : coloredLogText.gray(text);
  };
};

export const extractMessage = (
  info?: {
    stack?: string[] | string;
    message?: string | Error;
    context?: string;
  } & LogMeta,
  keyLogMeta?: string,
): string => {
  let result = '';
  if (!info) return result;

  const { stack, message, ...rest } = info;
  const formatMixed = getFormatMixed(keyLogMeta);

  if (info instanceof Error) {
    result += formatMixed(info);
  } else if (message instanceof Error) {
    result += message.stack ? formatMixed(message) : padIndent(message.toString());
  } else {
    if (message != null) {
      const msgStr = info.toString();
      if (msgStr === '[object Object]') {
        const type = typeof message;
        if (type === 'number' || type === 'string') result += message;
        else result += formatMixed(message);
      } else result += padIndent(msgStr);
    }
    if (stack) {
      result += '\n' + padIndent(Array.isArray(stack) ? stack.join('\n') : stack);
    }
  }

  const stringified = info.toString();
  if (stringified !== '[object Object]') result += '\n' + padIndent(stringified);
  if (Object.keys(rest).length > 0) result += '\n' + formatMixed({ ...rest });

  return result;
};
