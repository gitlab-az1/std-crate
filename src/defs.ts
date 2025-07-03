const $valueof = Symbol("kNumericValueOf");


export abstract class NumericValue {
  protected [$valueof]: number | null;

  protected constructor(
    _value?: number | null // eslint-disable-line comma-dangle
  ) {
    this[$valueof] = _value ?? null;
  }

  public gt(other?: N): boolean {
    const self = extractRuntimeValue(this);
    const ot = extractRuntimeValue(other);

    if(typeof self !== "number" || typeof ot !== "number")
      return false;

    return self > ot;
  }

  public ge(other?: N): boolean {
    const self = extractRuntimeValue(this);
    const ot = extractRuntimeValue(other);

    if(typeof self !== "number" || typeof ot !== "number")
      return false;

    return self >= ot;
  }

  public valueOf(s: true): number;
  public valueOf(s?: false): number | null;
  public valueOf(s?: boolean): number | null {
    return s ? this[$valueof] ?? 0 : this[$valueof];
  }
}

export class uint_t extends NumericValue {
  public static of(val?: any): uint_t {
    if(
      typeof val === "object" && !!val && 
      "valueOf" in val &&
      $valueof in val
    ) {
      val = extractRuntimeValue(val);
    }

    let n = typeof val !== "undefined" && val != null ?
      Number(val) : null;

    if(n != null && isNaN(n)) {
      n = null;
    }

    if(n != null && n < 0) {
      n = 0;
    }

    return new uint_t(typeof n === "number" ? n | 0 : n);
  }

  private constructor(_n?: number | null) {
    super(_n ?? null);
  }

  public add(other?: N): uint_t {
    const self = extractRuntimeValue(this) ?? 0;
    const ot = extractRuntimeValue(other) ?? 0;

    return uint_t.of((self + ot) | 0);
  }

  public eqadd(other?: N): this {
    const self = extractRuntimeValue(this) ?? 0;
    const ot = extractRuntimeValue(other) ?? 0;

    this[$valueof] = (self + ot) | 0;
    return this;
  }

  public isNumber(): boolean {
    return this[$valueof] != null;
  }
}


export function uint(val?: any): uint_t {
  return uint_t.of(val);
}


type N = number | { valueOf(): number | null | undefined } | { [$valueof]: number };

function extractRuntimeValue(o: N): number;
function extractRuntimeValue(o: null | N): number | null;
function extractRuntimeValue(o?: undefined | N): number | undefined;
function extractRuntimeValue(o?: undefined | null | N): number | null | undefined {
  if(typeof o === "number")
    return o;

  if(o === null)
    return o;

  if(typeof o === "undefined")
    return void 0;

  if(typeof o !== "object")
    return null;

  if(!o)
    return null;

  if($valueof in o) {
    // assert(o[$valueof] is number)
    return o[$valueof];
  }

  if("valueOf" in o && typeof o.valueOf === "function") {
    const e = o.valueOf();

    if(typeof e === "undefined")
      return void 0;

    if(e === null)
      return null;

    // assert(e is number)
    return e;
  }

  return null;
}
