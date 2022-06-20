/* eslint-disable @typescript-eslint/no-explicit-any */

export type Constructor<T> = new (...args: unknown[]) => T;
export declare type AnyParamConstructor<T> = new (...args: any[]) => T;

export type Unpacked<T> = T extends (infer U)[] ? U : T;

export type StringKeyOf<T> = Extract<keyof T, string>;

export type ValueOf<T> = T[keyof T];

export type ArrayValueOf<T> = ValueOf<Omit<T, keyof []>>;

export type IteratorLike<T> = IterableIterator<T> | Iterable<T>;

export type IterableLike<T> = Iterable<T> | ArrayLike<T>;

export type IterableItem<T extends Iterable<unknown>> = T extends Iterable<infer U> ? U : never;

export type ItemOf<T, R = never> = T extends string ? T : T extends IterableLike<infer U> ? U : R;

export type MaybeArray<T> = T | T[];

export type MaybePromise<T> = T | Promise<T>;
