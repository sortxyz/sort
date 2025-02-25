import * as Kysely from 'kysely'

import { createKysely, getDb, disconnectKysely } from '../../../..'
import { ConnectionMock } from '../../../../mocks/connection.mock'
import { OrganizationMock } from '../../../../mocks/org.mock'
import { UserMock } from '../../../../mocks/user.mock'
import * as ConnectionService from '../../../../services/connection.service'
import * as OrganizationService from '../../../../services/org.service'
import * as UserService from '../../../../services/user.service'

import { PostgresSqlQueryService } from './postgres.service'

import type * as QueryExecutionSchema from '../../../../schemas/query-execution.schema'

describe('Tests for Postgres SQL Query Execution', () => {
  const userMock = new UserMock()
  const connMock = new ConnectionMock()
  const orgMock = new OrganizationMock()

  const user = userMock.create()
  const user2 = userMock.create()
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

  beforeAll(async () => {
    createKysely()

    await UserService.createUser(user)
    await UserService.createUser(user2)
    await OrganizationService.create(org)
    await ConnectionService.create(readonlyConn)
    await ConnectionService.create(conn)
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

  it('should execute a simple query', async () => {
    const query: QueryExecutionSchema.Query = {
      type: 'sql',
      sql: `SELECT * FROM public.user WHERE id = '${user.id}' LIMIT 1`
    }

    const service = new PostgresSqlQueryService(conn)
    const result = await service.execute('sort_xyz', query)

    expect(result).toEqual({
      columns: [
        { name: 'id', type: 'string' },
        { name: 'username', type: 'string' },
        { name: 'username_discord', type: 'string' },
        { name: 'administrator', type: 'boolean' },
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'picture', type: 'string' },
        { name: 'password_reset_at', type: 'date' },
        { name: 'terms_accepted_at', type: 'date' },
        { name: 'login_count', type: 'numeric' },
        { name: 'email_verified', type: 'boolean' }
      ],
      records: [
        [
          user.id,
          user.username,
          user.username_discord,
          user.administrator,
          user.name,
          user.email,
          user.picture,
          user.password_reset_at,
          user.terms_accepted_at,
          user.login_count,
          user.email_verified
        ]
      ],
      duration_ms: expect.any(Number),
      query: `SELECT * FROM public.user WHERE id = '${user.id}' LIMIT 1`
    })
  })

  it('should support setting the search_path', async () => {
    const sql = 'set search_path to public; SELECT * FROM role WHERE id = 0'

    const query: QueryExecutionSchema.Query = {
      type: 'sql',
      sql
    }

    const service = new PostgresSqlQueryService(conn)
    const result = await service.execute('sort_xyz', query)

    expect(result).toEqual({
      columns: [
        { name: 'id', type: 'numeric' },
        { name: 'name', type: 'string' }
      ],
      records: [[0, 'owner']],
      duration_ms: expect.any(Number),
      query: sql
    })
  })

  it('should error on an invalid query', async () => {
    const query: QueryExecutionSchema.Query = {
      type: 'sql',
      sql: 'INSERT INTO users (id) VALUES (1)'
    }

    const service = new PostgresSqlQueryService(conn)
    const result = service.execute('sort_xyz', query)

    await expect(result).rejects.toThrowError(
      'Only SELECT statements are supported'
    )
  })

  describe('results', () => {
    beforeAll(async () => {
      const createTestData = Kysely.sql`
        CREATE TABLE IF NOT EXISTS test.truncate_results AS
        SELECT * FROM generate_series(1, 120)
      `
      await createTestData.execute(getDb())
    })

    afterAll(async () => {
      const createTestData = Kysely.sql`
        DROP TABLE IF EXISTS test.truncate_results
      `
      await createTestData.execute(getDb())
    })

    it('should be truncated at 100', async () => {
      const sql =
        'SELECT * FROM test.truncate_results where generate_series < 1000 limit 200'
      const query: QueryExecutionSchema.Query = {
        type: 'sql',
        sql
      }

      const service = new PostgresSqlQueryService(conn)
      const result = await service.execute('sort_xyz', query)

      expect(result).toEqual({
        columns: [{ name: 'generate_series', type: 'numeric' }],
        records: expect.any(Array),
        duration_ms: expect.any(Number),
        query: sql
      })
      expect(result.records.length).toBe(100)
    })
  })
})
