/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('./utils/log.util')

function fail(reason = 'fail was called in a test.') {
  throw new Error(reason)
}

// declare module '@sort/config' {
//   interface Config {
//     DB_FIELD_ENCRYPTION_KEY: string
//     IS_TEST_ENV: boolean
//   }
// }

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - missing jest function
global.fail = fail

export {}
