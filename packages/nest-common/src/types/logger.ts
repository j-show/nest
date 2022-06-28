/* eslint-disable @typescript-eslint/no-explicit-any */

export interface NestLogger {
  debug(str: string | object): void;

  debug(format: string, ...mixed: any[]): void;

  info(str: string | object): void;

  info(format: string, ...mixed: any[]): void;

  log(str: string | object): void;

  log(format: string, ...mixed: any[]): void;

  warn(str: string | object): void;

  warn(format: string, ...mixed: any[]): void;

  error(str: string | object): void;

  error(format: string, ...mixed: any[]): void;
}
