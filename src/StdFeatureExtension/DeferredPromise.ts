import type { Mutable } from '../Typescript/Generics';

export class DeferredPromise<T> extends Promise<T> {
  public readonly resolve!: (value: T | PromiseLike<T>) => void;
  public readonly reject!: (reason?: any) => void;

  constructor(executor: (resolve: (value: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void = () => { }) {
    let res: (value: T | PromiseLike<T>) => void;
    let rej: (reason?: any) => void;
    super((resolve, reject) => {
      res = resolve;
      rej = reject;
      executor(resolve, reject);
    });

    this.resolve = function (
      this: Mutable<DeferredPromise<T>>,
      value: T | PromiseLike<T>
    ) {
      this.resolve = res;
      return res(value);
    };

    this.reject = function (
      this: Mutable<DeferredPromise<T>>,
      value: T | PromiseLike<T>
    ) {
      this.reject = rej;
      return rej(value);
    };
  }

  static override get [Symbol.species]() {
    return Promise;
  }
}
