import * as snowflake from 'snowflake-sdk'

import { createKysely, getConfig, logger } from '../../'
import { PublicFacingError } from '../../errors/public-facing.error'
import {
  ConnectionMock,
  snowflakeConnectionMockPartial
} from '../../mocks/connection.mock'
import {
  changeDatabaseOfConnectionString,
  parseSnowflakeConnectionString
} from '../../utils'
import * as SnowflakeUtils from '../../utils/snowflake/sql.util'

import { SnowflakeService } from './snowflake.service'

import type { ConnectionSelect } from '../../types/kysely/connection/connection.type'

/* eslint-disable @typescript-eslint/no-unused-vars */

describe('Tests for Snowflake Service', () => {
  describe('Tests for Snowflake Connection', () => {
    const connMock = new ConnectionMock()
    let snowflakeConnectionMock: ConnectionSelect

    beforeAll(async () => {
      createKysely()

      const unlockConnStr = getConfig().TEST_SNOWFLAKE_UNLOCK_CONNECTION_STRING!
      const testUser = getConfig().TEST_SNOWFLAKE_HYBRID_USER!

      snowflakeConnectionMock =
        await connMock.createSnowflakeHybridConnectionRaw(
          snowflakeConnectionMockPartial
        )

      // we need to clear the state of the snowflake user before running tests that fail the user/password because
      // snowflake will lock a user that has a number of failed attempts in a 15-20 minute window
      const connectionString = parseSnowflakeConnectionString(unlockConnStr)

      const connection = snowflake.createConnection({
        account: connectionString.account,
        username: connectionString.user,
        password: connectionString.password,
        database: connectionString.database,
        warehouse: 'COMPUTE_WH'
      })

      await connection.connectAsync((err, conn) => {
        if (err) throw new Error('Failed to connect to Snowflake')
        conn.execute({
          sqlText: `USE ROLE ACCOUNTADMIN; ALTER USER ${testUser} SET MINS_TO_UNLOCK = 0;`
        })
      })
    }, 20000)

    describe('createFn', () => {
      it('Should create a new SnowflakeService instance', async () => {
        const connection = new SnowflakeService(snowflakeConnectionMock)

        expect(connection).toBeDefined()
      })
    })

    describe('#createConnection', () => {
      it('Should return a DB if called once', async () => {
        const connection = new SnowflakeService(snowflakeConnectionMock)
        const db = await connection.createPool()

        expect(db).toBeDefined()
      }, 20000)

      it('Should store a DB', async () => {
        const connection = new SnowflakeService(snowflakeConnectionMock)
        const db = await connection.createPool()

        expect(connection.pool).toBeDefined()

        expect(db).toBe(connection.pool)
      }, 20000)

      it('Should not create another DB connection if a DB connection was already created', async () => {
        const connection = new SnowflakeService(snowflakeConnectionMock)

        await connection.tryCreateConnection()

        jest.spyOn(connection, 'testCredentials').mockImplementationOnce(() => {
          throw new Error('Should not be called')
        })

        await connection.createPool()
      }, 20000)

      it('Should not crash Snowflake connection creation with invalid credentials', async () => {
        const snowflakeConnStr = parseSnowflakeConnectionString(
          snowflakeConnectionMock.connection_string
        )
        const connection = new SnowflakeService({
          ...snowflakeConnectionMock,
          connection_string: snowflakeConnectionMock.connection_string.replace(
            snowflakeConnStr.password,
            'invalid'
          )
        })

        try {
          await connection.tryCreateConnection()
          fail('Should throw error')
        } catch (e) {
          expect(e).toBeInstanceOf(Error)
          const err = e as Error
          expect(err.message).toBe(
            'Incorrect username or password was specified.'
          )
        }
      }, 25000)
    })

    describe('#tryCreateConnection', () => {
      it('Should test connection mock and return true', async () => {
        const debugSpy = jest.spyOn(logger, 'debug')
        const connection = new SnowflakeService(snowflakeConnectionMock)

        const conn = await connection.tryCreateConnection()
        expect(conn).toEqual({
          connection_string: snowflakeConnectionMock.connection_string,
          visibility: snowflakeConnectionMock.visibility,
          with_ssl: snowflakeConnectionMock.with_ssl,
          warehouse: snowflakeConnectionMock.warehouse
        })
        expect(debugSpy).toHaveBeenCalledWith(
          expect.stringMatching(/^Successfully connected to/)
        )
      }, 20000)

      it('Should throw an error when running the test query fails', async () => {
        const debugSpy = jest.spyOn(logger, 'debug')
        const connection = new SnowflakeService(snowflakeConnectionMock)

        jest
          .spyOn(SnowflakeUtils, 'executeStatement')
          .mockImplementation(
            ({ reject }: { reject: (reason: Error) => void }) => {
              reject(new Error('Connection error'))
            }
          )

        try {
          await connection.tryCreateConnection()
          fail('Should throw error')
        } catch (e) {
          expect(e).toBeInstanceOf(Error)
          const err = e as Error
          expect(err.message).toBe('Connection error')
        }

        expect(debugSpy).not.toHaveBeenCalled()
      }, 20000)

      it('Should throw when invalid warehouse provided', async () => {
        const connection = new SnowflakeService({
          ...snowflakeConnectionMock,
          warehouse: 'INVALID'
        })

        try {
          await connection.tryCreateConnection()
        } catch (error) {
          expect(error).toBeInstanceOf(PublicFacingError)
          const err = error as PublicFacingError
          expect(err.message).toBe(
            'Warehouse "INVALID" does not exist or is not accessible to this user.'
          )
        }
      }, 20000)

      it('Should throw when invalid database name provided', async () => {
        const connection = new SnowflakeService({
          ...snowflakeConnectionMock,
          connection_string: changeDatabaseOfConnectionString({
            connectionString: snowflakeConnectionMock.connection_string,
            dbName: 'invalid-db',
            dataProvider: 'snowflake'
          })
        })

        try {
          await connection.tryCreateConnection()
        } catch (error) {
          expect(error).toBeInstanceOf(PublicFacingError)
          const err = error as PublicFacingError
          expect(err.message).toBe('Database "invalid-db" not found.')
        }
      }, 20000)
    })
  })
})
