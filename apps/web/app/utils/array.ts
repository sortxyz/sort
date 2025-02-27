export function findLast<T, S extends T>(
  predicate: (value: T, index: number, array: T[]) => value is S,
  arr: T[],
): S | undefined;

export function findLast<T>(
  callback: (value: T, index: number, array: T[]) => boolean,
  arr: T[],
) {
  const len = arr.length;
  for (let i = len - 1; i >= 0; i--) {
    if (callback(arr[i]!, i, arr)) {
      return arr[i];
    }
  }
  return undefined;
}

export function updateItemAtIndex<T>(value: T, index: number, array: T[]): T[] {
  if (index < 0 || index >= array.length) {
    throw new RangeError("Index out of bounds");
  }
  const copy = array.slice();
  copy[index] = value;
  return copy;
}
