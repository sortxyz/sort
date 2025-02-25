import { getDb, createKysely, disconnectKysely } from '../../../'
import {
  ConnectionMock,
  postgresConnectionMock
} from '../../../mocks/connection.mock'
import { OrganizationMock } from '../../../mocks/org.mock'
import {
  snapshotDatabaseRaw1,
  snapshotDatabaseRaw2,
  snapshotInsertMock,
  snapshotUpdateMock
} from '../../../mocks/snapshot/postgres.snapshot.mock'
import { UserMock } from '../../../mocks/user.mock'
import * as ConnectionService from '../../../services/connection.service'
import {
  getDatabasesCountBySnapshot,
  getDatabasesWithSchemas
} from '../../../services/kysely/snapshot/database.service'
import {
  insertSnapshot,
  updateSnapshot
} from '../../../services/kysely/snapshot/snapshot.service'
import * as OrganizationService from '../../../services/org.service'
import * as UserService from '../../user.service'

describe('Tests for Schema Service', () => {
  const userMock = new UserMock()
  const user = userMock.create()
  const connMock = new ConnectionMock()
  const orgMock = new OrganizationMock()
  const org = orgMock.create({
    created_by: user.id
  })
  let insertId: { id: string }

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

    insertId = await insertSnapshot(getDb(), {
      ...snapshotInsertMock,
      creator: user.id
    })

    await updateSnapshot(
      getDb(),
      postgresConnectionMock.organization_id,
      { ...snapshotUpdateMock, creator: user.id },
      insertId.id
    )
  })

  afterAll(async () => {
    await getDb()
      .deleteFrom('snapshot_schema')
      .where('id', '=', insertId.id)
      .execute()

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

  describe('#getDatabasesCountBySnapshot', () => {
    it('should get a count of DBs', async () => {
      const getSnapshot = await getDatabasesCountBySnapshot(
        snapshotUpdateMock.id
      )

      expect(getSnapshot).toStrictEqual({ count: '2' })
    })
  })

  describe('#getDatabasesWithSchemas', () => {
    it('should get a db page with both dbs, default metadata', async () => {
      const getSnapshot = await getDatabasesWithSchemas(snapshotUpdateMock.id)

      expect(getSnapshot).toEqual(
        expect.arrayContaining([
          {
            ...snapshotDatabaseRaw2,
            connection_id: postgresConnectionMock.id,
            summary: null,
            display_name: snapshotDatabaseRaw2.name,
            schemaNames: ['public'],
            link: null,
            organization_id: postgresConnectionMock.organization_id,
            slug: expect.stringMatching(
              new RegExp(`^${snapshotDatabaseRaw2.name}-`)
            )
          },
          {
            ...snapshotDatabaseRaw1,
            connection_id: postgresConnectionMock.id,
            summary: null,
            display_name: snapshotDatabaseRaw1.name,
            schemaNames: ['public'],
            link: null,
            organization_id: postgresConnectionMock.organization_id,
            slug: expect.stringMatching(
              new RegExp(`^${snapshotDatabaseRaw1.name}-`)
            )
          }
        ])
      )
    })

    it('after update, should get a db page with both dbs, custom metadata', async () => {
      await getDb()
        .updateTable('metadata_database')
        .set({
          display_name: 'test-1',
          summary: 'test-2'
        })
        .where('raw_name', '=', snapshotDatabaseRaw1.name)
        .where('connection_id', '=', postgresConnectionMock.id)
        .execute()

      await getDb()
        .updateTable('metadata_database')
        .set({
          display_name: 'test-3',
          summary: 'test-4'
        })
        .where('raw_name', '=', snapshotDatabaseRaw2.name)
        .where('connection_id', '=', postgresConnectionMock.id)
        .execute()

      const getSnapshot = await getDatabasesWithSchemas(snapshotUpdateMock.id)

      expect(getSnapshot).toEqual(
        expect.arrayContaining([
          {
            ...snapshotDatabaseRaw2,
            connection_id: postgresConnectionMock.id,
            summary: 'test-4',
            display_name: 'test-3',
            schemaNames: ['public'],
            link: null,
            organization_id: postgresConnectionMock.organization_id,
            slug: expect.stringMatching(
              new RegExp(`^${snapshotDatabaseRaw2.name}-`)
            )
          },
          {
            ...snapshotDatabaseRaw1,
            connection_id: postgresConnectionMock.id,
            summary: 'test-2',
            display_name: 'test-1',
            schemaNames: ['public'],
            link: null,
            organization_id: postgresConnectionMock.organization_id,
            slug: expect.stringMatching(
              new RegExp(`^${snapshotDatabaseRaw1.name}-`)
            )
          }
        ])
      )
    })
  })
})
