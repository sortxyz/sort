/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('./global/utils/log.util')

function fail(reason = 'fail was called in a test.') {
  throw new Error(reason)
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - missing jest function
global.fail = fail

export {}
