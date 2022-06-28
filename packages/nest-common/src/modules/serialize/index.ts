/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface SerializeOptions {
  intercept?: (v: unknown) => [boolean, unknown];
}

// @TODO: fill code
export const serialize = (data: any, options?: SerializeOptions): any => {
  return JSON.stringify(data, null, 4);
};
