/** An identifier. */
export type Id = string & { readonly brand: 'Id' };

/**
 * Say hello.
 * @param name - Who to greet
 * @returns The greeting
 * @deprecated Use a template string.
 */
export function greet(name: string): string {
  return `Hello, ${name}`;
}

/** Add two numbers. @category Math */
export const add = (a: number, b = 1): number => a + b;

/** Create an id. */
export const makeId: (raw: string) => Id = (raw) => raw as Id;

/** Settings object. */
export const settings = {
  /** Whether verbose output is on. */
  verbose: false,
  /** Output width. */
  width: 80,
};

/** Colors. */
export enum Color {
  /** Red */
  Red = 'red',
  Green = 'green',
}

/** @internal */
export function hiddenHelper(): void {}
