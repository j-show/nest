import { logger } from '@jshow/logger';

const blacklist = new Set(
  (process.env.DEBUG_IGNORE || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((v) => v),
);

export const useLogger = (ctx: any) => {
  const namespace = typeof ctx === 'string' ? ctx : typeof ctx === 'function' ? ctx.name : ctx.constructor.name;

  if (process.env.NODE_ENV === 'production') return logger.fork({ namespace });
  if (!blacklist.has(namespace.toString().toUpperCase())) return logger.fork({ namespace });

  return new Proxy({} as typeof logger, {
    get(_, key, self) {
      if (key === 'child') return () => self;
      return () => {};
    },
  });
};
