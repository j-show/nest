/* eslint-disable @typescript-eslint/no-explicit-any */
import { INestApplication } from '@nestjs/common';

import { NestLogger } from '@jshow/nest-common';

export interface ConsoleRunOptions {
  app: INestApplication;
  name: string;
  version?: string;
  logger?: NestLogger;
  args?: string[];
  callback?: (err?: Error) => void;
}
