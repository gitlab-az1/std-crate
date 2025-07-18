import { CancelableWithToken, CancellationTokenSource } from "tnetlib-client";

import { CancellationError } from "../errors";


export interface RequestOptions extends CancelableWithToken { }


class NetworkRequest {
  readonly #source: CancellationTokenSource;

  public constructor(options?: RequestOptions) {
    console.log("[ATTENTION] NetworkRequest is not fully implemented yet");
    this.#source = new CancellationTokenSource(options?.token);
  }

  public cancel(): void {
    this.#source.cancel(new CancellationError());
  }
}

export default NetworkRequest;
