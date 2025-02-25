import { sql } from 'kysely'

import {
  createKysely,
  disconnectKysely,
  getConfig,
  getDb,
  logger
} from '../../'
import {
  postgresConnectionMock,
  airQualityPostgresConnectionMockPartial,
  ConnectionMock
} from '../../mocks/connection.mock'

import * as PostgresConnectionService from './postgres.service'

/* eslint-disable  @typescript-eslint/no-non-null-assertion */

describe('Tests for Postgres 7 Connection', () => {
  const connectionMock = new ConnectionMock()
  let airQualityConnString: string

  beforeAll(async () => {
    createKysely({ config: getConfig(), sortLogger: logger })
    airQualityConnString =
      getConfig().TEST_POSTGRES_AIR_QUALITY_CONNECTION_STRING!
  })
  afterAll(async () => {
    await disconnectKysely()
  })

  describe('createFn', () => {
    it('Should create a new PostgresService instance', async () => {
      const pgConnection = new PostgresConnectionService.PostgresService(
        postgresConnectionMock
      )

      expect(pgConnection).toBeDefined()
    })

    it('Should create a new PostgresService instance with postgresql://', async () => {
      const pgConnection = new PostgresConnectionService.PostgresService({
        ...postgresConnectionMock,
        connection_string: postgresConnectionMock.connection_string.replace(
          'postgres://',
          'postgresql://'
        )
      })

      expect(pgConnection).toBeDefined()
    })

    it('Should not create a connection on start', async () => {
      const ccSpy = jest.spyOn(
        PostgresConnectionService.PostgresService.prototype,
        // @ts-expect-error - createConnection is protected
        'createConnection'
      )
      new PostgresConnectionService.PostgresService(postgresConnectionMock)
      expect(ccSpy).not.toHaveBeenCalled()
    })

    it('Should not create a new PostgresService instance with a blank connection', async () => {
      const create = () =>
        new PostgresConnectionService.PostgresService({
          ...postgresConnectionMock,
          connection_string: ''
        })
      expect(create).toThrow('Connection string is missing for connection')
    })

    it('Should not create a new PostgresService instance with a SSL socket', async () => {
      const create = () =>
        new PostgresConnectionService.PostgresService({
          ...postgresConnectionMock,
          connection_string: 'socket:/var/run/pgsql'
        })
      expect(create).toThrow('Invalid connection string for connection')
    })

    describe.each(PostgresConnectionService.bannedHosts)(
      'with invalid host %j',
      host => {
        describe.each(['postgres://', 'postgresql://'])(
          'with protocol %s',
          protocol => {
            describe.each(['', 'user:pass@'])('with user/pass %s', userPass => {
              beforeEach(() => {
                getConfig().IS_TEST_ENV = false
              })
              afterEach(() => {
                getConfig().IS_TEST_ENV = true
              })

              it('should reject', () => {
                const hostname = host.startsWith
                  ? `${host.host}more`
                  : host.host

                const create = () =>
                  new PostgresConnectionService.PostgresService({
                    ...postgresConnectionMock,
                    connection_string: `${protocol}${userPass}${hostname}:5432/sort_xyz`
                  })
                expect(create).toThrow('Invalid host for connection')
              })
            })
          }
        )
      }
    )

    it.each(['sslcert', 'sslkey', 'sslrootcert'])(
      'Should not create a new PostgresService instance with a SSL socket',
      async disallowedSsl => {
        const create = () =>
          new PostgresConnectionService.PostgresService({
            ...postgresConnectionMock,
            connection_string: `${postgresConnectionMock.connection_string}?${disallowedSsl}=somevalue`
          })
        expect(create).toThrow(
          'SSL certificates are not supported for connection'
        )
      }
    )
  })

  describe('#createConnection', () => {
    it('Should return a DB if called once', async () => {
      const pgSvc = new PostgresConnectionService.PostgresService(
        postgresConnectionMock
      )
      // @ts-expect-error - createConnection is protected
      const db = await pgSvc.createConnection()

      expect(db).toBeDefined()
    })

    it('Should store a DB', async () => {
      const pgSvc = new PostgresConnectionService.PostgresService(
        postgresConnectionMock
      )
      // @ts-expect-error - createConnection is protected
      const db = await pgSvc.createConnection()

      // @ts-expect-error - db is protected, just for testing
      expect(pgSvc.db).toBe(db)
    })
  })

  describe('#tryCreateConnection', () => {
    it('Should test local connection mock and return connection string', async () => {
      const pgSvc = new PostgresConnectionService.PostgresService(
        postgresConnectionMock
      )
      const ping = await pgSvc.tryCreateConnection()
      expect(ping).toEqual({
        connection_string: postgresConnectionMock.connection_string,
        visibility: postgresConnectionMock.visibility,
        warehouse: null,
        with_ssl: false
      })
    })

    it('Should test remote connection mock and return connection string with ssl', async () => {
      const pgSvc = new PostgresConnectionService.PostgresService({
        ...airQualityPostgresConnectionMockPartial,
        connection_string: airQualityConnString
      })
      const ping = await pgSvc.tryCreateConnection()
      expect(ping).toEqual({
        connection_string: airQualityConnString,
        visibility: airQualityPostgresConnectionMockPartial.visibility,
        warehouse: null,
        with_ssl: true
      })
    })

    it('Should have a running db instance after test connection', async () => {
      const pgSvc = new PostgresConnectionService.PostgresService(
        postgresConnectionMock
      )
      await pgSvc.tryCreateConnection()

      // @ts-expect-error - db is protected, just for testing
      expect(pgSvc.db).not.toBeNull()

      // @ts-expect-error - db is protected, totalCount is not defined in node-pg typings, just for testing
      expect(pgSvc.db?.totalCount).toBe(1)
    })

    describe('import checks', () => {
      const connMockImportFailure = {
        ...connectionMock.create(),
        connection_string:
          'postgres://test_importability:test@localhost:5432/sort_xyz'
      }
      const connMockImportSuccess = postgresConnectionMock

      beforeAll(async () => {
        // create a connection which does not support reading from the metadata tables
        const cmd = sql`
        DO $do$
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'test_importability') THEN
            CREATE ROLE test_importability WITH LOGIN PASSWORD 'test';
          END IF;
        END $do$;
        `
        await cmd.execute(getDb())
      })

      afterAll(async () => {
        // drop our test role
        const cmd = sql`
          DO $do$
          BEGIN
            IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'test_importability') THEN
              DROP ROLE test_importability;
            END IF;
          END $do$;
        `
        await cmd.execute(getDb())
      })

      it('only succeeds if able to read from the metadata tables', async () => {
        const pgSvcFailure = new PostgresConnectionService.PostgresService(
          connMockImportFailure
        )
        const pingFailure = await pgSvcFailure.tryCreateConnection()
        expect(pingFailure).toBe(null)

        const pgSvcSuccess = new PostgresConnectionService.PostgresService(
          connMockImportSuccess
        )
        const pingSuccess = await pgSvcSuccess.tryCreateConnection()
        expect(pingSuccess).toEqual({
          connection_string: connMockImportSuccess.connection_string,
          visibility: connMockImportSuccess.visibility,
          warehouse: null,
          with_ssl: false
        })
      })
    })
  })

  describe('#closeConnection', () => {
    it('Should close connection', async () => {
      const pgSvc = new PostgresConnectionService.PostgresService(
        postgresConnectionMock
      )

      // @ts-expect-error - createConnection is protected
      await pgSvc.createConnection()

      // @ts-expect-error - db is protected, ending is not defined in node-pg typings, just for testing
      expect(pgSvc.db!.ending).toBe(false)

      await pgSvc.closeConnection()

      // @ts-expect-error - db is protected, ending is not defined in node-pg typings, just for testing
      expect(pgSvc.db!.ending).toBe(true)
    })
  })
})
