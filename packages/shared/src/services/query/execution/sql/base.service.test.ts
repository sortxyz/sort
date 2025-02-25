import { createKysely, getDb, disconnectKysely } from '../../../..'
import { ConnectionMock } from '../../../../mocks/connection.mock'
import { OrganizationMock } from '../../../../mocks/org.mock'
import { UserMock } from '../../../../mocks/user.mock'
import * as ConnectionService from '../../../connection.service'
import * as OrganizationService from '../../../org.service'
import * as UserService from '../../../user.service'

import { BaseSqlQueryService } from './base.service'

import type * as QueryExecutionSchema from '../../../../schemas/query-execution.schema'
import type * as ConnectionType from '../../../../types/kysely/connection/connection.type'

/* eslint-disable @typescript-eslint/no-unused-vars */

class SqlQueryServiceMock extends BaseSqlQueryService {
  protected executeSql(
    sqlQuery: string,
    readonlyConnection: ConnectionType.ConnectionSelectWithEncryption,
    database: string
  ): Promise<QueryExecutionSchema.QueryExecutionResponse> {
    return Promise.resolve({
      records: [],
      columns: [],
      query: '',
      duration_ms: 0
    })
  }
}

describe('Tests for Base SQL Query Execution', () => {
  const userMock = new UserMock()
  const connMock = new ConnectionMock()
  const orgMock = new OrganizationMock()

  const user = userMock.create()
  const org = orgMock.create({
    created_by: user.id
  })

  const readonlyConn = connMock.create({
    organization_id: org.id,
    created_by: user.id
  })

  const conn = connMock.create({
    organization_id: org.id,
    created_by: user.id,
    readonly_connection_id: readonlyConn.id
  })

  const conn2 = connMock.create({
    organization_id: org.id,
    created_by: user.id
  })

  beforeAll(async () => {
    createKysely()

    await UserService.createUser(user)
    await OrganizationService.create(org)
    await ConnectionService.create(readonlyConn)
    await ConnectionService.create(conn)
    await ConnectionService.create(conn2)
  })

  afterAll(async () => {
    await connMock.removeAll()
    await getDb()
      .deleteFrom('organization_user')
      .where('user_id', 'in', [user.id])
      .execute()
    await orgMock.removeAll()
    await userMock.removeAll()

    await disconnectKysely()
  })

  it('execute should return a SQL query response', async () => {
    const sqlQueryService = new SqlQueryServiceMock(conn)
    const response = await sqlQueryService.execute('some-db', {
      type: 'sql',
      sql: 'SELECT * FROM table'
    })

    expect(response).toEqual({
      records: [],
      columns: [],
      query: '',
      duration_ms: 0
    })
  })

  it('execute should only allow SQL queries', async () => {
    const sqlQueryService = new SqlQueryServiceMock(conn)
    const response = sqlQueryService.execute('some-db', {
      type: 'intent',
      intent: {
        dml: 'SELECT',
        schema: 'public',
        table: 'snapshot',
        columns: ['id'],
        combinator: 'AND',
        filters: [{ column: 'id', op: '=', value: '8238238' }],
        orders: [{ column: 'id', direction: 'ASC' }],
        limit: 100
      }
    })

    await expect(response).rejects.toThrow('Invalid query type')
  })

  it('execute should only allow connections with a child read_only connection', async () => {
    const sqlQueryService = new SqlQueryServiceMock(conn2)
    const response = sqlQueryService.execute('some-db', {
      type: 'sql',
      sql: 'SELECT * FROM table'
    })

    await expect(response).rejects.toThrow(
      `No read-only connection found for connection "${conn2.name}". Please add a read-only connection.`
    )
  })

  it('execute should only allow connections with a valid, child read_only connection', async () => {
    jest.spyOn(ConnectionService, 'getById').mockResolvedValueOnce(undefined)
    const sqlQueryService = new SqlQueryServiceMock(conn)
    const response = sqlQueryService.execute('some-db', {
      type: 'sql',
      sql: 'SELECT * FROM table'
    })

    await expect(response).rejects.toThrow(
      `Error trying to find read-only connection for ${conn.name}.`
    )
  })
})
