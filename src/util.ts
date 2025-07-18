export const NEVER = void 0 as never;


export function isNumber(arg: any): boolean {
  if(typeof arg === "number")
    return true;

  if(typeof arg !== "string")
    return false;

  if((/^0x[0-9a-f]+$/i).test(arg))
    return true;

  return (/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/).test(arg);
}


export function randomString(length: number = 16, special?: boolean | "underscore"): string {
  const base = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0987654321";
  const specials = special === "underscore" ? "-_" : "!@#$%&*()-_=+çÇ,.;:/?\\[]{}";
  const alphabet = strShuffle(base + (special ? specials : ""));
  
  let result: string = "";

  do {
    result = "";

    for(let i = 0; i < length; i++) {
      result += choose(alphabet);
    }
  } while(result[0] === "0");

  return result;
}


export function isBase64(str: unknown): str is string {
  if(!str || typeof str !== "string") return false;

  try {
    // eslint-disable-next-line no-useless-escape
    const base64Regex = /^(?:[A-Za-z0-9+\/]{4})*?(?:[A-Za-z0-9+\/]{2}==|[A-Za-z0-9+\/]{3}=)?$/;
    return (str.length % 4 === 0 && base64Regex.test(str)) || btoa(atob(str)) === str;
  } catch {
    return false;
  }
}


export function strShuffle(str: string): string {
  const arr = str.split("");

  for(let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr.join("");
}


export function choose<T>(arr: T[]): T;
export function choose(str: string): string;
export function choose<T>(val: T[] | string): T | string {
  return val[Math.floor(Math.random() * val.length - 1)];
}


export function isIterable<T>(arg: unknown): arg is Iterable<T> {
  return !!arg && typeof arg === "object" && typeof (arg as any)[Symbol.iterator] === "function";
}

export function isAsyncIterable<T>(arg: unknown): arg is Iterable<T> {
  return !!arg && typeof arg === "object" && typeof (arg as any)[Symbol.asyncIterator] === "function";
}


export function immediate<TArgs extends any[]>(callback: (...args: TArgs) => void, ...args: TArgs): { dispose(): void } & Disposable {
  const hasNativeMethod = typeof setImmediate === "function";
  const id = hasNativeMethod ? setImmediate(callback, ...args) : setTimeout(callback, 0, ...args);

  return {
    dispose() {
      if(hasNativeMethod) {
        clearImmediate(id as NodeJS.Immediate);
      } else {
        clearTimeout(id as NodeJS.Timeout);
      }
    },

    [Symbol.dispose]() {
      if(hasNativeMethod) {
        clearImmediate(id as NodeJS.Immediate);
      } else {
        clearTimeout(id as NodeJS.Timeout);
      }
    },
  };
}


export function maskBuffer(buffer: Uint8Array, mask: number | Uint8Array): Uint8Array {
  const input = new Uint8Array(buffer);
  const output = new Uint8Array(input.length);

  const isArrayMask = mask instanceof Uint8Array;
  const maskLength = isArrayMask ? mask.length : 1;

  for(let i = 0; i < input.length; i++) {
    const maskByte = isArrayMask ? mask[i % maskLength] : mask;
    output[i] = input[i] ^ maskByte;
  }

  return output;
}


export function concatBuffers(...u8: Uint8Array[]): Uint8Array {
  const len = u8.reduce((acc, curr) => {
    acc += curr.length;
    return acc;
  }, 0);

  const target = new Uint8Array(len);
  let offset: number = 0;

  for(let i = 0; i < u8.length; i++) {
    target.set(u8[i], offset);
    offset += u8[i].length;
  }

  return target;
}



export function timingSafeEqual(a: Uint8Array | string, b: Uint8Array | string): boolean {
  const toBytes = (val: Uint8Array | string) => val instanceof Uint8Array ? val : getEncoder().encode(val);
  const buffers = [ toBytes(a), toBytes(b) ];

  if(buffers[0].length !== buffers[1].length)
    return false;

  let c: number = 0;

  for(let i = 0; i < buffers[0].length; i++) {
    c |= buffers[0][i] ^ buffers[1][i];
  }

  return c === 0;
}


let te: TextEncoder | null = null;

function getEncoder(r: boolean = false): TextEncoder {
  if(!te) {
    te = new TextEncoder();
  }

  if(r) {
    te = new TextEncoder();
  }

  return te;
}
