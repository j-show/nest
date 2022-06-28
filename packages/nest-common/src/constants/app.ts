export const NODE_ENV = process.env.NODE_ENV ?? '';

// @ts-ignore
export const isNode = typeof window === 'undefined';

export const isProd = NODE_ENV === 'production';

export const isDebug = !isProd;

export const isTest = NODE_ENV === 'test';
