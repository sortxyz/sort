export const objectKeysWithType = Object.keys as <T>(
  o: T
) => Extract<keyof T, string | number>[]
