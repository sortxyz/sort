import * as WorkerBase from './worker.base'

export class MockWorker extends WorkerBase.WorkerBase {
  async runWorker() {
    return
  }
}

describe('Tests for the worker base', () => {
  describe('Worker start', () => {
    let worker: MockWorker

    beforeEach(() => {
      worker = new MockWorker()
    })

    afterEach(async () => {
      await worker.stop()
      jest.clearAllMocks()
    })

    it('Runs the worker after the prestart', async () => {
      const runWorkerSpy = jest.spyOn(worker, 'runWorker')
      const prestartWorkerSpy = jest.spyOn(worker, 'prestartWorker')

      await worker.start()

      expect(runWorkerSpy).toHaveBeenCalledTimes(1)
      expect(prestartWorkerSpy).toHaveBeenCalledTimes(1)

      expect(prestartWorkerSpy.mock.invocationCallOrder).toEqual([1])
      expect(runWorkerSpy.mock.invocationCallOrder).toEqual([2])
    })
  })
})
