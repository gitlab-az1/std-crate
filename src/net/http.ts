/* eslint-disable @typescript-eslint/no-namespace,no-inner-declarations */

import type { Dict } from "tnetlib-client/@internals/_types";

import {
  CancellationTokenSource,
  ICancellationToken,
  onUnexpected,
  type HttpHeaders,
  type HttpMethod,
} from "tnetlib-client";

import { isPlainObject } from "../object";
import { jsonSafeStringify } from "../safe-json";

import {
  CancellationError,
  InvalidArgumentError,
  UnsupportedOperationError,
} from "../errors";

import {
  concatBuffers,
  isAsyncIterable,
  isIterable,
  isNumber,
} from "../util";


const ERR_RESPONSE = new Response(null, { status: 500 });


namespace Http {
  export type Body = XMLHttpRequestBodyInit | number | boolean | unknown[] | Record<string, unknown> | Iterable<Uint8Array> | AsyncIterable<Uint8Array>;

  export interface HttpRequestInit {
    method?: HttpMethod;
    headers?: Iterable<[string, string | string[] | undefined]> | HttpHeaders;
    params?: Body;
    onProgress?: (event: ProgressEvent<any>) => unknown;
    errorHandler?: (err: Error) => unknown;
    timeout?: number;
    username?: string;
    password?: string;
    withCredentials?: boolean;
    $charset?: string;
    signal?: AbortSignal;
    token?: ICancellationToken;
  }

  export async function query(url: string | URL, options?: HttpRequestInit): Promise<Response> {
    const errorHandler = options?.errorHandler ?? onUnexpected;

    let ro: XMLHttpRequest | null = null;

    try {
      ro = new XMLHttpRequest();
      // eslint-disable-next-line no-empty
    } catch { }

    if (!ro) {
      errorHandler(new UnsupportedOperationError("The current environment does not support implementations of 'typeof XMLHttpRequest'"));
      return ERR_RESPONSE;
    }

    if (options?.signal && options.token) {
      errorHandler(new InvalidArgumentError("Cannot use both abort signal and cancellation token"));
      return ERR_RESPONSE;
    }

    const source = new CancellationTokenSource(options?.token);

    options?.signal?.addEventListener("abort", reason => {
      source.cancel(reason);
    });
    
    source.token.onCancellationRequested(() => {
      ro.abort();
    });

    if (options?.signal?.aborted) {
      source.cancel();
    }

    if (source.token.isCancellationRequested) {
      errorHandler(new CancellationError());
      return ERR_RESPONSE;
    }

    try {
      let u: string = url.toString();
      const method = options?.method ?? "GET";

      if (!supportsBody(method)) {
        const hi = u.indexOf("#");
        const h = hi >= 0 ? u.slice(hi + 1) : null;

        const qs = parseQueryParams(u);

        if (typeof options?.params === "object" && isPlainObject(options.params)) {
          for (const prop in options.params) {
            if (!Object.prototype.hasOwnProperty.call(options.params, prop))
              continue;

            qs[prop] = String(options.params[prop as keyof typeof options.params]);
          }
        }

        let ou = u.split("?")[0];

        if (Object.keys(qs).length > 0) {
          const parts: string[] = [];

          for (const prop in qs) {
            parts.push(`${encodeURIComponent(prop)}=${encodeURIComponent(String(qs[prop]))}`);
          }

          ou += `?${parts.join("&")}`;
        }

        if (h != null && h.length > 0) {
          ou += `#${h.replace(/^#/, "")}`;
        }

        u = ou;
      }

      ro.open(method.toUpperCase(), u, true, options?.username, options?.password);
      ro.responseType = "arraybuffer";

      if (options?.withCredentials) {
        ro.withCredentials = true;
      }

      if (typeof options?.timeout === "number" && options.timeout > 1) {
        ro.timeout = options.timeout | 0;
      }

      if (isIterable(options?.headers)) {
        for (const [key, value] of options.headers) {
          if (!value)
            continue;

          for (const v of Array.isArray(value) ? value : [value]) {
            ro.setRequestHeader(key.trim(), v);
          }
        }
      } else if (!!options?.headers && typeof options.headers === "object" && isPlainObject(options.headers)) {
        for (const prop in options.headers) {
          if (!Object.prototype.hasOwnProperty.call(options.headers, prop))
            continue;

          if (!options.headers[prop])
            continue;

          const values = Array.isArray(options.headers[prop]) ?
            options.headers[prop] :
            [options.headers[prop]];

          for (let i = 0; i < values.length; i++) {
            ro.setRequestHeader(prop.trim(), values[i]);
          }
        }
      }

      if (isIterable(options?.params) || isAsyncIterable(options?.params)) {
        const c: Uint8Array[] = [];

        for await (const chunk of options.params as Iterable<Uint8Array>) {
          c.push(chunk);
        }

        const b = concatBuffers(...c);

        ro.setRequestHeader("Content-Type", "application/octet-stream");
        ro.setRequestHeader("Content-Length", b.byteLength.toString());

        options.params = b;
      } else {
        if (
          supportsBody(method) &&
          !isNonStreamBody(options?.params) &&
          typeof options?.params !== "undefined" &&
          options.params != null
        ) {
          const str = jsonSafeStringify(options.params);

          if (str.isRight()) {
            ro.setRequestHeader("Content-Type", `application/json${options.$charset ? ("; charset=" + options.$charset) : ""}`);
            ro.setRequestHeader("Content-Length", str.value.length.toString());

            options.params = str.value;
          }
        }

        if (typeof FormData !== "undefined" && options?.params instanceof FormData) {
          ro.setRequestHeader("Content-Type", "multipart/form-data");
        }

        if (typeof URLSearchParams !== "undefined" && options?.params instanceof URLSearchParams) {
          ro.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
          ro.setRequestHeader("Content-Length", options.params.toString().length.toString());
        }
      }

      if (options?.onProgress && typeof options.onProgress === "function") {
        ro.onprogress = options.onProgress;
      }

      const body = supportsBody(method) ?
        options?.params as XMLHttpRequestBodyInit :
        null;

      return await new Promise<Response>((resolve, reject) => {
        ro.onabort = reject;
        ro.onerror = reject;

        source.token.onCancellationRequested(r => {
          reject(new CancellationError(String(r)));
        });

        ro.onreadystatechange = () => {
          if ((ro as any).readyState === "complete" || ro.readyState === 4) {
            if (source.token.isCancellationRequested) {
              reject(new CancellationError());
              return;
            }

            resolve(createResponse(ro.response, {
              status: ro.status,
              statusText: ro.statusText,
              headers: extractXHRHeaders(ro),
            }));
          }
        };

        ro.send(body);
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        errorHandler(new CancellationError());
      } else {
        errorHandler(err);
      }

      return ERR_RESPONSE;
    }
  }

  export async function $fetch(url: string | URL, options?: HttpRequestInit): Promise<Response> {
    const errorHandler = options?.errorHandler ?? onUnexpected;

    if (typeof fetch !== "function") {
      errorHandler(new UnsupportedOperationError("The current environment does not support the Fetch API"));
      return ERR_RESPONSE;
    }

    if (options?.signal && options.token) {
      errorHandler(new InvalidArgumentError("Cannot use both abort signal and cancellation token"));
      return ERR_RESPONSE;
    }

    const source = new CancellationTokenSource(options?.token);
    options?.signal?.addEventListener("abort", reason => source.cancel(reason));

    if (options?.signal?.aborted) {
      source.cancel();
    }

    if (source.token.isCancellationRequested) {
      errorHandler(new CancellationError());
      return ERR_RESPONSE;
    }

    try {
      const method = options?.method?.toUpperCase() ?? "GET";
      let u = url.toString();

      const init: RequestInit = {
        method,
        headers: {},
        credentials: options?.withCredentials ? "include" : "same-origin",
        signal: undefined,
      };

      const abortController = new AbortController();

      source.token.onCancellationRequested(() => abortController.abort());
      init.signal = abortController.signal;

      const headers = new Headers();

      if (isIterable(options?.headers)) {
        for (const [key, value] of options.headers) {
          if (!value)
            continue;

          for (const v of Array.isArray(value) ? value : [value]) {
            headers.append(key.trim(), v);
          }
        }
      } else if (isPlainObject(options?.headers)) {
        for (const key in options?.headers) {
          if (!options?.headers[key])
            continue;

          const value = options.headers[key];

          for (const v of Array.isArray(value) ? value : [value]) {
            headers.append(key.trim(), v);
          }
        }
      }

      let body: BodyInit | undefined;

      if (!supportsBody(method)) {
        const query = parseQueryParams(u);

        if (typeof options?.params === "object" && isPlainObject(options.params)) {
          for (const key in options.params) {
            query[key] = String(options.params[key as keyof typeof options.params]);
          }
        }

        const [base, hash] = u.split("#");
        const [path] = base.split("?");
        const searchParams = new URLSearchParams();

        for (const [key, value] of Object.entries(query)) {
          searchParams.set(key, String(value));
        }

        u = path + (searchParams.toString() ? `?${searchParams}` : "") + (hash ? `#${hash}` : "");
      } else {
        const p = options?.params;

        if (isIterable(p) || isAsyncIterable(p)) {
          const chunks: Uint8Array[] = [];

          for await (const chunk of p as Iterable<Uint8Array>) {
            chunks.push(chunk);
          }

          const concatenated = concatBuffers(...chunks);
          body = concatenated;
          headers.set("Content-Type", "application/octet-stream");
        } else if (isNonStreamBody(p)) {
          body = p as BodyInit;
        } else if (typeof p !== "undefined" && p !== null) {
          const str = jsonSafeStringify(p);

          if (str.isRight()) {
            body = str.value;
            headers.set("Content-Type", `application/json${options?.$charset ? ("; charset=" + options.$charset) : ""}`);
          }
        }
      }

      init.headers = headers;

      if (supportsBody(method)) {
        init.body = body;
      }

      const res = await fetch(u, init);

      return createResponse(await res.arrayBuffer(), {
        status: res.status,
        statusText: res.statusText,
        headers: Array.from(res.headers.entries()),
      });
    } catch (err: any) {
      if (err.name === "AbortError") {
        errorHandler(new CancellationError());
      } else {
        errorHandler(err);
      }

      return ERR_RESPONSE;
    }
  }


  export function supportsBody(method?: string | { method: string }): boolean {
    if (!method)
      return false;

    const noBodyMethods = ["GET", "HEAD", "DELETE", "OPTIONS"];

    if (typeof method === "string")
      return !noBodyMethods.includes(method.toUpperCase());

    if (typeof method !== "object" || !("method" in method))
      return false;

    return !noBodyMethods.includes(method.method.toUpperCase());
  }

  export function parseQueryParams(url: string): Dict<string | number | boolean | null> {
    const r: Dict<string | number | boolean | null> = {};
    const si = url.indexOf("?");

    if (si < 0)
      return r;

    const ei = url.indexOf("#", si);

    const qs = ei >= 0 ?
      url.slice(si + 1, ei) :
      url.slice(si + 1);

    const p = qs.split("&");

    for (let i = 0; i < p.length; i++) {
      if (!p[i])
        continue;

      const [rk, rv] = p[i].split("=");

      const k = decodeURIComponent(rk);
      const v = typeof rv === "string" && rv.length > 0 ?
        decodeURIComponent(rv) :
        true;

      if (
        typeof v === "boolean" ||
        ["true", "false"].includes(v)
      ) {
        r[k] = String(v) === "true";
      } else if (v === "null") {
        r[k] = null;
      } else if (isNumber(v)) {
        r[k] = Number(v);

        if (isNaN(r[k])) {
          r[k] = String(v);
        }
      } else {
        r[k] = v;
      }
    }

    return r;
  }

  export function isNonStreamBody(obj?: unknown): obj is XMLHttpRequestBodyInit {
    if (obj !== null && !(typeof obj === "string") && !obj)
      return false;

    if (
      obj === null ||
      typeof obj === "string" ||
      obj instanceof ArrayBuffer ||
      ArrayBuffer.isView(obj)
    ) return true;

    if (typeof Blob !== "undefined" && obj instanceof Blob)
      return true;

    if (typeof FormData !== "undefined" && obj instanceof FormData)
      return true;

    if (typeof URLSearchParams !== "undefined" && obj instanceof URLSearchParams)
      return true;

    return false;
  }

  export function createResponse(body?: BodyInit | null, options?: ResponseInit): Response {
    return new class extends Response {
      public override readonly ok: boolean;

      public constructor() {
        super(body, options);
        this.ok = false;

        if (typeof options?.status === "number") {
          this.ok = (options.status / 100 | 0) === 2;
        }
      }
    };
  }

  export function extractXHRHeaders(o: XMLHttpRequest): [string, string][] {
    const l = o.getAllResponseHeaders().trim().split(/[\n]+/);
    const h: [string, string][] = [];

    for (let i = 0; i < l.length; i++) {
      const [key, ...rest] = l[i].split(":");

      if (key.trim() && rest.length > 0) {
        h.push([key.trim(), rest.join(":").trim()]);
      }
    }

    return h;
  }
}

export default Http;
