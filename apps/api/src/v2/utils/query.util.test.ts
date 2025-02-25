import { randomUUID } from 'node:crypto'

import {
  ConnectionMock,
  snowflakeConnectionMockPartial
} from '@sort/shared/mocks/connection.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import { PostgresIntentQueryService } from '@sort/shared/services/query/execution/intent/postgres.service'
import { SnowflakeIntentQueryService } from '@sort/shared/services/query/execution/intent/snowflake.service'
import { PostgresSqlQueryService } from '@sort/shared/services/query/execution/sql/postgres.service'
import * as UserService from '@sort/shared/services/user.service'

import { config } from '../../config/bootstrap'
import {
  createKysely,
  getDb,
  disconnectKysely
} from '../../global/services/kysely.service'

import { createQueryExecutionService } from './query.util'

describe('Tests for query util', () => {
  const userMock = new UserMock()
  const connMock = new ConnectionMock()
  const orgMock = new OrganizationMock()

  const user = userMock.create()
  const user2 = userMock.create()
  const org = orgMock.create({
    created_by: user.id
  })
  const readonlyPgConn = connMock.create({
    organization_id: org.id,
    created_by: user.id
  })
  const pgConn = connMock.create({
    organization_id: org.id,
    created_by: user.id,
    readonly_connection_id: readonlyPgConn.id
  })
  const readonlySnowflakeConn = connMock.create({
    ...snowflakeConnectionMockPartial,
    organization_id: org.id,
    created_by: user.id
  })
  const snowflakeConn = connMock.create({
    ...snowflakeConnectionMockPartial,
    id: randomUUID(),
    readonly_connection_id: readonlySnowflakeConn.id,
    organization_id: org.id,
    created_by: user.id
  })

  beforeAll(async () => {
    createKysely()

    const snowflakeConnStr = config.TEST_SNOWFLAKE_HYBRID_CONNECTION_STRING

    const readonlySnowflakeConn = connMock.create({
      ...snowflakeConnectionMockPartial,
      connection_string: snowflakeConnStr,
      organization_id: org.id,
      created_by: user.id
    })
    const snowflakeConn = connMock.create({
      ...snowflakeConnectionMockPartial,
      connection_string: snowflakeConnStr,
      id: randomUUID(),
      readonly_connection_id: readonlySnowflakeConn.id,
      organization_id: org.id,
      created_by: user.id
    })

    await UserService.createUser(user)
    await UserService.createUser(user2)
    await OrganizationService.create(org)
    await ConnectionService.create(readonlyPgConn)
    await ConnectionService.create(pgConn)
    await ConnectionService.create(readonlySnowflakeConn)
    await ConnectionService.create(snowflakeConn)
  })

  afterAll(async () => {
    await connMock.removeAll()
    await getDb()
      .deleteFrom('organization_user')
      .where('user_id', 'in', [user.id, user2.id])
      .execute()
    await orgMock.removeAll()
    await userMock.removeAll()

    await disconnectKysely()
  })

  describe.each([pgConn, snowflakeConn])(
    'query execution service for connection $data_provider',
    conn => {
      it('should return an intent query execution service', async () => {
        const queryExecutionService = await createQueryExecutionService(
          conn,
          'intent'
        )

        if (conn.data_provider === 'postgres') {
          expect(queryExecutionService).toBeInstanceOf(
            PostgresIntentQueryService
          )
        } else if (conn.data_provider === 'snowflake') {
          expect(queryExecutionService).toBeInstanceOf(
            SnowflakeIntentQueryService
          )
        } else {
          throw new Error('invalid data provider')
        }
      })
      it('should return an sql query execution service', async () => {
        if (conn.data_provider === 'postgres') {
          const queryExecutionService = await createQueryExecutionService(
            conn,
            'sql'
          )
          expect(queryExecutionService).toBeInstanceOf(PostgresSqlQueryService)
        } else if (conn.data_provider === 'snowflake') {
          // ignore for now - snowflake PR coming
        } else {
          throw new Error('invalid data provider')
        }
      })
    }
  )
})
