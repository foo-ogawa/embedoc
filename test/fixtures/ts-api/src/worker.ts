import type { Store } from './store.js';

/** A unit of work. */
export abstract class Worker {
  /** Identifier of the worker. */
  abstract readonly id: string;

  /** Run the work. */
  abstract run(): Promise<void>;
}

/** Read a key from the store bound as `this`. */
export function bound(this: Store<string>, key: string): string | undefined {
  return this.get(key);
}
