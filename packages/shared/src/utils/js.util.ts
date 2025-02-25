export const toNumber = (
  value: string | undefined,
  fallback: number
): number => {
  const val = Number(value)
  return Number.isNaN(val) ? fallback : val
}
