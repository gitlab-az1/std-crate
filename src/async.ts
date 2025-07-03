export interface CancelablePromise<T> extends Promise<T> {
  cancel(reason?: any): void;
}
