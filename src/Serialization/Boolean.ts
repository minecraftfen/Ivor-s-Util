// cspell: disable
// 什么叫终极的过度设计啊 (战术后仰)
const TRUE_VALUES = new Set<unknown>([
  // 英文
  'y', 'yes', 'yeah', 'yep', 'yup', 'sure', 'ok', 'okay',
  'true', 't', '1', 'on', 'enable', 'enabled', 'active',
  'positive', 'affirmative', 'confirm', 'confirmed',
  'allow', 'allowed', 'permit', 'permitted', 'accept',
  'accepted', 'agree', 'agreed',

  // 中文
  '是', '对', '真', '正确', '确定', '确认', '同意',
  '允许', '开启', '启用', '激活', '好的', '可以',
  '行', '成', '要', '有', '中',

  // 数字
  '1',

  // 其他语言
  'si', 'sí', 'oui', 'ja', 'da', 'はい', '예'
]);

// 扩展的"否"值列表
const FALSE_VALUES = new Set<unknown>([
  // 英文
  'n', 'no', 'nah', 'nope', 'negative', 'false', 'f',
  '0', 'off', 'disable', 'disabled', 'inactive',
  'deny', 'denied', 'reject', 'rejected', 'refuse',
  'refused', 'decline', 'declined', 'disagree',
  'disagreed', 'never', 'void', 'null', 'undefined',

  // 中文
  '否', '不', '错', '错误', '不正确', '取消', '不同意',
  '拒绝', '禁止', '关闭', '禁用', '停用', '无效',
  '没有', '不要', '不行', '不成', '别', '莫', '不中',

  // 数字
  '0',

  // 其他语言
  'non', 'nein', 'нет', 'いいえ', '아니요',

  // 特殊值
  'null', 'undefined', 'void', 'never', 'none', 'nothing', 'nil'
]);
// cspell: enable

// 缺了一个 NaN, 但是关系不大
type BooleanGuard<T> = Exclude<T, 0 | -0 | null | false | undefined | ''>;

export type removeWrapper<T> =
  T extends Boolean
  ? boolean
  : T extends Number
  ? number
  : T extends BigInt
  ? bigint
  : T extends String
  ? string
  : T;

export function removeWrapper<T>(obj: T): removeWrapper<T> {
  if (obj instanceof Boolean || obj instanceof Number
    || obj instanceof BigInt || obj instanceof String
  ) (obj as unknown) = obj.valueOf();
  return obj as removeWrapper<T>;
}

export function ParseExplicit<T>(obj: T): boolean | removeWrapper<T> {
  (obj as unknown) = removeWrapper(obj);
  if (!Boolean(obj)) return false;
  if (obj === true) return true;
  switch (typeof obj) {
    case 'symbol':
    case 'function':
      return true;
    case 'number':
      // NaN, -0, 0, -Infinity 和一切负值均视为假值
      return obj > 0;
    case 'object':
      // 没有键的对象, 以及空数组
      return Object.keys(obj as BooleanGuard<typeof obj>).length > 0;
    case 'string':
      if (TRUE_VALUES.has(obj.toLowerCase())) return true;
      if (FALSE_VALUES.has(obj.toLowerCase())) return false;
  }
  return obj as removeWrapper<T>;
};

export function isAmbiguous(obj: unknown): boolean {
  return typeof ParseExplicit(obj) === 'boolean';
}

const ambiguousMsg = (obj: unknown) =>
  `语义模糊的配置文件值 ${obj?.toString() ?? '[无法转换为文字]'}`;

export function deserialize(obj: unknown, defaultValue?: boolean): boolean {
  obj = ParseExplicit(obj);
  if (typeof obj === 'boolean') return obj;
  if (typeof defaultValue === 'boolean') {
    console.warn(ambiguousMsg(obj));
    return defaultValue;
  }
  throw new TypeError(ambiguousMsg(obj));
}
