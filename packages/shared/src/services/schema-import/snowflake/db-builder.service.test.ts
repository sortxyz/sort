import { createKysely, disconnectKysely } from '../../..'
import {
  ConnectionMock,
  snowflakeConnectionMockPartial
} from '../../../mocks/connection.mock'
import { OrganizationMock } from '../../../mocks/org.mock'
import { UserMock } from '../../../mocks/user.mock'
import * as ConnectionService from '../../connection.service'
import { SnowflakeService } from '../../customer-connection/snowflake.service'
import * as OrganizationService from '../../org.service'
import * as UserService from '../../user.service'

import { SnowflakeDatabaseBuilder } from './db-builder.service'

import type { SnowflakeShowColumnRow } from './db-builder.service'
import type { ConnectionSelect } from '../../../types/kysely/connection/connection.type'

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-call */

describe('Tests for Snowflake DB Builder', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const connMock = new ConnectionMock()
  let snowflakeConnectionMock: ConnectionSelect

  const user = userMock.create()
  const org = orgMock.create()

  async function cleanUp() {
    await connMock.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()
  }

  beforeAll(async () => {
    createKysely()

    await cleanUp()

    await UserService.createUser(user)

    await OrganizationService.create({
      ...org,
      created_by: user.id
    })

    await ConnectionService.create(
      connMock.createSnowflakeHybridConnection({
        ...snowflakeConnectionMockPartial,
        organization_id: org.id,
        created_by: user.id
      })
    )

    snowflakeConnectionMock = await connMock.createSnowflakeHybridConnectionRaw(
      snowflakeConnectionMockPartial
    )
    connMock.add(snowflakeConnectionMock)
  })

  afterAll(async () => {
    await cleanUp()

    await disconnectKysely()
  })

  describe('#processDb', () => {
    it('should retrieve, process one DB', async () => {
      const svc = new SnowflakeService(snowflakeConnectionMock)
      const dbBld = new SnowflakeDatabaseBuilder(svc)

      const db = await dbBld.processDb('some-id', 'FED_BANKS')

      expect(db).toBeDefined()
      expect(db).toEqual({
        id: expect.any(String),
        name: 'FED_BANKS',
        insertSchemas: expect.any(Array),
        snapshot_id: 'some-id'
      })
    }, 10000)

    it('should include views in the schema', async () => {
      const svc = new SnowflakeService(snowflakeConnectionMock)
      const dbBld = new SnowflakeDatabaseBuilder(svc)

      const db = await dbBld.processDb('some-id', 'FED_BANKS')

      expect(db).toBeDefined()
      expect(db).toEqual({
        id: expect.any(String),
        name: 'FED_BANKS',
        insertSchemas: [
          {
            id: expect.any(String),
            name: 'PUBLIC',
            database_id: expect.any(String),
            insertTables: [
              {
                id: expect.any(String),
                name: 'BANK_ROUTE_ID_ADDRESS',
                schema_id: expect.any(String),
                is_view: true,
                insertColumns: [
                  {
                    id: expect.any(String),
                    name: 'BANK_ID',
                    table_id: expect.any(String),
                    nullable: true,
                    position: 0,
                    type: 'TEXT',
                    is_primary_key: false,
                    has_default: true
                  },
                  {
                    id: expect.any(String),
                    name: 'ADDRESS',
                    table_id: expect.any(String),
                    nullable: true,
                    position: 1,
                    type: 'TEXT',
                    is_primary_key: false,
                    has_default: true
                  }
                ]
              },
              {
                id: expect.any(String),
                name: 'BANK_ROUTING',
                schema_id: expect.any(String),
                is_view: false,
                insertColumns: expect.any(Array)
              }
            ]
          }
        ],
        snapshot_id: 'some-id'
      })
    }, 25000)
  })

  describe('#processSchemas', () => {
    it('should exclude snowflake system schemas', async () => {
      const svc = new SnowflakeService(snowflakeConnectionMock)
      const dbBld = new SnowflakeDatabaseBuilder(svc)

      jest
        // @ts-expect-error - private method
        .spyOn(dbBld, 'processTablesOrViews')
        // @ts-expect-error - ignoring 2 params
        .mockImplementationOnce((rawColsInDb, schemaId, schemaName) => {
          if (schemaName === 'FED_BANKS') {
            return [{}]
          } else {
            return []
          }
        })

      // @ts-expect-error - private method
      const schemas = dbBld.processSchemas(
        [
          {
            schema_name: 'FED_BANKS'
          } as unknown as SnowflakeShowColumnRow,
          {
            schema_name: 'INFORMATION_SCHEMA'
          } as unknown as SnowflakeShowColumnRow
        ],
        'some-db-id'
      )

      expect(schemas).toEqual([
        {
          id: expect.any(String),
          name: 'FED_BANKS',
          database_id: 'some-db-id',
          insertTables: [{}]
        }
      ])
    })

    it('should ignore schemas with 0 tables', async () => {
      const svc = new SnowflakeService(snowflakeConnectionMock)
      const dbBld = new SnowflakeDatabaseBuilder(svc)

      jest
        // @ts-expect-error - private method
        .spyOn(dbBld, 'processTablesOrViews')
        // @ts-expect-error - ignoring 2 params
        .mockImplementationOnce(() => [{}])

      // @ts-expect-error - private method
      const schemas = dbBld.processSchemas(
        [
          {
            schema_name: 'FED_BANKS'
          } as unknown as SnowflakeShowColumnRow,
          {
            schema_name: 'INFORMATION_SCHEMA'
          } as unknown as SnowflakeShowColumnRow
        ],
        'some-db-id'
      )

      expect(schemas).toEqual([
        {
          id: expect.any(String),
          name: 'FED_BANKS',
          database_id: 'some-db-id',
          insertTables: [{}]
        }
      ])
    })

    it('should return [], not process for an empty DB set', async () => {
      const svc = new SnowflakeService(snowflakeConnectionMock)
      const dbBld = new SnowflakeDatabaseBuilder(svc)

      const processTablesSpy = jest
        // @ts-expect-error - private method
        .spyOn(dbBld, 'processTablesOrViews')
        // @ts-expect-error - private method mocks
        .mockImplementationOnce(() => [])

      // @ts-expect-error - private method
      const schemas = dbBld.processSchemas(
        [
          {
            schema_name: 'INFORMATION_SCHEMA'
          } as unknown as SnowflakeShowColumnRow
        ],
        'some-db-id'
      )

      expect(schemas).toEqual([])
      expect(processTablesSpy).not.toBeCalled()
    })
  })

  describe('#processTablesOrViews', () => {
    it('should not include tables in another schema', async () => {
      const svc = new SnowflakeService(snowflakeConnectionMock)
      const dbBld = new SnowflakeDatabaseBuilder(svc)

      // @ts-expect-error - private method
      jest.spyOn(dbBld, 'processColumns').mockImplementationOnce(() => [])

      // @ts-expect-error - private method
      const tables = dbBld.processTablesOrViews(
        [
          {
            schema_name: 'SOME-OTHER-SCHEMA',
            column_name: 'SOME-COLUMN',
            table_name: 'OUR-TABLE'
          } as unknown as SnowflakeShowColumnRow,
          {
            schema_name: 'OUR-SCHEMA',
            column_name: 'SOME-COLUMN-1',
            table_name: 'OUR-TABLE'
          } as unknown as SnowflakeShowColumnRow
        ],
        'OUR-SCHEMA-ID',
        'OUR-SCHEMA'
      )

      expect(tables).toEqual([
        {
          id: expect.any(String),
          insertColumns: [],
          is_view: false,
          name: 'OUR-TABLE',
          schema_id: 'OUR-SCHEMA-ID'
        }
      ])
    })
  })

  describe('#processColumns', () => {
    it('should not include columns in another schema, table', async () => {
      const svc = new SnowflakeService(snowflakeConnectionMock)
      const dbBld = new SnowflakeDatabaseBuilder(svc)

      // @ts-expect-error - private method
      const cols = dbBld.processColumns(
        [
          {
            schema_name: 'SOME-OTHER-SCHEMA',
            column_name: 'SOME-COLUMN',
            table_name: 'NOT-OUR-TABLE'
          } as unknown as SnowflakeShowColumnRow,
          {
            schema_name: 'NOT-OUR-SCHEMA',
            column_name: 'SOME-COLUMN-1',
            table_name: 'OUR-TABLE'
          } as unknown as SnowflakeShowColumnRow,
          {
            schema_name: 'OUR-SCHEMA',
            column_name: 'SOME-COLUMN-1',
            table_name: 'OUR-TABLE'
          } as unknown as SnowflakeShowColumnRow
        ],
        'OUR-TABLE-ID',
        'OUR-SCHEMA',
        'OUR-TABLE'
      )

      expect(cols).toEqual([
        {
          id: expect.any(String),
          name: 'SOME-COLUMN-1',
          table_id: 'OUR-TABLE-ID',
          nullable: false,
          position: 0,
          type: 'unknown',
          is_primary_key: false,
          has_default: false
        }
      ])
    })
  })

  describe('#inferDataType', () => {
    it('should return unknown for unparseable datatypes', async () => {
      const dataType = SnowflakeDatabaseBuilder.inferDataType(
        '{ some-unknown-type: '
      )

      expect(dataType).toEqual('unknown')

      const undef = SnowflakeDatabaseBuilder.inferDataType(
        undefined as unknown as string
      )

      expect(undef).toEqual('unknown')
    })

    it('should return base case', async () => {
      const dataType = SnowflakeDatabaseBuilder.inferDataType(
        '{"type":"FIXED","precision":38,"scale":0,"nullable":true}'
      )

      expect(dataType).toEqual('FIXED')
    })
  })
})
