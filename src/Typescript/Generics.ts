export type Brand<Brand extends symbol, Type> = Type & { [K in Brand]: true };

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

const jsTypeUnknown: unknown = void 0;
const jsType = typeof jsTypeUnknown;
export type jsTypeString = typeof jsType;

export interface jsType {
  string: string,
  number: number,
  bigint: bigint,
  boolean: boolean,
  symbol: symbol,
  undefined: undefined,
  object: object | null,
  function: (...args: any[]) => void | (new (...args: any[]) => void);
}

export type TypeofFunction = (...args: any[]) => void | (new (...args: any[]) => void);

export type Type2TypeString<T> =
  T extends string ? 'string' :
  T extends number ? 'number' :
  T extends bigint ? 'bigint' :
  T extends boolean ? 'boolean' :
  T extends symbol ? 'symbol' :
  T extends undefined ? 'undefined' :
  T extends TypeofFunction ? 'function' :
  'object'
