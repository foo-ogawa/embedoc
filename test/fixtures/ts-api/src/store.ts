/**
 * Options of a {@link Store}.
 * @category Core
 */
export interface StoreOptions {
  /** Name of the store. */
  name: string;
  /**
   * Maximum number of items.
   * @default 100
   */
  limit?: number;
  /** @internal */
  secret?: string;
}

/**
 * A key-value store.
 *
 * @example Basic use
 * ```ts
 * @decorated()
 * class Model {}
 * const store = new Store<string>({ name: 'a' });
 *   store.set('k', 'v');
 * ```
 * @category Core
 */
export class Store<T> {
  /** Number of stores created. */
  static count = 0;
  private items = new Map<string, T>();
  protected readonly options: StoreOptions;

  /**
   * Create a store.
   * @param options - Store options
   * @param label - Display label
   */
  constructor(options: StoreOptions, public readonly label = 'store') {
    this.options = options;
  }

  /** Number of items. */
  get size(): number {
    return this.items.size;
  }

  /**
   * Read a value.
   * @param key - The key
   * @returns The value, or undefined
   */
  get(key: string): T | undefined;
  /**
   * Read a value with a fallback.
   * @param key - The key
   * @param fallback - Returned when the key is missing
   */
  get(key: string, fallback: T): T;
  get(key: string, fallback?: T): T | undefined {
    return this.items.get(key) ?? fallback;
  }

  /** Write a value. See {@link Store.get} and {@link greet}. */
  set(key: string, value: T): this {
    this.items.set(key, value);
    return this;
  }

  /**
   * Create a store with default options.
   * @typeParam V - Type of the values
   */
  static create<V>(name: string): Store<V> {
    return new Store<V>({ name });
  }

  /** @internal */
  reset(): void {
    this.items.clear();
  }
}
