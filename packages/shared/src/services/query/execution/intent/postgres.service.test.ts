/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createKysely, disconnectKysely, getConfig, getDb } from '../../../..'
import {
  ConnectionMock,
  airQualityPostgresConnectionMockPartial
} from '../../../../mocks/connection.mock'
import { createFastifyMockLogger } from '../../../../mocks/fastify-logger.mock'
import { OrganizationMock } from '../../../../mocks/org.mock'
import { SnapshotMock } from '../../../../mocks/snapshot/snapshot.mock'
import { UserMock } from '../../../../mocks/user.mock'
import * as ConnectionService from '../../../connection.service'
import * as OrganizationService from '../../../org.service'
import { PostgresSchemaImportService } from '../../../schema-import/pg/schema-import.service'
import * as UserService from '../../../user.service'

import { PostgresIntentQueryService } from './postgres.service'

import type * as QueryExecutionSchema from '../../../../schemas/query-execution.schema'
import type { ConnectionSelectWithEncryption } from '../../../../types/kysely/connection/connection.type'

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Tests for Postgres Intent Query Execution', () => {
  const userMock = new UserMock()
  const connMock = new ConnectionMock()
  const orgMock = new OrganizationMock()
  const snapshotMocks = new SnapshotMock()

  const user = userMock.create()
  const user2 = userMock.create()
  const org = orgMock.create({
    created_by: user.id
  })
  const conn = connMock.create({
    organization_id: org.id,
    created_by: user.id
  })
  let airQualityConn: ConnectionSelectWithEncryption

  beforeAll(async () => {
    createKysely()

    const airQualityConnStr =
      getConfig().TEST_POSTGRES_AIR_QUALITY_CONNECTION_STRING!

    airQualityConn = connMock.create({
      connection_string: airQualityConnStr,
      with_ssl: airQualityPostgresConnectionMockPartial.with_ssl,
      created_by: user.id,
      organization_id: org.id
    })

    await UserService.createUser(user)
    await UserService.createUser(user2)
    await OrganizationService.create(org)
    await ConnectionService.create(conn)
    await ConnectionService.create(airQualityConn)
  })

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
  })

  describe('#postgres7Service', () => {
    it('should return a bunch of rows from one of our tables', async () => {
      const pg = new PostgresSchemaImportService(conn)

      const log = createFastifyMockLogger()
      const ssId = await pg.importSchema(user.id, log)

      snapshotMocks.push(ssId)

      const intentQuery = {
        type: 'intent',
        intent: {
          dml: 'SELECT',
          schema: 'public',
          table: 'user',
          columns: ['id', 'email', 'username', 'administrator', 'name'],
          combinator: 'AND',
          filters: [
            { column: 'email', op: '=', value: user.email! },
            { column: 'name', op: '=', value: user.name! }
          ],
          orders: [{ column: 'id', direction: 'ASC' }],
          limit: 100
        }
      } satisfies QueryExecutionSchema.Query

      const querySvc = new PostgresIntentQueryService(conn)
      const result = await querySvc.execute('sort_xyz', intentQuery)

      expect(result).toEqual({
        columns: [
          { name: 'id', type: 'string' },
          { name: 'email', type: 'string' },
          { name: 'username', type: 'string' },
          { name: 'administrator', type: 'boolean' },
          { name: 'name', type: 'string' }
        ],
        duration_ms: expect.any(Number),
        query: expect.stringMatching(/^.*SELECT.*FROM.*WHERE.*ORDER BY.*/gims),
        records: [
          [user.id, user.email, user.username, user.administrator, user.name]
        ]
      })
    })

    it('supports running queries on more than one database within the connection', async () => {
      const pg = new PostgresSchemaImportService(airQualityConn)
      const querySvc = new PostgresIntentQueryService(airQualityConn)

      const log = createFastifyMockLogger()
      const ssId = await pg.importSchema(user.id, log)
      snapshotMocks.push(ssId)

      const intentQuery1 = {
        type: 'intent',
        intent: {
          dml: 'SELECT',
          columns: ['form_id'],
          schema: 'public',
          table: 'samples',
          combinator: 'AND',
          filters: [{ column: 'form_id', op: '=', value: '102609731' }],
          orders: [],
          limit: 1
        }
      } satisfies QueryExecutionSchema.Query

      const result1 = await querySvc.execute('chicken_testing', intentQuery1)

      expect(result1).toEqual({
        columns: [{ name: 'form_id', type: 'numeric' }],
        duration_ms: expect.any(Number),
        query: expect.any(String),
        records: [[102609731]]
      })

      const intentQuery2 = {
        type: 'intent',
        intent: {
          dml: 'SELECT',
          columns: ['zipcode'],
          schema: 'public',
          table: 'zipcode_air_quality',
          combinator: 'AND',
          filters: [{ column: 'zipcode', op: '>', value: '30000' }],
          orders: [{ column: 'zipcode', direction: 'DESC' }],
          limit: 1
        }
      } satisfies QueryExecutionSchema.Query

      const result2 = await querySvc.execute('air_quality', intentQuery2)

      expect(result2).toEqual({
        columns: [{ name: 'zipcode', type: 'string' }],
        duration_ms: expect.any(Number),
        query: expect.any(String),
        records: [['94121']]
      })
    }, 90000)

    it('should return varying types from one of our tables', async () => {
      const pg = new PostgresSchemaImportService(conn)

      const log = createFastifyMockLogger()
      const ssId = await pg.importSchema(user.id, log)

      snapshotMocks.push(ssId)

      const intentQuery = {
        type: 'intent',
        intent: {
          dml: 'SELECT',
          schema: 'public',
          table: 'connection',
          columns: [
            'id',
            'organization_id',
            'data_provider',
            'connection_string',
            'with_ssl',
            'created_by',
            'created_at',
            'visibility',
            'warehouse',
            'name'
          ],
          combinator: 'AND',
          filters: [],
          orders: [{ column: 'id', direction: 'ASC' }],
          limit: 100
        }
      } satisfies QueryExecutionSchema.Query

      const querySvc = new PostgresIntentQueryService(conn)
      const result = await querySvc.execute('sort_xyz', intentQuery)

      expect(result).toEqual({
        columns: [
          { name: 'id', type: 'uuid' },
          { name: 'organization_id', type: 'uuid' },
          { name: 'data_provider', type: 'string' },
          { name: 'connection_string', type: 'string' },
          { name: 'with_ssl', type: 'boolean' },
          { name: 'created_by', type: 'string' },
          { name: 'created_at', type: 'date' },
          { name: 'visibility', type: 'string' },
          { name: 'warehouse', type: 'string' },
          { name: 'name', type: 'string' }
        ],
        duration_ms: expect.any(Number),
        query: expect.stringMatching(/^.*SELECT.*FROM.*ORDER BY.*/gims),
        records: expect.any(Array)
      })
    })
  })
})
