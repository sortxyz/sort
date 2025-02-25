import { getConfig, createKysely, disconnectKysely, logger } from '../'
import * as connectionMocks from '../mocks/connection.mock'
import { ConnectionMock } from '../mocks/connection.mock'

import * as ConnectionUtils from './connection.util'

import type { ConnectionSelectWithEncryption } from '../types/kysely/connection/connection.type'

describe('connection.utils', () => {
  const connMock = new ConnectionMock()
  let snowflakeConnectionMock: ConnectionSelectWithEncryption
  let testUnlockConnectionMock: ConnectionSelectWithEncryption

  let tests: {
    dataProvider: 'snowflake' | 'vps'
    connection: ConnectionSelectWithEncryption
    parse: (connectionString: string) => unknown
  }[]

  beforeAll(() => {
    createKysely({ config: getConfig(), sortLogger: logger })

    snowflakeConnectionMock = connMock.createSnowflakeHybridConnection(
      connectionMocks.snowflakeConnectionMockPartial
    )

    testUnlockConnectionMock = connMock.createSnowflakeHybridConnection({
      ...connectionMocks.snowflakeConnectionMockPartial,
      connection_string: getConfig().TEST_SNOWFLAKE_UNLOCK_CONNECTION_STRING!
    })

    connMock.add(snowflakeConnectionMock)

    tests = [
      // Sort internal testing
      {
        dataProvider: 'snowflake' as const,
        connection: snowflakeConnectionMock,
        parse: (connectionString: string): unknown =>
          ConnectionUtils.parseSnowflakeConnectionString(connectionString)
      },
      {
        dataProvider: 'snowflake' as const,
        connection: testUnlockConnectionMock,
        parse: (connectionString: string): unknown =>
          ConnectionUtils.parseSnowflakeConnectionString(connectionString)
      }
    ]
  })

  afterAll(async () => {
    await connMock.removeAll()
    await disconnectKysely()
  })

  describe('#parseSnowflakeConnectionString', () => {
    it('should parse snowflake connection string', async () => {
      const { dataProvider: _, connection, parse } = tests[0]
      const decryptedString = await connection.connection_string.decrypt()
      const parsed = parse(decryptedString)
      expect(parsed).toHaveProperty('database')
      expect(parsed).toHaveProperty('account')
      expect(parsed).toHaveProperty('user')
      expect(parsed).toHaveProperty('password')
    })

    it('should parse unlock connection string', async () => {
      const { dataProvider: _, connection, parse } = tests[1]
      const decryptedString = await connection.connection_string.decrypt()
      const parsed = parse(decryptedString)
      expect(parsed).toHaveProperty('database')
      expect(parsed).toHaveProperty('account')
      expect(parsed).toHaveProperty('user')
      expect(parsed).toHaveProperty('password')
    })
  })

  describe('#changeDatabaseOfConnectionString', () => {
    describe('postgres', () => {
      it('should change the database name of a connection string', () => {
        const changedStr = ConnectionUtils.changeDatabaseOfConnectionString({
          connectionString:
            connectionMocks.postgresConnectionMock.connection_string,
          dbName: 'test',
          dataProvider: 'postgres'
        })
        expect(changedStr).toEqual(
          'postgres://root:dbadmin@localhost:5432/test'
        )
      })

      it('should change the database name of a connection string w/ query params', () => {
        const changedStr = ConnectionUtils.changeDatabaseOfConnectionString({
          connectionString:
            connectionMocks.postgresConnectionMock.connection_string +
            '?ssl=true&sslmode=verify-full',
          dbName: 'test',
          dataProvider: 'postgres'
        })
        expect(changedStr).toEqual(
          'postgres://root:dbadmin@localhost:5432/test?ssl=true&sslmode=verify-full'
        )
      })

      it('should change the database name of a connection string w/ query params and postgressql://', () => {
        const changedStr = ConnectionUtils.changeDatabaseOfConnectionString({
          connectionString:
            connectionMocks.postgresConnectionMock.connection_string.replace(
              'postgres://',
              'postgresql://'
            ) + '?ssl=true&sslmode=verify-full',
          dbName: 'test',
          dataProvider: 'postgres'
        })
        expect(changedStr).toEqual(
          'postgresql://root:dbadmin@localhost:5432/test?ssl=true&sslmode=verify-full'
        )
      })
    })

    describe('snowflake', () => {
      const connectionString =
        getConfig().TEST_SNOWFLAKE_UNLOCK_CONNECTION_STRING!

      it('should change the database name of a connection string', () => {
        const changedStr = ConnectionUtils.changeDatabaseOfConnectionString({
          connectionString,
          dbName: 'ichanged',
          dataProvider: 'snowflake'
        })
        expect(changedStr).toEqual(
          connectionString.replace(/Database=[^;]+/i, 'Database=ichanged')
        )
      })

      it('should change the database name of a connection string w/ query params', () => {
        const expected = `${connectionString.replace(/Database=[^;]+/i, 'Database=ichanged')}?ssl=true&sslmode=verify-full`

        const changedStr = ConnectionUtils.changeDatabaseOfConnectionString({
          connectionString: `${connectionString}?ssl=true&sslmode=verify-full`,
          dbName: 'ichanged',
          dataProvider: 'snowflake'
        })
        expect(changedStr).toEqual(expected)
      })
    })
  })

  describe('#createPg7Pool', () => {
    it('should return a working Pool', () => {
      const pool = ConnectionUtils.createPg7Pool(
        connectionMocks.postgresConnectionMock.connection_string,
        false
      )

      expect(pool).toBeDefined()
      expect(pool.options).toEqual({
        allowExitOnIdle: false,
        connectionString:
          connectionMocks.postgresConnectionMock.connection_string,
        connectionTimeoutMillis:
          getConfig().USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS,
        idleTimeoutMillis: 10000,
        max: 5,
        maxLifetimeSeconds: 0,
        maxUses: Infinity
      })
    })

    it('should return a working Pool with some baseOptions', () => {
      const pool = ConnectionUtils.createPg7Pool(
        connectionMocks.postgresConnectionMock.connection_string,
        false,
        { max: 100 }
      )

      expect(pool).toBeDefined()
      expect(pool.options).toEqual({
        allowExitOnIdle: false,
        connectionString:
          connectionMocks.postgresConnectionMock.connection_string,
        connectionTimeoutMillis:
          getConfig().USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS,
        idleTimeoutMillis: 10000,
        max: 100,
        maxLifetimeSeconds: 0,
        maxUses: Infinity
      })
    })

    it('should return a working Pool with ssl', () => {
      const pool = ConnectionUtils.createPg7Pool(
        connectionMocks.postgresConnectionMock.connection_string,
        true
      )

      expect(pool).toBeDefined()
      expect(pool.options).toEqual({
        allowExitOnIdle: false,
        connectionString:
          connectionMocks.postgresConnectionMock.connection_string,
        connectionTimeoutMillis:
          getConfig().USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS,
        idleTimeoutMillis: 10000,
        max: 5,
        maxLifetimeSeconds: 0,
        maxUses: Infinity,
        ssl: {
          rejectUnauthorized: false,
          requestCert: true
        }
      })
    })
  })

  describe('#Utils.buildConnectionString', () => {
    it('should build a connection string', () => {
      const url = ConnectionUtils.buildConnectionString({
        data_provider: 'postgres',
        database: 'paddle',
        host: 'konami',
        password: 'b#tcoin',
        port: 5432,
        user: 'w^$ :D 3#2'
      })

      expect(url).toEqual(
        'postgres://w%5E%24%20%3AD%203%232:b%23tcoin@konami:5432/paddle'
      )
    })
  })
})
