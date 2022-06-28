/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, NestMiddleware } from '@nestjs/common';
import { pick } from 'lodash';

import { onHeaders, useLogger } from '@jshow/nest-common';

import { coloredLogText } from './utils/format';

const addRequestLogger = (text: string, res: any, req?: any) => {
  // 冗余route字段统一筛选
  useLogger('Access')
    .fork({
      extra: { ...pick(req, ['headers', 'path', 'method', 'query']), route: req ? `[${req?.method}] ${req?.url}` : '' },
    })
    .info(`${coloredLogText.gray('BEGIN')} ${text}`);

  const startAt = process.hrtime();

  onHeaders(res, () => {
    const cost = process.hrtime(startAt);
    const suffix = (cost[0] * 1e3 + cost[1] * 1e-6).toFixed(4) + 'ms';
    useLogger('Access')
      .fork({
        extra: {
          ...pick(req, ['headers', 'path', 'method', 'query']),
          route: req ? `[${req?.method}] ${req?.url}` : '',
          status: res.statusCode,
        },
      })
      .info(`${coloredLogText.gray('  END')} ${text} ${coloredLogText.gray(suffix)}`);
  });
};

@Injectable()
export class ApiLoggerMiddleware implements NestMiddleware {
  public use(req: any, res: any, next: (error?: any) => void) {
    // GET, HEAD, POST, PUT, DELETE, CONNECT, OPTIONS, TRACE
    addRequestLogger(`${coloredLogText.blue(req.method.padEnd(7, ' '))} ${req.path}`, res, req);
    next();
  }
}

@Injectable()
export class OAuthLoggerMiddleware implements NestMiddleware {
  public use(req: any, res: any, next: Function) {
    addRequestLogger(`${coloredLogText.green('OAUTH'.padEnd(7, ' '))} ${req.path}`, res, req);
    next();
  }
}
