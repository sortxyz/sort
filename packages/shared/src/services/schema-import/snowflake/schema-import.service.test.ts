import { createKysely, getDb, disconnectKysely } from '../../..'
import { uuidFormat } from '../../../constants/type-mask.constant'
import {
  ConnectionMock,
  snowflakeConnectionMockPartial
} from '../../../mocks/connection.mock'
import { createFastifyMockLogger } from '../../../mocks/fastify-logger.mock'
import { OrganizationMock } from '../../../mocks/org.mock'
import { SnapshotMock } from '../../../mocks/snapshot/snapshot.mock'
import { UserMock } from '../../../mocks/user.mock'
import * as ConnectionService from '../../connection.service'
import * as OrganizationService from '../../org.service'
import * as UserService from '../../user.service'

import { SnowflakeSchemaImportService } from './schema-import.service'

import type { ConnectionSelect } from '../../../types/kysely/connection/connection.type'
import type { SnowflakeError, RowStatement } from 'snowflake-sdk'

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Tests for Snowflake Schema Import', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const snapshotMocks = new SnapshotMock()
  const connMock = new ConnectionMock()
  let snowflakeConnectionMock: ConnectionSelect

  const user = userMock.create()
  const org = orgMock.create()
  const snowflakeHybridConn = connMock.createSnowflakeHybridConnection({
    organization_id: org.id,
    created_by: user.id
  })

  async function cleanUp() {
    await connMock.removeAll()
    await snapshotMocks.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()
  }

  beforeAll(async () => {
    createKysely()

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

    await ConnectionService.create(snowflakeHybridConn)
  })

  afterAll(async () => {
    await cleanUp()

    await disconnectKysely()
  })

  describe('#importSchema', () => {
    let importId: string

    beforeAll(async () => {
      const sf = new SnowflakeSchemaImportService(snowflakeHybridConn)
      const log = createFastifyMockLogger()

      importId = await sf.importSchema(user.id, log)
      snapshotMocks.push(importId)
    }, 20000)

    it('returns a uuid', async () => {
      expect(importId).toStrictEqual(expect.stringMatching(uuidFormat))
    })

    it('should import a local schema w/ primary keys', async () => {
      const col = await getDb()
        .selectFrom('snapshot_table as st')
        .innerJoin('snapshot_column as sc', 'st.id', 'sc.table_id')
        .where('st.name', '=', 'HYBRID1')
        .where('sc.name', '=', 'EMPLOYEE_ID')
        .selectAll('sc')
        .executeTakeFirstOrThrow()

      expect(col).toBeDefined()
      expect(col.is_primary_key).toBe(true)
    })

    it('should not import primary keys from non-hybrid tables', async () => {
      const col = await getDb()
        .selectFrom('snapshot_table as st')
        .innerJoin('snapshot_column as sc', 'st.id', 'sc.table_id')
        .where('st.name', '=', 'NORMAL')
        .where('sc.name', '=', 'ID')
        .selectAll('sc')
        .executeTakeFirstOrThrow()

      expect(col).toBeDefined()
      expect(col.is_primary_key).toBe(false)
    })
  })

  describe('#snowflakeCompletionHandler', () => {
    it('should exclude default SNOWFLAKE databases', async () => {
      const sf = new SnowflakeSchemaImportService(
        connMock.create(snowflakeConnectionMock)
      )
      const log = createFastifyMockLogger()

      const resolveFn = jest.fn()

      const dbs = [{ name: 'db1' }, { name: 'db2' }, { name: 'SNOWFLAKE' }]
      // @ts-expect-error - private fn
      sf.snowflakeCompletionHandler(
        log,
        resolveFn,
        () => ({}),
        undefined,
        {} as unknown as RowStatement,
        dbs
      )

      expect(resolveFn).toBeCalledWith(['db1', 'db2'])
    })

    it('should reject if no rows returned', async () => {
      const sf = new SnowflakeSchemaImportService(
        connMock.create(snowflakeConnectionMock)
      )
      const log = createFastifyMockLogger()

      const resolveFn = jest.fn()
      const rejectFn = jest.fn()

      // @ts-expect-error - private fn
      sf.snowflakeCompletionHandler(
        log,
        resolveFn,
        rejectFn,
        undefined,
        {} as unknown as RowStatement,
        []
      )

      expect(rejectFn).toBeCalledWith(new Error('No rows returned'))
    })

    it('should reject if Snowflake error is returned', async () => {
      const sf = new SnowflakeSchemaImportService(
        connMock.create(snowflakeConnectionMock)
      )
      const log = createFastifyMockLogger()

      const resolveFn = jest.fn()
      const rejectFn = jest.fn()
      const logSpy = jest.spyOn(log, 'error')
      const error = { message: 'some-error' }

      // @ts-expect-error - private fn
      sf.snowflakeCompletionHandler(
        log,
        resolveFn,
        rejectFn,
        error as unknown as SnowflakeError,
        {} as unknown as RowStatement,
        []
      )

      expect(logSpy).toHaveBeenCalledWith(
        error,
        expect.stringMatching(/^Failed to retrieve databases for/)
      )
      expect(rejectFn).toHaveBeenCalledWith(error)
    })
  })
})
