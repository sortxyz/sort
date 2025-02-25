import { randomUUID } from 'node:crypto'

import { createKysely, getDb, disconnectKysely } from '../../..'
import { uuidFormat } from '../../../constants/type-mask.constant'
import {
  airQualityPostgresConnectionMockPartial,
  postgresConnectionMock,
  ConnectionMock
} from '../../../mocks/connection.mock'
import { createFastifyMockLogger } from '../../../mocks/fastify-logger.mock'
import { MetadataDatabaseMock } from '../../../mocks/metadata.mock'
import { OrganizationMock } from '../../../mocks/org.mock'
import {
  snapshotInsertMock,
  snapshotUpdateMock
} from '../../../mocks/snapshot/postgres.snapshot.mock'
import { SnapshotMock } from '../../../mocks/snapshot/snapshot.mock'
import { UserMock } from '../../../mocks/user.mock'
import * as ConnectionService from '../../connection.service'
import * as OrganizationService from '../../org.service'
import * as UserService from '../../user.service'

import { PostgresSchemaImportService } from './schema-import.service'

import type { Connection } from '../../../schemas/connection.schema'

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('Tests for Postgres Schema Import', () => {
  const userMock = new UserMock()
  const snapshotMocks = new SnapshotMock()
  const metadataDatabaseMock = new MetadataDatabaseMock()
  const connMock = new ConnectionMock()
  const orgMock = new OrganizationMock()

  const user = userMock.create()
  const org = orgMock.create({ created_by: user.id })

  beforeAll(async () => {
    createKysely()

    await UserService.createUser(user)

    await OrganizationService.create({
      ...org,
      created_by: user.id
    })

    await ConnectionService.create(
      connMock.create({
        ...postgresConnectionMock,
        organization_id: org.id,
        created_by: user.id
      })
    )

    await ConnectionService.create(connMock.create(postgresConnectionMock2))

    await ConnectionService.create(
      connMock.create({
        ...airQualityPostgresConnectionMockPartial,
        created_by: user.id,
        organization_id: org.id
      })
    )
  })

  afterAll(async () => {
    await connMock.removeAll()

    await getDb()
      .deleteFrom('organization_user')
      .where(
        'user_id',
        'in',
        userMock.mocks.map(u => u.id)
      )
      .execute()

    await orgMock.removeAll()

    await userMock.removeAll()

    await disconnectKysely()
  })

  afterEach(async () => {
    await snapshotMocks.removeAll()
    await metadataDatabaseMock.removeAllByConnectionIds([
      postgresConnectionMock.id
    ])
    await metadataDatabaseMock.removeAllByConnectionIds([
      postgresConnectionMock2.id
    ])
  })

  const postgresConnectionMock2 = {
    ...postgresConnectionMock,
    id: randomUUID(),
    created_by: user.id,
    organization_id: org.id,
    created_at: new Date(),
    name: 'postgres-connection-2'
  } satisfies Connection

  describe('#importSchema', () => {
    it('should import a local schema', async () => {
      const pg = new PostgresSchemaImportService(
        connMock.create(postgresConnectionMock)
      )
      const log = createFastifyMockLogger()

      const schemaImporter = await pg.importSchema(user.id, log)

      snapshotMocks.push(schemaImporter)

      expect(schemaImporter).toStrictEqual(expect.stringMatching(uuidFormat))
    }, 10000)

    it('should import a local schema x2', async () => {
      const pg = new PostgresSchemaImportService(
        connMock.create(postgresConnectionMock)
      )

      const log = createFastifyMockLogger()

      const schemaImporter = await pg.importSchema(user.id, log)

      snapshotMocks.push(schemaImporter)

      expect(schemaImporter).toStrictEqual(expect.stringMatching(uuidFormat))

      const pg2 = new PostgresSchemaImportService(
        connMock.create(postgresConnectionMock2)
      )

      const schemaImporter2 = await pg2.importSchema(user.id, log)

      snapshotMocks.push(schemaImporter2)

      expect(schemaImporter2).toStrictEqual(expect.stringMatching(uuidFormat))
    }, 10000)

    it('should throw if no databases exist under the connection', async () => {
      jest
        .spyOn(PostgresSchemaImportService.prototype as any, 'getDatabases')
        .mockResolvedValueOnce([])

      const pg = new PostgresSchemaImportService(
        connMock.create(postgresConnectionMock)
      )

      const log = createFastifyMockLogger()

      await expect(
        async () => await pg.importSchema(user.id, log)
      ).rejects.toThrow('No databases found in Connection')
    })

    it('should throw if the user does not exist', async () => {
      const pg = new PostgresSchemaImportService(
        connMock.create(postgresConnectionMock)
      )

      const log = createFastifyMockLogger()

      await expect(
        async () => await pg.importSchema('not-a-user-id', log)
      ).rejects.toThrow('User with id: not-a-user-id not found')
    })

    it('should throw if an interior error is thrown during import', async () => {
      const pg = new PostgresSchemaImportService(
        connMock.create(postgresConnectionMock)
      )

      const log = createFastifyMockLogger()

      pg.beginSnapshot = async () => Promise.reject(new Error('some-error'))

      await expect(
        async () => await pg.importSchema(user.id, log)
      ).rejects.toThrow(
        `Failed to import schema (connection_id: "${postgresConnectionMock.id}", snapshot_id: ""). some-error`
      )
    }, 10000)

    it('should not have a trace of the original snapshot if an error was thrown inside a transaction', async () => {
      const pg = new PostgresSchemaImportService(
        connMock.create(postgresConnectionMock)
      )

      const log = createFastifyMockLogger()

      pg.updateSnapshot = async () => Promise.reject(new Error('some-error'))

      await expect(
        async () => await pg.importSchema(user.id, log)
      ).rejects.toThrow(
        new RegExp(
          `^Failed to import schema \\(connection_id: "${postgresConnectionMock.id}", snapshot_id: ".+"\\). some-error$`
        )
      )

      const snapshotsCount = await getDb()
        .selectFrom('snapshot')
        .select(({ fn }) => [fn.count<number>('id').as('count')])
        .executeTakeFirstOrThrow()

      expect(snapshotsCount.count).toBe('0')
    }, 10000)
  })

  describe('#getDatabases', () => {
    it('should return a list of databases', async () => {
      const pg = new PostgresSchemaImportService(
        connMock.create(postgresConnectionMock)
      )

      // @ts-expect-error - getDatabases is private
      const dbs = await pg.getDatabases()

      expect(dbs).toStrictEqual(['postgres', 'sort_xyz'])
    })
  })

  describe('#createSnapshot', () => {
    it('should create a snapshot', async () => {
      const pg = new PostgresSchemaImportService(
        connMock.create(postgresConnectionMock)
      )
      const log = createFastifyMockLogger()

      const ss = await pg.beginSnapshot(getDb(), user.id, log)

      expect(ss).toStrictEqual({
        ...snapshotInsertMock,
        creator: user.id,
        timestamp: expect.any(Date),
        id: expect.stringMatching(uuidFormat)
      })
    })
  })

  describe('#updateSnapshot', () => {
    it('should update an existing snapshot', async () => {
      const pg = new PostgresSchemaImportService(
        connMock.create(postgresConnectionMock)
      )
      const log = createFastifyMockLogger()

      const insertedSs = await pg.beginSnapshot(getDb(), user.id, log)

      const { databases, status } = await pg.fetchCustomerData(
        insertedSs.id,
        ['postgres', 'sort_xyz'],
        log
      )

      await pg.updateSnapshot(getDb(), insertedSs, status, databases, log)

      expect(insertedSs.id).toBeDefined()

      snapshotMocks.push(insertedSs.id)

      const getSnapshot = await getDb()
        .selectFrom('snapshot')
        .selectAll()
        .where('id', '=', insertedSs.id)
        .executeTakeFirstOrThrow()

      expect(getSnapshot).toBeDefined()

      expect(getSnapshot).toStrictEqual({
        timestamp: expect.any(Date),
        id: expect.stringMatching(uuidFormat),
        connection_id: snapshotUpdateMock.connection_id,
        creator: user.id,
        status: 'COMPLETED'
      })
    })
  })
})
