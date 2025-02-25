/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { randomUUID } from 'node:crypto'

import { createKysely, disconnectKysely, getDb } from '../../../..'
import {
  ConnectionMock,
  snowflakeConnectionMockPartial
} from '../../../../mocks/connection.mock'
import { createFastifyMockLogger } from '../../../../mocks/fastify-logger.mock'
import { OrganizationMock } from '../../../../mocks/org.mock'
import { SnapshotMock } from '../../../../mocks/snapshot/snapshot.mock'
import { UserMock } from '../../../../mocks/user.mock'
import * as ConnectionService from '../../../connection.service'
import * as OrganizationService from '../../../org.service'
import { SnowflakeSchemaImportService } from '../../../schema-import/snowflake/schema-import.service'
import * as UserService from '../../../user.service'

import { SnowflakeSqlQueryService } from './snowflake.service'

import type * as QueryExecutionSchema from '../../../../schemas/query-execution.schema'

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Tests for Snowflake SQL Query Execution', () => {
  const userMock = new UserMock()
  const connMock = new ConnectionMock()
  const orgMock = new OrganizationMock()
  const snapshotMocks = new SnapshotMock()

  const user = userMock.create()
  const user2 = userMock.create()
  const org = orgMock.create({
    created_by: user.id
  })

  const readonlyConn = connMock.createSnowflakeHybridConnection({
    ...snowflakeConnectionMockPartial,
    id: randomUUID(),
    organization_id: org.id,
    created_by: user.id
  })
  connMock.add(readonlyConn)

  const conn = connMock.createSnowflakeHybridConnection({
    ...snowflakeConnectionMockPartial,
    readonly_connection_id: readonlyConn.id,
    id: randomUUID(),
    organization_id: org.id,
    created_by: user.id
  })
  connMock.add(conn)

  beforeAll(async () => {
    createKysely()

    await UserService.createUser(user)
    await UserService.createUser(user2)
    await OrganizationService.create(org)
    await ConnectionService.create(readonlyConn)
    await ConnectionService.create(conn)

    const ssis = new SnowflakeSchemaImportService(conn)

    const log = createFastifyMockLogger()
    const ssId = await ssis.importSchema(user.id, log)

    snapshotMocks.push(ssId)
  }, 20000)

  afterAll(async () => {
    await connMock.removeAll()
    await getDb()
      .deleteFrom('organization_user')
      .where('user_id', 'in', [user.id, user2.id])
      .execute()
    await orgMock.removeAll()
    await userMock.removeAll()
    await snapshotMocks.removeAll()

    await disconnectKysely()
  }, 20000)

  it('should return a bunch of rows from one of our tables', async () => {
    const sql =
      'SELECT BANK_ID, ADDRESS, CITY, FED_ID FROM PUBLIC.BANK_ROUTING ORDER BY BANK_ID ASC LIMIT 100'
    const query = {
      type: 'sql',
      sql
    } satisfies QueryExecutionSchema.Query

    const querySvc = new SnowflakeSqlQueryService(conn)
    const result = await querySvc.execute('FED_BANKS', query)

    expect(result).toBeDefined()

    expect(result.columns.length).toEqual(4)
    expect(result.duration_ms).toBeGreaterThan(0)
    expect(result.query).toEqual(sql)
    expect(result.records.length).toBe(100)
  }, 20000)

  it('should error on an invalid query', async () => {
    const query: QueryExecutionSchema.Query = {
      type: 'sql',
      sql: 'INSERT INTO users (id) VALUES (1)'
    }

    const service = new SnowflakeSqlQueryService(conn)
    const result = service.execute('sort_xyz', query)

    await expect(result).rejects.toThrow('Only SELECT statements are supported')
  }, 20000)

  it('should truncate results', async () => {
    const sql = 'select * from PUBLIC.BANK_ROUTING'
    const query: QueryExecutionSchema.Query = {
      type: 'sql',
      sql
    }

    const service = new SnowflakeSqlQueryService(conn)
    const result = await service.execute('FED_BANKS', query)

    expect(result).toEqual({
      columns: [
        { name: 'BANK_ID', type: 'string' },
        { name: 'ADDRESS', type: 'string' },
        { name: 'CITY', type: 'string' },
        { name: 'FED_ID', type: 'string' }
      ],
      records: expect.any(Array),
      duration_ms: expect.any(Number),
      query: sql
    })
    expect(result.records.length).toBe(100)
  }, 20000)
})
