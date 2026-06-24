export type ApiResult<T> =
  | { type: "success"; data: T }
  | { type: "error"; message: string; code?: number }
  | { type: "canceled" };
