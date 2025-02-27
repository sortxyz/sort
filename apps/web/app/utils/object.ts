export function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

export function isNonNullableObject<T>(
  value: T,
): value is NonNullable<T> & object {
  return typeof value === "object" && isNonNullable(value);
}
