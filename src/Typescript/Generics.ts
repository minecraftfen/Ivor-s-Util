export type Brand<Brand extends symbol, Type> = Type & { [K in Brand]: true };

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export type ReplaceInstanceType<
  TClass extends new (...args: any) => any,
  TNewInstance
> = {
  [K in keyof TClass]: TClass[K];
} & {
  new(...args: ConstructorParameters<TClass>): TNewInstance;
  prototype: TNewInstance;
};

export type ReplaceParameters<
  TClass extends new (...args: any) => any,
  TNewParameters extends any[]
> = {
  [K in keyof TClass]: TClass[K];
} & {
  new(...args: TNewParameters): InstanceType<TClass>;
  prototype: InstanceType<TClass>;
};

// --- jsType --- //

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
  'object';
