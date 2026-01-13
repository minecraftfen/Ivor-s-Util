/**
 * 该文件的主要目的不是为了强制所有数据都要经过这里的检查，
 * 仍然允许直接使用这里导出的类型进行类型断言绕过类型守卫。
 * 主要目的在于明确一部分类型定义的语义。
 */

import type { Brand } from './Generics';

/**
 * 只是经常会用到，单独写一个
 */
export interface objUnknown { [K: string]: unknown };

//// string ////

declare const IsASCII: unique symbol;
type IsASCII = typeof IsASCII;

export type ASCII = Brand<IsASCII, string>;

export function isASCIIString(str: string): str is ASCII {
  return /^[\x20-\x7E]*$/.test(str);
}

declare const IsBase64: unique symbol;
type IsBase64 = typeof IsBase64;

export type Base64 = Brand<IsBase64, string>;

export function isBase64String(str: string): str is Base64 {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(str);
}

//// number ////

export type Float = number;

declare const IsNegative: unique symbol;
type IsNegative = typeof IsNegative;

export type Negative = Brand<IsNegative, number>;

export function isNegative(num: number): num is Negative {
  return num < 0;
}

declare const IsPositive: unique symbol;
type IsPositive = typeof IsPositive;

export type Positive = Brand<IsPositive, number>;

export function isPositive(num: number): num is Positive {
  return num > 0;
}

export type NonNegative = Positive | 0;

declare const IsInteger: unique symbol;
type IsInteger = typeof IsInteger;

export type Integer = Brand<IsInteger, number>;

export function isInteger(num: number): num is Integer {
  return Number.isInteger(num);
}

export type PositiveInteger = Brand<IsPositive | IsInteger, number>;
export type NonNegativeInteger = PositiveInteger | 0;

//// array ////

declare const IsNotSparse: unique symbol;
type IsNotSparse = typeof IsNotSparse;

export type NotSparse<T extends ArrayLike<unknown>> = Brand<IsNotSparse, T>;

export function isNotSparse<T extends ArrayLike<unknown>>(obj: T): obj is NotSparse<T> {
  for (let i = 0; i < obj.length; i++)
    if (!(i in obj)) return false;
  return true;
}

declare const IsGrid: unique symbol;
type IsGrid = typeof IsGrid;

export type GridLike<T> = NotSparse<NotSparse<T[]>[]>

export type Grid<T> = Brand<IsGrid, GridLike<T>>;

export function isGrid<T>(obj: GridLike<T>): obj is Grid<T> {
  if(obj.length < 1) return false;
  const rowLength = obj[0]?.length;
  if(!rowLength) return false;
  if (!(Array.prototype.map.call(obj, row => row.length)
    .every(length => length === rowLength))
  ) return false;
  return true;
}
