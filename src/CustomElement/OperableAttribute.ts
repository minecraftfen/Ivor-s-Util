import { Attributed, AttributedConstructor } from './Attributed';

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
  function onSet(v: unknown) {
    const enable = Attributed.Reflect.deserializer.boolean(v) && obj.isConnected;
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
  obj.addAttributeChangeListener(prop, onSet);
  const set = operable.get(obj);
  if (!set) operable.set(obj, new Set([prop]));
  else set.add(prop);
  onSet(obj[prop] as boolean);
  return obj;
}
