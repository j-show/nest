import config from 'config';

export const hasConfig = (key: string) => config.has(key);

export function getConfig<T = string>(key: string, defaultValue?: T, verify?: (value: unknown) => boolean): T {
  let value = config.has(key) ? config.get<T>(key) : defaultValue;
  if (verify && !verify(value)) value = defaultValue;

  return (value ?? defaultValue) as T;
}
