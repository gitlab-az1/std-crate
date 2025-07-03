import type { GenericFunction } from "tnetlib-client/@internals/_types";

import { uint_t } from "./defs";
import { RuntimeError } from "./errors";


export interface NativeData<T = unknown> {
  bigint: bigint;
  bool: boolean;
  func: GenericFunction;
  number: number;
  uint_t: uint_t;
  float: number;
  struct: Record<keyof T, T[keyof T]>;
  string: string;
  undefined: undefined;
  null: null;
  symbol: symbol;
  array: T[];
}


export function exclude<T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> {
  return Object.fromEntries( Object.entries(obj).filter(([key]) => !keys.includes(key as K)) ) as Omit<T, K>;
}


const kindOf = (cache => (thing: unknown) => {
  const str = Object.prototype.toString.call(thing);
  return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
})(Object.create(null));


export const kindOfTest = (type: string) => {
  type = type.toLowerCase();
  return (thing: unknown) => kindOf(thing) === type;
};


export function isPlainObject(val: any): boolean {
  if(Array.isArray(val)) return false;
  if(kindOf(val) !== "object" || typeof val !== "object") return false;

  const prototype = Object.getPrototypeOf(val);
  return (prototype === null || prototype === Object.prototype || Object.getPrototypeOf(prototype) === null) && !(Symbol.toStringTag in val) && !(Symbol.iterator in val);
}


export function static_cast<T>(arg: unknown): T { return arg as T; }


export function dynamic_cast<TK extends "array", T>(
  typeKey: TK,
  arg: unknown,
  validateArrayMember?: (val: unknown, idx: number) => val is T
): T[];

export function dynamic_cast<TK extends Exclude<keyof NativeData<T>, "array">, T extends NativeData[TK]>(
  typeKey: TK,
  arg: unknown
): NativeData[TK];

export function dynamic_cast<TK extends keyof NativeData, T extends NativeData[TK]>(
  typeKey: TK,
  arg: unknown,
  vam?: (v: unknown, i: number) => boolean // eslint-disable-line comma-dangle
): NativeData[TK] {
  switch(typeKey) {
    case "bigint": {
      if(typeof arg === "bigint")
        return arg as T;

      try {
        if(["boolean", "number", "string"].includes(typeof arg))
          return BigInt(arg as string | number | boolean) as T;
      } catch {
        throw new RuntimeError(`Cannot cast value "${String(arg)}" to 'typeof bigint'`);
      }

      throw new RuntimeError(`Cannot cast 'typeof ${typeof arg}' to 'typeof bigint'`);
    } break;
    case "bool":
      return Boolean(arg) as T;
    case "number": {
      if(typeof arg === "number")
        return arg as T;

      const n = Number(arg);

      if(isNaN(n)) {
        throw new RuntimeError(`Cannot cast value "${String(arg)}" to 'typeof number'`);
      }

      return n as T;
    } break;
    case "float": {
      if(typeof arg === "number" && !Number.isInteger(arg))
        return arg as T;

      let n = Number(arg);

      if(isNaN(n)) {
        throw new RuntimeError(`Cannot cast value "${String(arg)}" to 'typeof float'`);
      }

      if(Number.isInteger(n)) {
        n *= 1.0;
      }

      return n as T;
    } break;
    case "uint_t": {
      if(arg instanceof uint_t)
        return arg as T;

      const n = uint_t.of(arg);

      if(!n.isNumber()) {
        throw new RuntimeError(`Cannot cast value "${String(arg)}" to 'typeof uint_t'`);
      }

      return n as T;
    } break;
    case "string":
      return String(arg) as T;
    case "struct": {
      if(
        typeof arg === "object" &&
        !!arg && isPlainObject(arg)
      ) return arg as T;
      
      throw new RuntimeError(`Cannot cast 'typeof ${typeof arg}' to 'typeof struct'`);
    } break;
    case "array": {
      if(!Array.isArray(arg)) {
        if(typeof vam === "function" && vam(arg, 0))
          return [arg] as T;
        
        throw new RuntimeError(`Cannot cast value 'typeof ${typeof arg}' to 'typeof array'`);
      }

      if(typeof vam === "function") {
        for(let i = 0; i < arg.length; i++) {
          if(!vam(arg[i], i)) {
            throw new RuntimeError(`Cannot cast value "${String(arg[i])}" to 'typeof T[]'`);
          }
        }
      }

      return arg as T;
    } break;
    case "func": {
      if(typeof arg === "function")
        return arg as T;

      throw new RuntimeError(`Cannot cast 'typeof ${typeof arg}' to 'typeof func'`);
    } break;
    case "undefined": {
      if(
        typeof arg === "undefined" ||
        arg == undefined ||
        arg == void 0
      ) return void 0 as T;

      throw new RuntimeError("Cannot cast non-undefined value to 'typeof undefined'");
    } break;
    case "null": {
      if(arg == null)
        return null as T;

      throw new RuntimeError("Cannot cast non-null value to 'typeof undefined'");
    } break;
    case "symbol": {
      if(typeof arg === "symbol")
        return arg as T;

      throw new RuntimeError(`Cannot cast 'typeof ${typeof arg}' to 'typeof symbol'`);
    } break;
    default:
      throw new RuntimeError("Cannot cast unsupported target type to 'typeof __$typeof<unknown>");
  }
}


export function isInstance(thing: unknown): boolean {
  return (
    !!thing &&
    !isPlainObject(thing) &&
    Object.getPrototypeOf(thing) !== Object.prototype
  );
}
