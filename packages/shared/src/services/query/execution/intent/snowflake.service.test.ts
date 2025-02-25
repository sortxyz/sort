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

import { SnowflakeIntentQueryService } from './snowflake.service'

import type * as QueryExecutionSchema from '../../../../schemas/query-execution.schema'
import type { ConnectionSelectWithEncryption } from '../../../../types/kysely/connection/connection.type'

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Tests for Snowflake Intent Query Execution', () => {
  const userMock = new UserMock()
  const connMock = new ConnectionMock()
  const orgMock = new OrganizationMock()
  const snapshotMocks = new SnapshotMock()

  const user = userMock.create()
  const user2 = userMock.create()
  const org = orgMock.create({
    created_by: user.id
  })
  let conn: ConnectionSelectWithEncryption

  beforeAll(async () => {
    createKysely()
    conn = connMock.createSnowflakeHybridConnection({
      ...snowflakeConnectionMockPartial,
      id: randomUUID(),
      organization_id: org.id,
      created_by: user.id
    })

    await UserService.createUser(user)
    await UserService.createUser(user2)
    await OrganizationService.create(org)
    await ConnectionService.create(conn)

    const ssis = new SnowflakeSchemaImportService(conn)

    const log = createFastifyMockLogger()
    const ssId = await ssis.importSchema(user.id, log)

    snapshotMocks.push(ssId)
  }, 25000)

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
  }, 25000)

  describe('#snowflakeSvc', () => {
    it('should return a bunch of rows from one of our tables', async () => {
      const intentQuery = {
        type: 'intent',
        intent: {
          dml: 'SELECT',
          schema: 'PUBLIC',
          table: 'BANK_ROUTING',
          columns: ['BANK_ID', 'ADDRESS', 'CITY', 'FED_ID'],
          combinator: 'AND',
          filters: [],
          orders: [{ column: 'BANK_ID', direction: 'ASC' }],
          limit: 100
        }
      } satisfies QueryExecutionSchema.Query

      const querySvc = new SnowflakeIntentQueryService(conn)
      const result = await querySvc.execute('FED_BANKS', intentQuery)

      expect(result).toBeDefined()

      expect(result.columns.length).toEqual(4)
      expect(result.duration_ms).toBeGreaterThan(0)
      expect(result.query).toEqual(
        '\n' +
          '      SELECT\n' +
          '        "BANK_ID", "ADDRESS", "CITY", "FED_ID"\n' +
          '      FROM\n' +
          '        "FED_BANKS"."PUBLIC"."BANK_ROUTING"\n' +
          '      \n' +
          '       ORDER BY\n' +
          '"BANK_ID" ASC\n' +
          '      LIMIT $1'
      )
      expect(result.records.length).toBe(100)
    }, 15000)

    it('supports running queries on more than one database within the connection', async () => {
      const querySvc = new SnowflakeIntentQueryService(conn)

      const intentQuery1 = {
        type: 'intent',
        intent: {
          dml: 'SELECT',
          columns: ['BANK_ID'],
          schema: 'PUBLIC',
          table: 'BANK_ROUTING',
          combinator: 'AND',
          filters: [],
          orders: [{ column: 'BANK_ID', direction: 'ASC' }],
          limit: 1
        }
      } satisfies QueryExecutionSchema.Query

      const result1 = await querySvc.execute('FED_BANKS', intentQuery1)

      expect(result1).toEqual({
        columns: [{ name: 'BANK_ID', type: 'string' }],
        duration_ms: expect.any(Number),
        query: expect.any(String),
        records: [
          [
            '011000015O0110000150122415000000000FEDERAL RESERVE BANK                '
          ]
        ]
      })

      const intentQuery2 = {
        type: 'intent',
        intent: {
          dml: 'SELECT',
          columns: ['C_CUSTKEY'],
          schema: 'TPCH_SF1',
          table: 'CUSTOMER',
          combinator: 'AND',
          filters: [{ column: 'C_CUSTKEY', op: '=', value: '60000' }],
          orders: [{ column: 'C_CUSTKEY', direction: 'DESC' }],
          limit: 1
        }
      } satisfies QueryExecutionSchema.Query

      const result2 = await querySvc.execute(
        'SNOWFLAKE_SAMPLE_DATA',
        intentQuery2
      )

      expect(result2).toEqual({
        columns: [{ name: 'C_CUSTKEY', type: 'numeric' }],
        duration_ms: expect.any(Number),
        query: expect.any(String),
        records: [[60000]]
      })
    }, 25000)

    it('should return varying types from one of our tables', async () => {
      const intentQuery = {
        type: 'intent',
        intent: {
          dml: 'SELECT',
          schema: 'TPCDS_SF10TCL',
          table: 'WEB_SITE',
          columns: [
            'WEB_CITY',
            'WEB_CLASS',
            'WEB_GMT_OFFSET',
            'WEB_REC_END_DATE',
            'WEB_TAX_PERCENTAGE'
          ],
          combinator: 'AND',
          filters: [],
          orders: [{ column: 'WEB_SITE_SK', direction: 'ASC' }],
          limit: 100
        }
      } satisfies QueryExecutionSchema.Query
      const querySvc = new SnowflakeIntentQueryService(conn)
      const result = await querySvc.execute(
        'SNOWFLAKE_SAMPLE_DATA',
        intentQuery
      )
      expect(result).toEqual({
        columns: [
          { name: 'WEB_CITY', type: 'string' },
          { name: 'WEB_CLASS', type: 'string' },
          { name: 'WEB_GMT_OFFSET', type: 'numeric' },
          { name: 'WEB_REC_END_DATE', type: 'date' },
          { name: 'WEB_TAX_PERCENTAGE', type: 'numeric' }
        ],
        duration_ms: expect.any(Number),
        query: expect.stringMatching(/^.*SELECT.*FROM.*ORDER BY.*/gims),
        records: expect.anything()
      })
    }, 15000)
  })
})
