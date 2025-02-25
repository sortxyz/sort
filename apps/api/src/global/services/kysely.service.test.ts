import * as KyselyService from './kysely.service'

describe('Kysely', () => {
  it('should not be set on app start', async () => {
    expect(KyselyService.getDb).toThrow(
      'You must run createKysely() before getDb()'
    )
  })

  describe('#createKysely', () => {
    afterEach(async () => {
      await KyselyService.disconnectKysely()
    })

    it('should initialize db', async () => {
      KyselyService.createKysely()

      expect(KyselyService.getDb()).toBeDefined()
    })

    it('should be a postgres datasource', async () => {
      KyselyService.createKysely()

      expect(KyselyService.getDb().introspection.constructor.name).toBe(
        'PostgresIntrospector'
      )
    })
  })

  describe('#disconnectKysely', () => {
    beforeEach(async () => {
      KyselyService.createKysely()
    })

    it('should close the db connection', async () => {
      const dbDestroySpy = jest.spyOn(KyselyService.getDb(), 'destroy')

      await KyselyService.disconnectKysely()

      expect(dbDestroySpy).toHaveBeenCalledTimes(1)
    })

    it('should clear the state of the db', async () => {
      expect(KyselyService.getDb()).toBeDefined()

      await KyselyService.disconnectKysely()

      expect(KyselyService.getDb).toThrow(
        'You must run createKysely() before getDb()'
      )
    })
  })
})
