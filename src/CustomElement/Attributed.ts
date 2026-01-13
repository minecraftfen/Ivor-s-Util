import type {
  Type2TypeString,
  jsTypeString,
  jsType
} from '../Typescript/Generics';
import { deserialize2Boolean } from '../Serialization/Boolean';

function type2Name(type: AttributeType<any>) {
  return (type as Exclude<typeof type, string>).name ?? type;
}

function InvalidValueError(type: AttributeType<any> | AttributeType<any>[], value: unknown) {
  return new Error(`值 ${String(value).valueOf()} 不符合预期，预期 ${Array.isArray(type)
    ? type.map(type2Name).join(' 或 ')
    : type2Name(type)
    } ，得到 ${typeof value}`);
}

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

export type AttributeType<T extends NonNullable<unknown> = any> = Type2TypeString<T> | {
  name: string,
  validate(value: unknown): value is T,
  /** return null when failed */
  parse(value: string): T | null;
  stringify(value: T): string | null;
};

export interface AttributeDescriptor<T extends NonNullable<unknown> = any> {
  defaultValue: T;
  type: AttributeType<T>;
  /** return false to abort */
  onSet?: () => void | boolean;
}

export interface AttributeDescriptorDict {
  readonly [K: string]: AttributeDescriptor;
}

export const string2Type = Object.freeze({
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
  boolean: deserialize2Boolean,
}) satisfies {
  [K in Exclude<jsTypeString, 'function'>]: (value: string) => jsType[K]
};

export const type2String = new Proxy(
  Object.fromEntries(Object.keys(string2Type)
    .map(e => [e, void 0])
  ) as unknown as {
    readonly [K in keyof typeof string2Type]: (value: jsType[K]) => string
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

export function Attributed<
  TBase extends ReplaceParameters<typeof HTMLElement, any[]>,
  Attr extends { readonly [K in string]: AttributeDescriptor }
>(base: TBase, initialAttrs?: Attr) {
  class Impl extends base {
    readonly #attrs: Map<string, AttributeDescriptor> = new Map();
    readonly #attributeValues: Map<string, unknown> = new Map();
    #validateAttr<T extends NonNullable<unknown>>(
      type: AttributeType<T>,
      value: string | T
    ): value is T {
      if (typeof type === 'string') return typeof value === type;
      return type.validate.call(this, value);
    }

    #parseAttr<T extends NonNullable<unknown>>(
      type: AttributeType<T>,
      value: string | T
    ): T {
      if (this.#validateAttr(type, value)) return value;
      if (typeof value !== 'string') throw InvalidValueError(type, value);
      if (typeof type === 'string') {
        if (!(type in string2Type)) throw new TypeError('未实现的数据类型');
        return string2Type[type as Exclude<jsTypeString, 'function'>](value as string);
      }
      const result = type.parse.call(this, value);
      if (result === null) throw InvalidValueError(type, value);
      return result;
    }

    #stringifyAttr<T extends NonNullable<unknown>>(
      type: AttributeType<T>,
      value: T
    ): string {
      if (!this.#validateAttr(type, value)) throw InvalidValueError(type, value);
      if (typeof type === 'string') {
        if (!(type in type2String)) throw new TypeError('未实现的数据类型');
        return (type2String as any)[type]!(value);
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
        const desc = descriptors[name];
        if (!desc) return;

        if (!/^[a-z-]{3,}$/.test(name)) throw new TypeError(
          '属性名只能是小写字母和连字符的组合，且至少需要有三个字符长度'
        );

        obj.#attrs.set(name, desc);
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
    }

    getAttrDefault(name: string): unknown {
      const attr = this.#attrs.get(name);
      if (!attr) throw InvalidValueError('Attribute Name' as 'string', name);
      return attr.defaultValue;
    }

    static readonly #observed: Set<string> = new Set();
    static observed = function (this: typeof Impl): string[] {
      return Array.from(this.#observed);
    }.bind(Impl);
    static get observedAttributes(): string[] {
      return this.observed();
    };

    attributeChangedCallback(
      name: string,
      oldValue: string,
      newValue: string
    ) {
      if (oldValue === newValue) return;
      // console.trace(`${this.tagName}.${name}: ${oldValue} -> ${newValue}`);
      const attr = this.#attrs.get(name);
      if (!attr) return;
      this.#attributeValues.set(name, this.#parseAttr(
        attr.type,
        newValue
      ));
      attr.onSet?.call(this);
    }
  };

  return Impl as ReplaceInstanceType<
    typeof Impl,
    Impl
    & InstanceType<TBase>
    & { [K in keyof Attr]: Attr[K]['defaultValue'] }
    & { [K: string]: unknown; }
  >;
}

export type AttributedConstructor<
  TBase extends ReplaceParameters<typeof HTMLElement, any[]> = ReplaceParameters<typeof HTMLElement, any[]>,
  Attr extends { readonly [K in string]: AttributeDescriptor } = { readonly [K in string]: AttributeDescriptor }
> = ReturnType<typeof Attributed<TBase, Attr>>;
export type Attributed<
  TBase extends ReplaceParameters<typeof HTMLElement, any[]> = ReplaceParameters<typeof HTMLElement, any[]>,
  Attr extends { readonly [K in string]: AttributeDescriptor } = { readonly [K in string]: AttributeDescriptor }
> = InstanceType<AttributedConstructor<TBase, Attr>>;

export const types = {
  nonNegative: {
    name: 'non-negative number',
    validate(value: unknown): value is number {
      return typeof value === 'number'
        && !isNaN(value)
        && value >= 0;
    },
    parse(value: string) {
      return Math.max(string2Type.number(value), 0);
    },
    stringify(value: number) {
      return type2String.number(value);
    }
  }
};

// --- Operable Props --- //

type operablePropName = `${string}able`;

type Operable<operation extends operablePropName> = {
  [K in operation]: boolean;
};

type Listener<T extends HTMLElement, E extends Event> = (this: T, event: E) => any;

type ListenerObject<T extends HTMLElement, E extends Event> = {
  handleEvent: Listener<T, E>;
  options?: boolean | AddEventListenerOptions;
} | Listener<T, E>;

interface OperableEventInit<T extends object = any> {
  detail?: T;
  cancelable: boolean;
}

type OperableEventDetail<
  obj extends Operable<prop>,
  prop extends operablePropName,
  T extends object
> = T & {
  [K in `${prop}Object`]: obj
} & {
    [K in prop]: obj[prop]
  } & {
    operableObject: obj,
    operablePropertyName: prop,
    operableStatus: obj[prop],
  };

class OperableEvent<
  obj extends Operable<prop>,
  prop extends operablePropName,
  T extends object = {}
> extends CustomEvent<OperableEventDetail<obj, prop, T>> {
  constructor(
    obj: obj,
    prop: prop,
    type: string,
    eventInitDict?: OperableEventInit<T>
  ) {
    const initDict = {
      bubbles: false,
      composed: false,
      cancelable: eventInitDict?.cancelable ?? false,
      detail: {
        ...eventInitDict?.detail,
        [`${prop}Object`]: obj,
        [prop as prop]: obj[prop],

        operableObject: obj,
        operablePropertyName: prop,
        operableStatus: obj[prop],
      } as any
    };
    super(type, initDict);
  }
}

const OperableEventMap = {
  operableStatusChange: <prop extends operablePropName>(
    obj: Operable<prop>,
    prop: prop
  ) => new OperableEvent(obj, prop, 'operableStatusChange', { cancelable: true })
};

interface OperableEventMap<obj extends Operable<prop>, prop extends operablePropName> {
  operableStatusChange: OperableEvent<obj, prop>;
}

const operable: WeakMap<Attributed, Set<operablePropName>> = new WeakMap();

export function makeOperable<obj extends Attributed, prop extends operablePropName>(
  obj: obj,
  prop: prop,
  listeners: {
    [K in keyof HTMLElementEventMap
    | keyof OperableEventMap<any, any>
    ]?: ListenerObject<obj, K extends keyof HTMLElementEventMap
      ? HTMLElementEventMap[K]
      : K extends keyof OperableEventMap<any, any>
      ? OperableEventMap<obj, prop>[K]
      : CustomEvent
    >
  },
): obj & Operable<prop> {
  if (operable.get(obj)?.has(prop)) {
    console.warn('makeOperable被重复调用，跳过。');
    return obj;
  }
  (obj.constructor as AttributedConstructor).registerAttrs(obj, { [prop]: { defaultValue: false, type: 'boolean' as const } });
  const callback = obj.attributeChangedCallback;
  function onSet(v: boolean) {
    const enable = v && obj.isConnected;
    const handler = listeners.operableStatusChange;
    if (handler) {
      const event = new OperableEvent(
        obj as obj & Operable<prop>,
        prop,
        'operableStatusChange',
        { cancelable: true }
      );
      obj.dispatchEvent(event);
      const result = (typeof handler === 'function'
        ? handler
        : handler.handleEvent
      ).call(obj, event);
      if (!Boolean(result) || event.defaultPrevented) return;
    }
    const method = obj[enable ? 'addEventListener' : 'removeEventListener'];
    Object.keys(listeners).filter(name => !(name in OperableEventMap))
      .forEach(eventName => method.call(
        obj,
        eventName as keyof typeof listeners,
        listeners[eventName as keyof typeof listeners] as EventListenerOrEventListenerObject,
        (listeners[eventName as keyof typeof listeners] as any).options
      ));
  }
  obj.attributeChangedCallback = function (...args: Parameters<typeof callback>) {
    if (args[0] !== prop) return callback.call(obj, ...args);
    onSet(string2Type.boolean(args[2]));
    return callback.call(obj, ...args);
  };
  const set = operable.get(obj);
  if (!set) operable.set(obj, new Set([prop]));
  else set.add(prop);
  onSet(obj[prop] as boolean);
  return obj;
}
