import { getConfig } from '../..'
import * as connectionMocks from '../../mocks/connection.mock'
import { ConnectionDataProviderNames } from '../../schemas/data-provider.schema'

import * as ConnectionService from './index'

import type { ConnectionServiceBase } from './base.service'
import type { Connection } from '../../schemas/connection.schema'

describe('#createConnectionService', () => {
  it.each(ConnectionDataProviderNames)(
    'should create a connection service for provider mock %p',
    dataProvider => {
      let mock: Connection | null = null
      switch (dataProvider) {
        case 'postgres':
          mock = connectionMocks.postgresConnectionMock
          break
        case 'snowflake':
          mock = {
            ...connectionMocks.snowflakeConnectionMockPartial,
            connection_string:
              getConfig().TEST_SNOWFLAKE_UNLOCK_CONNECTION_STRING!
          }
          break
        default:
          throw new Error('unsupported mock')
      }

      expect(mock).not.toBeNull()

      const connectionService = ConnectionService.createConnectionService(mock)

      expect(connectionService).toBeDefined()
    }
  )
})

describe('#retrieveWorkingConnection', () => {
  it('should not change a working connection string', async () => {
    jest.spyOn(ConnectionService, 'createConnectionService').mockReturnValue({
      tryCreateConnection: async () => connectionMocks.postgresConnectionMock
    } as unknown as ConnectionServiceBase<'postgres'>)

    const unchangedConnection =
      await ConnectionService.retrieveWorkingConnection(
        connectionMocks.postgresConnectionMock
      )
    expect(unchangedConnection).toEqual(connectionMocks.postgresConnectionMock)
  })

  it('should throw an error if connection test failed completely', async () => {
    jest.spyOn(ConnectionService, 'createConnectionService').mockReturnValue({
      tryCreateConnection: async () => {
        throw new Error('some-error')
      }
    } as unknown as ConnectionServiceBase<'postgres'>)

    try {
      await ConnectionService.retrieveWorkingConnection(
        connectionMocks.postgresConnectionMock
      )
    } catch (err) {
      const error = err as Error
      expect(/some-error/.test(error.message)).toBeTruthy()
    }
  })

  it('should change a connection string with new ssl params', async () => {
    jest.spyOn(ConnectionService, 'createConnectionService').mockReturnValue({
      tryCreateConnection: async () => ({
        warehouse: null,
        connection_string:
          connectionMocks.postgresConnectionMock.connection_string,
        with_ssl: true,
        visibility: 'private'
      })
    } as unknown as ConnectionServiceBase<'postgres'>)

    const changedConnection = await ConnectionService.retrieveWorkingConnection(
      connectionMocks.postgresConnectionMock
    )
    expect(changedConnection).toEqual({
      ...connectionMocks.postgresConnectionMock,
      with_ssl: true
    })
  })
})
