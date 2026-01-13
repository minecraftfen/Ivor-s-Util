import type {
  Type2TypeString,
  jsTypeString,
  jsType,
  ReplaceParameters,
  ReplaceInstanceType
} from '../Typescript/Generics';
import { deserialize } from '../Serialization/Boolean';

function type2Name(type: AttributeType<any>) {
  return (type as Exclude<typeof type, string>).name ?? type;
}

function InvalidValueError(type: AttributeType<any> | AttributeType<any>[], value: unknown) {
  return new Error(`值 ${String(value).valueOf()} 不符合预期，预期 ${Array.isArray(type)
    ? type.map(type2Name).join(' 或 ')
    : type2Name(type)
    } ，得到 ${typeof value}`);
}

export type AttributeType<T extends AttrValueType = any> = Type2TypeString<T> | {
  name: string,
  validate(value: unknown): value is T,
  /** return null when failed */
  parse(value: string): T | null;
  stringify(value: T): string | null;
};

type onSet<T extends AttrValueType = any> = (value: T) => void | boolean;

export interface AttributeDescriptor<T extends AttrValueType = any> {
  defaultValue: T;
  type: AttributeType<T>;
  /**
   * 数值更新前触发，按顺序调用
   *
   * 返回falsy值将截断本次更新，且不调用后续回调
   */
  onSet?: onSet<T> | onSet<T>[];
}

interface AttributedAttributeDescriptor<T extends AttrValueType = any> extends AttributeDescriptor<T> {
  onSet: onSet<T>[];
}

export interface AttributeDescriptorDict<T extends AttrValueType = any> {
  readonly [K: string]: AttributeDescriptor<T>;
}

type AttrValueType = NonNullable<unknown>;

const _Attributed = function Attributed<
  TBase extends ReplaceParameters<typeof HTMLElement, any[]>,
  Attr extends AttributeDescriptorDict
>(base: TBase, initialAttrs?: Attr) {
  class Impl extends base {
    readonly #attrs: Map<string, AttributedAttributeDescriptor<AttrValueType>> = new Map();
    readonly #attributeValues: Map<string, unknown> = new Map();
    #validateAttr<T extends AttrValueType>(
      type: AttributeType<T>,
      value: string | unknown
    ): value is T {
      if (typeof type === 'string') return typeof value === type;
      return type.validate.call(this, value);
    }

    #parseAttr<T extends AttrValueType>(
      type: AttributeType<T>,
      value: string | T
    ): T {
      if (this.#validateAttr(type, value)) return value;
      if (typeof value !== 'string') throw InvalidValueError(type, value);
      if (typeof type === 'string') {
        if (!(type in deserializer)) throw new TypeError('未实现的数据类型');
        return deserializer[type as Exclude<jsTypeString, 'function'>](value as string);
      }
      const result = type.parse.call(this, value);
      if (result === null) throw InvalidValueError(type, value);
      return result;
    }

    #stringifyAttr<T extends AttrValueType>(
      type: AttributeType<T>,
      value: T
    ): string {
      if (!this.#validateAttr(type, value)) throw InvalidValueError(type, value);
      if (typeof type === 'string') {
        if (!(type in serializer)) throw new TypeError('未实现的数据类型');
        return (serializer as any)[type]!(value);
      }
      const result = type.stringify.call(this, value);
      if (result === null) throw InvalidValueError(type, value);
      return result;
    }

    static registerAttrs = function (
      obj: Impl,
      descriptors: AttributeDescriptorDict
    ): void {
      Object.keys(descriptors).forEach(name => {
        const desc = descriptors[name] as AttributeDescriptor<AttrValueType>;
        if (!desc) return;

        if (!/^[a-z-]{3,}$/.test(name)) throw new TypeError(
          '属性名只能是小写字母和连字符的组合，且至少需要有三个字符长度'
        );
        const _desc = {
          ...desc,
          onSet: desc.onSet === undefined ? []
            : typeof desc.onSet === 'function'
              ? [desc.onSet]
              : desc.onSet
        };
        if (!Array.isArray(desc.onSet))
          throw InvalidValueError('array' as any, desc.onSet);
        obj.#attrs.set(name, _desc);
        obj.#attributeValues.set(name, desc.defaultValue);
        Object.defineProperty(obj, name, {
          get: function (): unknown {
            const value = obj.#attributeValues.get(name);
            const result = value ?? desc.defaultValue;
            if (result !== value)
              obj.#attributeValues.set(name, desc.defaultValue);
            return result;
          },
          set: function (value: unknown): void {
            const attr = obj.#attrs.get(name);
            if (!attr) return;
            if (!obj.#validateAttr(attr.type, value))
              throw InvalidValueError(attr.type, value);
            return obj.setAttribute(name, obj.#stringifyAttr(attr.type, value));
          }
        });
      });
    }.bind(Impl);

    constructor(...args: any[]) {
      super(...args);
      if (initialAttrs) Impl.registerAttrs(this, initialAttrs);
      Object.defineProperty(this, 'observedAttributes', {
        configurable: false,
        enumerable: false,
        get: function (this: typeof Impl): string[] {
          return Array.from(this.#observed);
        }.bind(Impl),
        set: function () {
          throw new Error(
            '`Attributed.prototype.observedAttributes`不可写\n' +
            '如需增加属性，请使用 `Attributed.prototype.registerAttrs()`'
          );
        }
      });
    }

    getAttrDefault(name: string): unknown {
      return this.#getAttr(name).defaultValue;
    }

    #getAttr(name: string) {
      const attr = this.#attrs.get(name);
      if (!attr) throw InvalidValueError('Attribute Name' as 'string', name);
      return attr;
    }

    addAttributeChangeListener(name: string, callback: onSet<AttrValueType>) {
      const attr = this.#getAttr(name);
      attr.onSet.push(callback);
    }

    static readonly #observed: Set<string> = new Set();

    attributeChangedCallback(
      name: string,
      oldValue: string,
      newValue: string
    ) {
      if (oldValue === newValue) return;
      // console.trace(`${this.tagName}.${name}: ${oldValue} -> ${newValue}`);
      const attr = this.#attrs.get(name);
      if (!attr) return;
      const value = this.#parseAttr(attr.type, newValue);
      if (!attr.onSet.every(e => e.call(this, value))) return;
      this.#attributeValues.set(name, value);
    }
  };

  return Impl as ReplaceInstanceType<
    typeof Impl,
    Impl
    & InstanceType<TBase>
    & { [K in keyof Attr]: Attr[K]['defaultValue'] }
    & { [K: string]: unknown; }
  >;
};

const deserializer = Object.freeze({
  string: String,
  number: (value: string): number => {
    const result = parseFloat(value);
    if (isNaN(result) || result <= 0) throw InvalidValueError('number', value);
    return result;
  },
  symbol: Symbol.for.bind(Symbol),
  bigint: BigInt,
  undefined: () => void 0,
  object: JSON.parse.bind(JSON),
  boolean: deserialize,
}) satisfies {
  [K in Exclude<jsTypeString, 'function'>]: (value: string) => jsType[K]
};

const serializer = new Proxy(
  Object.fromEntries(Object.keys(deserializer)
    .map(e => [e, void 0])
  ) as unknown as {
    readonly [K in keyof typeof deserializer]: (value: jsType[K]) => string
  },
  {
    get(target, prop, receiver): (value: any) => string {
      if (typeof prop === 'string') {
        switch (prop) {
          case 'string':
          case 'number':
          case 'bigint':
          case 'boolean':
          case 'undefined':
          case 'function':
            return String;
          case 'object':
            return (value: object) => JSON.stringify(value);
          case 'symbol':
            return (value: symbol) => value.description ?? value.toString();
        }
      }
      return Reflect.get(target, prop, receiver);
    },
  });

const types = {
  nonNegative: {
    name: 'non-negative number',
    validate(value: unknown): value is number {
      return typeof value === 'number'
        && !isNaN(value)
        && value >= 0;
    },
    parse(value: string) {
      return Math.max(deserializer.number(value), 0);
    },
    stringify(value: number) {
      return serializer.number(value);
    }
  }
};

export const Attributed = _Attributed as typeof _Attributed & {
  /** 用于对外暴露 Attributed 的部分内部行为 */
  readonly Reflect: {
    /** 解析 HTML 标签属性的内部行为 */
    readonly deserializer: typeof deserializer,
    /** 产生 HTML 标签属性的内部行为 */
    readonly serializer: typeof serializer,
  },
  /** 定义了一些常用的非内建类型 */
  readonly types: typeof types,
};

Attributed
  //@ts-ignore
  .Reflect =
{
  deserializer,
  serializer,
};

Attributed
  // @ts-ignore
  .types =
  types;

export type AttributedConstructor<
  TBase extends ReplaceParameters<typeof HTMLElement, any[]> = ReplaceParameters<typeof HTMLElement, any[]>,
  Attr extends { readonly [K in string]: AttributeDescriptor } = { readonly [K in string]: AttributeDescriptor }
> = ReturnType<typeof Attributed<TBase, Attr>>;
export type Attributed<
  TBase extends ReplaceParameters<typeof HTMLElement, any[]> = ReplaceParameters<typeof HTMLElement, any[]>,
  Attr extends { readonly [K in string]: AttributeDescriptor } = { readonly [K in string]: AttributeDescriptor }
> = InstanceType<AttributedConstructor<TBase, Attr>>;
