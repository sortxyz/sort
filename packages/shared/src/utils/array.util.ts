export const unsortedStringArraysEqual = (a: string[], b: string[]) => {
  if (a.length !== b.length) {
    return false
  }

  const sortedA = [...a].sort()
  const sortedB = [...b].sort()

  return sortedA.every((value, index) => value === sortedB[index])
}
