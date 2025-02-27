export function difference<T>(setA: Set<T>, setB: Set<T>): Set<T> {
  const result = new Set<T>();
  for (const value of setA) {
    if (!setB.has(value)) {
      result.add(value);
    }
  }
  return result;
}
