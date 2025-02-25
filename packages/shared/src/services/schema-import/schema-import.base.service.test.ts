/* eslint-disable  @typescript-eslint/no-non-null-assertion */
import { createKysely, getDb, disconnectKysely } from '../..'
import {
  ConnectionMock,
  postgresConnectionMock,
  snowflakeConnectionMockPartial
} from '../../mocks/connection.mock'
import { createFastifyMockLogger } from '../../mocks/fastify-logger.mock'
import { OrganizationMock } from '../../mocks/org.mock'
import {
  snapshotInsertDatabasesMock,
  snapshotInsertMock
} from '../../mocks/snapshot/postgres.snapshot.mock'
import { SnapshotMock } from '../../mocks/snapshot/snapshot.mock'
import { UserMock } from '../../mocks/user.mock'
import * as ConnectionService from '../../services/connection.service'
import * as SnapshotService from '../kysely/snapshot/snapshot.service'
import * as OrganizationService from '../org.service'
import * as UserService from '../user.service'

import { BaseSchemaImportService } from './schema-import.base.service'

import type { BaseDatabaseBuilderService } from './schema-import.base.service'
import type { ConnectionSelectWithEncryption } from '../../types/kysely/connection/connection.type'
import type { FastifyBaseLogger } from 'fastify'

/* eslint-disable  @typescript-eslint/no-unused-vars */

const connMock = new ConnectionMock()
const pgMock = connMock.create(postgresConnectionMock)
const snowMock = connMock.createSnowflakeHybridConnection(
  snowflakeConnectionMockPartial
)
connMock.add(snowMock)

class BaseMock extends BaseSchemaImportService<'postgres'> {
  constructor(protected connection: ConnectionSelectWithEncryption) {
    super('postgres', connection)
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  importSchema(userId: string, log: FastifyBaseLogger): Promise<string> {
    return Promise.resolve('some-id')
  }

  getSchemaImportStatus(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    id: string
  ): Promise<'RUNNING' | 'FAILED' | 'COMPLETED'> {
    return Promise.resolve('COMPLETED')
  }

  async createDatabaseBuilder(): Promise<BaseDatabaseBuilderService> {
    return {
      processDb: async () => Promise.resolve(null)
    }
  }
}

describe('Tests for Base Schema Import', () => {
  const ssMock = new SnapshotMock()

  const log = createFastifyMockLogger()

  const userMock = new UserMock()
  const orgMock = new OrganizationMock()

  const user = userMock.create()
  const org = orgMock.create()

  async function cleanUp() {
    await ConnectionMock.removeIds([postgresConnectionMock.id])
    await ssMock.removeAll()
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

    await ConnectionService.create({
      ...pgMock,
      organization_id: org.id,
      created_by: user.id
    })
  })

  afterAll(async () => {
    await cleanUp()
    await disconnectKysely()
  })

  describe('#ctor', () => {
    it('should instantiate with a connection', () => {
      const pg = new BaseMock(pgMock)

      expect(pg).toBeDefined()
    })

    it('should throw an error if the data provider doesnt match connection', () => {
      expect(() => new BaseMock(snowMock)).toThrowError(
        /^Invalid data provider/
      )
    })
  })

  describe('#createSnapshot', () => {
    it('should call begin, then update snapshot', async () => {
      const pg = new BaseMock(pgMock)

      const beginSpy = jest.spyOn(pg, 'beginSnapshot')
      const updateSpy = jest.spyOn(pg, 'updateSnapshot')

      const id = await pg.createSnapshot(['db1', 'db2'], log, user.id)

      ssMock.push(id)

      expect(beginSpy).toHaveBeenCalled()
      expect(updateSpy).toHaveBeenCalled()

      const createSpyOrder = beginSpy.mock.invocationCallOrder[0]
      const updateSpyOrder = updateSpy.mock.invocationCallOrder[0]
      expect(createSpyOrder).toBeLessThan(updateSpyOrder)
    })

    it('should re-throw an error with schema Import failure', async () => {
      const pg = new BaseMock(pgMock)

      jest.spyOn(pg, 'beginSnapshot').mockImplementationOnce(() => {
        throw new Error('some-error')
      })

      await expect(
        pg.createSnapshot(['db1', 'db2'], log, user.id)
      ).rejects.toThrow(
        `Failed to import schema (connection_id: "${postgresConnectionMock.id}", snapshot_id: ""). some-error`
      )
    })
  })

  describe('#updateSnapshot', () => {
    it('should update an existing snapshot with the correct status', async () => {
      const pg = new BaseMock(pgMock)
      const log = createFastifyMockLogger()

      const ss = await pg.beginSnapshot(getDb(), user.id, log)

      ssMock.push(ss.id)

      const { databases, status } = await pg.fetchCustomerData(
        ss.id,
        ['postgres', 'sort_xyz'],
        log
      )

      await pg.updateSnapshot(getDb(), ss, status, databases, log)

      const updated = await getDb()
        .selectFrom('snapshot')
        .where('id', '=', ss.id)
        .selectAll()
        .executeTakeFirstOrThrow()

      expect(updated).toEqual({
        creator: user.id,
        connection_id: postgresConnectionMock.id,
        id: expect.any(String),
        timestamp: expect.any(Date),
        status: 'COMPLETED'
      })
    })

    it('should set a FAILED status on error inside database', async () => {
      const pg = new BaseMock(pgMock)
      const log = createFastifyMockLogger()

      const ss = await pg.beginSnapshot(getDb(), user.id, log)

      ssMock.push(ss.id)

      jest.spyOn(pg, 'createDatabaseBuilder').mockImplementationOnce(() => {
        throw new Error('generic-error')
      })

      const { databases, status } = await pg.fetchCustomerData(
        ss.id,
        ['postgres', 'sort_xyz'],
        log
      )

      await pg.updateSnapshot(getDb(), ss, status, databases, log)

      const updated = await getDb()
        .selectFrom('snapshot')
        .where('id', '=', ss.id)
        .selectAll()
        .executeTakeFirstOrThrow()

      expect(updated).toEqual({
        creator: user.id,
        connection_id: postgresConnectionMock.id,
        id: expect.any(String),
        timestamp: expect.any(Date),
        status: 'FAILED'
      })
    })

    it('should only insert non-null processed databases on update', async () => {
      const pg = new BaseMock(pgMock)
      const log = createFastifyMockLogger()

      const ss = await pg.beginSnapshot(getDb(), user.id, log)

      ssMock.push(ss.id)

      jest.spyOn(pg, 'createDatabaseBuilder').mockImplementationOnce(() => {
        return Promise.resolve({
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          processDb: async (snapshotId, dbName) => {
            return dbName === 'db1' ? snapshotInsertDatabasesMock[0] : null
          }
        })
      })

      const { databases, status } = await pg.fetchCustomerData(
        ss.id,
        ['db1', 'db2'],
        log
      )

      jest
        .spyOn(SnapshotService, 'updateSnapshot')
        .mockImplementationOnce(() => Promise.resolve({ id: 'some-id' }))

      const result = await pg.updateSnapshot(
        getDb(),
        ss,
        status,
        databases,
        log
      )

      expect(result).toEqual({
        creator: user.id,
        connection_id: postgresConnectionMock.id,
        insertDatabases: [snapshotInsertDatabasesMock[0]],
        id: expect.any(String),
        timestamp: expect.any(Date),
        status: 'COMPLETED'
      })
    })

    it('should only import databases with schemas', async () => {
      const pg = new BaseMock(pgMock)
      const log = createFastifyMockLogger()

      const snapshot = await pg.beginSnapshot(getDb(), user.id, log)

      ssMock.push(snapshot.id)

      jest.spyOn(pg, 'createDatabaseBuilder').mockImplementationOnce(() => {
        return Promise.resolve({
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          processDb: async (snapshotId, dbName) => {
            return dbName === 'db1'
              ? { ...snapshotInsertDatabasesMock[0] }
              : { ...snapshotInsertDatabasesMock[1] }
          }
        })
      })

      jest
        .spyOn(SnapshotService, 'updateSnapshot')
        .mockImplementationOnce(() => Promise.resolve({ id: 'some-id' }))

      const { status, databases } = await pg.fetchCustomerData(
        snapshot.id,
        ['db1', 'db2'],
        log
      )

      const result = await pg.updateSnapshot(
        getDb(),
        snapshot,
        status,
        databases,
        log
      )

      expect(result).toEqual({
        creator: user.id,
        connection_id: postgresConnectionMock.id,
        insertDatabases: [snapshotInsertDatabasesMock[0]],
        id: expect.any(String),
        timestamp: expect.any(Date),
        status: 'COMPLETED'
      })
    })
  })

  describe('#beginSnapshot', () => {
    it('should insert a new snapshot with an id, return both', async () => {
      const pg = new BaseMock(pgMock)
      const log = createFastifyMockLogger()

      const result = await pg.beginSnapshot(getDb(), user.id, log)

      ssMock.push(result.id)

      expect(result).toEqual({
        ...snapshotInsertMock,
        creator: expect.any(String),
        timestamp: expect.any(Date),
        id: expect.any(String)
      })
    })
  })
})
