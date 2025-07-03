import { AssertionError } from "./errors";


export function assert(c: unknown, msg?: string): asserts c {
  if(!c) {
    throw new AssertionError(msg ?? `Assertation failed for 'typeof ${typeof c}'`);
  }
}
