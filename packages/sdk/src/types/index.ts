export type Json =
  | Json[]
  | { [key: string | number]: Json }
  | (string | number | boolean | null);

export type TypedRequestInit<T> = Omit<RequestInit, "body"> & {
  body: T;
};

export type TypedResponse<T = unknown> = Omit<Response, "json"> & {
  json(): Promise<T>;
};
