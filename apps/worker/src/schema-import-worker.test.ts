import { logger } from './config/bootstrap'
import { SchemaImportWorker } from './schema-import-worker'

describe('worker tests', () => {
  it('shuts down gracefully', async () => {
    const info = jest.spyOn(logger, 'info')
    const worker = new SchemaImportWorker()
    await worker.start()
    await worker.stop()
    expect(info).toHaveBeenCalledWith('Stopping schema import cron jobs..')
    expect(info).toHaveBeenCalledWith(
      'Finished stopping schema import cron jobs'
    )
    expect(info).toHaveBeenCalledWith('Fastify successfully closed!')
    expect(info).toHaveBeenCalledWith('kysely: destroyed connection')
  })
})
