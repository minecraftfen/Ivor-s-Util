/**
 * 惰性求值数组，在序列化中会被视为普通的数组
 */
export class LazyEvalArray<T> extends Array<T> {
  protected get SerializableProperties() {
    return null;
  }
  private readonly _generator: Generator<T, void, unknown>;
  private _maxIndex: number;

  /**
   * 被覆写的数组方法，运行期间最多一次性额外生成多少条数据
   */
  private static readonly maxGeneration = 1024;

  private get maxValidIndex() {
    return this._maxIndex + LazyEvalArray.maxGeneration;
  }

  constructor(generator: Generator<T, void, unknown>) {
    super();

    Object.defineProperty(this, 'length', {
      value: Infinity,
      writable: false,
      configurable: false,
      enumerable: true
    });

    this._generator = generator;
    this._maxIndex = -1;

    // 返回Proxy实例来拦截访问
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (prop === 'length') return Infinity;
        const index = Number(prop);
        if (!isNaN(index) && index in target)
          return target[index];
        if (index >= 0 && index % 1 === 0)
          return target.getValueAt(index);
        return Reflect.get(target, prop, receiver);
      },
      set(target, prop, value, receiver) {
        if (prop === 'length') return false;
        const index = Number(prop);
        if (isNaN(index)) return Reflect.set(target, prop, value, receiver);
        return Reflect.set(target, index, value, receiver);
      },
      has(target, prop) {
        if (prop === 'length') return true;
        const index = Number(prop);
        if (isNaN(index)) return Reflect.has(target, prop);
        return Reflect.has(target, index);
      },

      getOwnPropertyDescriptor(target, prop) {
        if (prop === 'length') return {
          value: Infinity,
          writable: false,
          enumerable: false,
          configurable: false
        } satisfies TypedPropertyDescriptor<typeof Infinity>;
        const index = Number(prop);
        if (!isNaN(index) && index in target) return {
          value: target.getValueAt(index),
          writable: true,
          enumerable: true,
          configurable: true
        } satisfies TypedPropertyDescriptor<T>;
        return Reflect.getOwnPropertyDescriptor(target, prop);
      }
    });
  }

  private getValueAt(index: number): T {
    if (!(index in this)) while (this._maxIndex < index) {
      const next = this._generator.next();
      if (next.done) throw new TypeError(
        '被赋予LazyEvalArray的生成器应当可以无限生成，但意外终止。'
      );
      this[++this._maxIndex] = next.value;
    }
    return this[index]!;
  }
  /**
   * 暂时不支持传入负值
   * TODO: 还是得保证行为符合预期
   */
  override slice(start: number = 0, end?: number): T[] {
    const result: T[] = [];
    const endIndex = end !== undefined
      ? Math.min(end, this.maxValidIndex)
      : this._maxIndex;
    for (let i = start; i < endIndex; i++)
      result.push(this.getValueAt(i));
    return result;
  }

  override find(predicate: (value: T, index: number) => value is any): T | undefined {
    let index = -1;
    while (++index < this.maxValidIndex) {
      const value = this.getValueAt(index);
      if (predicate(value, index))
        return value;
    }
    return undefined;
  }

  toArray(length: number = this.maxValidIndex): T[] {
    return Array.from({ length }).fill(null).map((_e, i) => this.getValueAt(i));
  }

  override *[Symbol.iterator](): ArrayIterator<T> {
    let index = 0;
    while (index < this.maxValidIndex) {
      yield this.getValueAt(index);
      index++;
    }
  }
}
