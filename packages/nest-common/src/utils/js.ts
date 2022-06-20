import { ValueOf } from '../types';

export function stripValue<T>(x: T, v: unknown, deep = false): T {
  if (typeof x === 'object' && x) {
    if (Array.isArray(x)) {
      if (!deep) return x;
      return x.map((child) => stripValue(child, v, deep)) as unknown as T;
    }

    const result = {} as T;
    for (const key of Object.keys(x) as Array<keyof typeof x>) {
      const value = x[key];
      if (value === v) continue;
      result[key] = deep ? stripValue(value, v, deep) : value;
    }
    return result;
  }
  return x;
}

export function stripUndefined<T>(x: T, deep = false): T {
  return stripValue(x, void 0, deep);
}

export function predicate<T>(x: T): x is Exclude<T, null | undefined | void | false | 0 | ''> {
  return Boolean(x);
}

export function pick<T, K extends keyof T>(source: T, keys: K[]) {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    result[key] = source[key];
  }
  return result;
}

export function keysOf<T extends {}>(x: T) {
  return Object.keys(x) as Array<keyof T>;
}

export function* valuesOf<T extends {}>(x: T): IterableIterator<ValueOf<T>> {
  for (const key of keysOf(x)) {
    yield x[key];
  }
}
