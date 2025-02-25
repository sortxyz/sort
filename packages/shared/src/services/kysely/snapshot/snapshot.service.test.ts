import { getDb, createKysely, disconnectKysely } from '../../../'
import { DEFAULT_DATABASE_DESCRIPTION } from '../../../constants/metadata.constant'
import {
  ConnectionMock,
  postgresConnectionMock
} from '../../../mocks/connection.mock'
import { MetadataDatabaseMock } from '../../../mocks/metadata.mock'
import { organizationMock } from '../../../mocks/org.mock'
import {
  snapshotDatabaseRaw1,
  snapshotInsertMock,
  snapshotSchemaRaw1,
  snapshotTableRaw,
  snapshotUpdateMock
} from '../../../mocks/snapshot/postgres.snapshot.mock'
import { UserMock } from '../../../mocks/user.mock'
import * as ConnectionService from '../../../services/connection.service'
import {
  insertSnapshot,
  updateSnapshot
} from '../../../services/kysely/snapshot/snapshot.service'
import * as OrganizationService from '../../../services/org.service'
import * as UserService from '../../user.service'

describe('Tests for Schema Snapshot Service', () => {
  const userMock = new UserMock()
  const user = userMock.create()
  const connMock = new ConnectionMock()

  const metadataDatabaseMock = new MetadataDatabaseMock()

  beforeAll(async () => {
    createKysely()

    await UserService.createUser(user)

    await OrganizationService.create({
      ...organizationMock,
      created_by: user.id
    })

    await ConnectionService.create(
      connMock.create({
        ...postgresConnectionMock,
        organization_id: organizationMock.id,
        created_by: user.id
      })
    )
  })

  afterEach(async () => {
    await getDb().deleteFrom('snapshot').execute()

    await metadataDatabaseMock.removeAllByConnectionIds([
      postgresConnectionMock.id
    ])
  })

  afterAll(async () => {
    await getDb().deleteFrom('connection').execute()
    await getDb().deleteFrom('organization_user').execute()
    await getDb().deleteFrom('organization').execute()
    await userMock.removeAll()
    await disconnectKysely()
  })

  describe('#insertSnapshot', () => {
    it('should insert a snapshot', async () => {
      const snapshot = await insertSnapshot(getDb(), snapshotInsertMock)

      expect(snapshot.id).toBeDefined()

      const getSnapshot = await getDb()
        .selectFrom('snapshot')
        .selectAll()
        .where('id', '=', snapshot.id)
        .executeTakeFirstOrThrow()

      expect(getSnapshot).toBeDefined()

      expect(getSnapshot).toStrictEqual({
        ...snapshotInsertMock
      })
    })
  })

  describe('#updateSnapshot', () => {
    let snapshot: { id: string }

    beforeEach(async () => {
      await insertSnapshot(getDb(), snapshotInsertMock)

      snapshot = await updateSnapshot(
        getDb(),
        organizationMock.id,
        snapshotUpdateMock,
        snapshotInsertMock.id
      )
    })

    it('should have inserted into metadata DB and assigned default labels', async () => {
      const getMetadataDb = await getDb()
        .selectFrom('metadata_database')
        .where('organization_id', '=', organizationMock.id)
        .where('connection_id', '=', snapshotInsertMock.connection_id)
        .where('raw_name', '=', snapshotDatabaseRaw1.name)
        .selectAll()
        .executeTakeFirstOrThrow()

      expect(getMetadataDb).toEqual({
        connection_id: expect.any(String),
        display_name: 'sort_xyz',
        organization_id: organizationMock.id,
        description: DEFAULT_DATABASE_DESCRIPTION,
        link: null,
        raw_name: 'sort_xyz',
        slug: expect.stringMatching(new RegExp('sort_xyz-[a-f0-9]+$')),
        summary: null
      })

      const getMetadataDbLabels = await getDb()
        .selectFrom('label')
        .where(
          'metadata_database_connection_id',
          '=',
          getMetadataDb.connection_id
        )
        .where('metadata_database_raw_name', '=', getMetadataDb.raw_name)
        .selectAll()
        .execute()

      const allDefaultLabels = await getDb()
        .selectFrom('default_label')
        .selectAll()
        .execute()

      expect(getMetadataDbLabels).toHaveLength(allDefaultLabels.length)
    })

    it('should have inserted into metadata tables', async () => {
      const metadataTable = await getDb()
        .selectFrom('metadata_table')
        .where('connection_id', '=', snapshotInsertMock.connection_id)
        .where('raw_name', '=', snapshotTableRaw.name)
        .where('raw_schema_name', '=', snapshotSchemaRaw1.name)
        .where('raw_database_name', '=', snapshotDatabaseRaw1.name)
        .selectAll()
        .executeTakeFirstOrThrow()

      expect(metadataTable).toEqual({
        connection_id: expect.any(String),
        display_name: snapshotTableRaw.name,
        raw_database_name: snapshotDatabaseRaw1.name,
        raw_name: snapshotTableRaw.name,
        raw_schema_name: snapshotSchemaRaw1.name,
        summary: ''
      })
    })

    it('should have updated a snapshot', async () => {
      const getSnapshot = await getDb()
        .selectFrom('snapshot')
        .selectAll()
        .where('id', '=', snapshot.id)
        .executeTakeFirstOrThrow()

      expect(getSnapshot).toBeDefined()

      expect(getSnapshot).toStrictEqual({
        ...snapshotUpdateMock
      })
    })
  })
})
