import * as utils from './function.util'

describe('v2/utils/function.utils', () => {
  describe('retry()', () => {
    describe('when conditional returns true on each retry', () => {
      it('should retry the configured number of times', async () => {
        const conditional = () => true
        const expectedCount = 5
        const fn = jest.fn().mockImplementation(() => {
          throw new Error('expected error')
        })

        let err: Error | null = null
        try {
          await utils.retry(fn, conditional, expectedCount)
        } catch (error) {
          err = error as Error
        } finally {
          expect(fn).toHaveBeenCalledTimes(expectedCount)
          expect(err).toBeInstanceOf(Error)
        }
      })

      it('should default the configured number of times to 3', async () => {
        const conditional = () => true
        const fn = jest.fn().mockImplementation(() => {
          throw new Error('expected error')
        })

        try {
          await utils.retry(fn, conditional)
        } catch (_) {
          // ignore
        } finally {
          expect(fn).toHaveBeenCalledTimes(3)
        }
      })
    })

    describe('when conditional returns false', () => {
      it('should retry until conditional returns false', async () => {
        let iteration = 0
        const conditional = () => iteration < 2
        const expectedCount = 2
        const fn = jest.fn().mockImplementation(() => {
          iteration += 1
          throw new Error('expected error')
        })

        try {
          await utils.retry(fn, conditional, expectedCount)
        } finally {
          expect(fn).toHaveBeenCalledTimes(expectedCount)
        }
      })
    })
  })
})
