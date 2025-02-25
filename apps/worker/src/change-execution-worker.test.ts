import { ChangeExecutionWorker } from './change-execution-worker'
import { logger } from './config/bootstrap'

describe('worker tests', () => {
  it('shuts down gracefully', async () => {
    const info = jest.spyOn(logger, 'info')
    const worker = new ChangeExecutionWorker()
    await worker.start()
    await worker.stop()
    expect(info).toHaveBeenCalledWith('Stopping change execution cron jobs..')
    expect(info).toHaveBeenCalledWith(
      'Finished stopping change execution cron jobs'
    )
    expect(info).toHaveBeenCalledWith('Fastify successfully closed!')
    expect(info).toHaveBeenCalledWith('kysely: destroyed connection')
  })
})
