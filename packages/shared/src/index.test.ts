import { getConfig, createKysely, getDb, disconnectKysely } from '.'

const createMockSortLogger = () => {
  return {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(),
    bindings: jest.fn(),
    level: 'info'
  }
}

describe('Kysely', () => {
  it('should not be set on app start', async () => {
    expect(getDb).toThrow('You must run createKysely() before getDb()')
  })

  describe('#createKysely', () => {
    afterEach(async () => {
      await disconnectKysely()
    })

    it('should initialize db', async () => {
      createKysely()
      expect(getDb()).toBeDefined()
    })

    it('should be a postgres datasource', async () => {
      createKysely({
        config: getConfig(),
        sortLogger: createMockSortLogger()
      })

      expect(getDb().introspection.constructor.name).toBe(
        'PostgresIntrospector'
      )
    })

    it('should emit a successful log message on initialization', async () => {
      const logger = createMockSortLogger()

      createKysely({
        config: { ...getConfig(), IS_TEST_ENV: true },
        sortLogger: logger
      })

      expect(logger.info).toHaveBeenLastCalledWith('kysely: created connection')
    })
  })

  describe('#disconnectKysely', () => {
    it('should close the db connection', async () => {
      createKysely()
      const dbDestroySpy = jest.spyOn(getDb(), 'destroy')
      await disconnectKysely()
      expect(dbDestroySpy).toHaveBeenCalledTimes(1)
    })

    it('should clear the state of the db', async () => {
      createKysely()
      expect(getDb()).toBeDefined()
      await disconnectKysely()
      expect(getDb).toThrow('You must run createKysely() before getDb()')
    })

    it('should emit a successful log message on disconnect', async () => {
      const logger = createMockSortLogger()
      createKysely({
        config: { ...getConfig(), IS_TEST_ENV: true },
        sortLogger: logger
      })

      await disconnectKysely()
      expect(logger.info).toHaveBeenLastCalledWith(
        'kysely: destroyed connection'
      )
    })
  })
})
