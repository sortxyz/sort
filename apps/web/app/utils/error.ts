import { isNonNullableObject } from "./object";

export function getErrorMessage(error: unknown) {
  if (typeof error === "string") {
    return error;
  }
  if (
    error &&
    isNonNullableObject(error) &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  console.error("Unable to get error message for error", error);
  return "Unknown Error";
}

export function assert(
  condition: unknown,
  message = "Assertion Failed",
  options?: ErrorOptions,
): asserts condition {
  if (!condition) {
    throw new Error(message, options);
  }
}

export function assertKey<T extends object, K extends keyof T>(
  obj: T,
  key: K,
  message = `Key ${String(key)} does not exist in object`,
  options?: ErrorOptions,
): asserts obj is T & Record<K, NonNullable<T[K]>> {
  assert(obj[key] !== undefined || obj[key] !== null, message, options);
}

export function assertKeys<T extends object, K extends keyof T>(
  obj: T,
  keys: K[],
  message?: string,
  options?: ErrorOptions,
): asserts obj is T & { [Key in K]: NonNullable<T[Key]> } {
  for (const key of keys) {
    assertKey(obj, key, message, options);
  }
}
