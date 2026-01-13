/**
 * 将字符串的首字母大写。
 * 主要用于类型推断，例如允许this[`custom${Capitalize(operation)}`]被正确解析为customAdd等方法的类型
 */
export function Capitalize<T extends string>(str: T): Capitalize<T> {
  return str.charAt(0).toUpperCase() + str.slice(1) as Capitalize<T>;
}

export function Lowercase<T extends string>(str: T): Lowercase<T> {
  return str.toLowerCase() as Lowercase<T>;
}
