import { ERROR_CODE, Exception } from "tnetlib-client";


enum EC {
  C = 0xA10,
  UE = 0xA11,
  UOP = 0xA12,
  AE = 0xA13,
  IA = 0xA14,
}


export type ErrorOptions = {
  overrideStack?: string;
};


export class RuntimeError extends Exception {
  public override readonly code: number;

  public constructor(
    message?: string,
    ec?: number | keyof typeof ERROR_CODE | keyof typeof EC,
    options?: ErrorOptions // eslint-disable-line comma-dangle
  ) {
    super(message ?? "", void 0, options);
    this.code = -EC.C;

    if(typeof ec === "number") {
      this.code = -Math.abs(ec);
    } else if(ec && ec in ERROR_CODE) {
      this.code = -ERROR_CODE[ec as keyof typeof ERROR_CODE];
    } else if(ec && ec in EC) {
      this.code = -EC[ec as keyof typeof EC];
    } else {
      this.code = -EC.UE;
    }
  }

  public override getErrorCode(): string {
    switch(-this.code) {
      case EC.C:
        return "ERR_TOKEN_CANCELLED";
      default:
        return "ERR_UNKNOWN_ERROR";
    }
  }

  public override is(code: number | keyof typeof ERROR_CODE | keyof typeof EC): boolean {
    if(typeof code === "number")
      return this.code === -Math.abs(code);

    if(code in EC)
      return this.code === -EC[code as keyof typeof EC];

    if(code in ERROR_CODE)
      return this.code === -ERROR_CODE[code as keyof typeof ERROR_CODE];

    return false;
  }
}


export class CancellationError extends RuntimeError {
  public constructor(message?: string, options?: ErrorOptions) {
    super(message, EC.C, options);
  }
}

export class UnsupportedOperationError extends RuntimeError {
  public constructor(message?: string, options?: ErrorOptions) {
    super(message, EC.UOP, options);
  }
}

export class AssertionError extends RuntimeError {
  public constructor(message?: string, options?: ErrorOptions) {
    super(message, EC.AE, options);
  }
}

export class InvalidArgumentError extends RuntimeError {
  public constructor(message?: string, options?: ErrorOptions) {
    super(message, EC.IA, options);
  }
}
