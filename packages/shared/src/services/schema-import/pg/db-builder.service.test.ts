import { createKysely, disconnectKysely, getDb } from '../../../'
import { uuidFormat } from '../../../constants/type-mask.constant'
import {
  ConnectionMock,
  postgresConnectionMock
} from '../../../mocks/connection.mock'
import { OrganizationMock } from '../../../mocks/org.mock'
import { snapshotInsertMock } from '../../../mocks/snapshot/postgres.snapshot.mock'
import { UserMock } from '../../../mocks/user.mock'
import * as ConnectionService from '../../../services/connection.service'
import { insertSnapshot } from '../../../services/kysely/snapshot/snapshot.service'
import * as OrganizationService from '../../../services/org.service'
import { PostgresDatabaseBuilder } from '../../../services/schema-import/pg/db-builder.service'
import { createUser } from '../../user.service'

describe('Tests for Postgres Database Processing', () => {
  const userMock = new UserMock()
  const user = userMock.create()
  const orgMock = new OrganizationMock()
  const org = orgMock.create({
    created_by: user.id
  })
  const connMock = new ConnectionMock()

  const pgConnMock = connMock.create({
    ...postgresConnectionMock,
    organization_id: org.id,
    created_by: user.id
  })

  beforeAll(async () => {
    createKysely()

    await getDb().deleteFrom('snapshot').execute()
    await createUser(user, false)
    await OrganizationService.create(org)
    await ConnectionService.create(pgConnMock)
  })

  afterEach(async () => {
    await getDb().deleteFrom('snapshot').execute()
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

  describe('#processDb', () => {
    it('should process a DB', async () => {
      const dbProcessor = new PostgresDatabaseBuilder(
        postgresConnectionMock.connection_string,
        pgConnMock.with_ssl
      )

      const snapshot = await insertSnapshot(getDb(), snapshotInsertMock)

      const processedDb = await dbProcessor.processDb(snapshot.id, 'sort_xyz')

      expect(processedDb).toStrictEqual({
        id: expect.stringMatching(uuidFormat),
        name: 'sort_xyz',
        insertSchemas: expect.any(Array),
        snapshot_id: snapshot.id
      })
    })

    describe('when unable to connect to the db', () => {
      it('returns null', async () => {
        const dbProcessor = new PostgresDatabaseBuilder(
          postgresConnectionMock.connection_string,
          pgConnMock.with_ssl
        )

        const snapshot = await insertSnapshot(getDb(), snapshotInsertMock)

        const processedDb = await dbProcessor.processDb(
          snapshot.id,
          String(Math.random())
        )

        expect(processedDb).toBeNull()
      })
    })
  })

  describe('#processSchema', () => {
    it('should process a schema', async () => {
      const dbProcessor = new PostgresDatabaseBuilder(
        postgresConnectionMock.connection_string,
        pgConnMock.with_ssl
      )

      await insertSnapshot(getDb(), snapshotInsertMock)

      // @ts-expect-error - createKyselyResources is protected
      dbProcessor.createKyselyResources('sort_xyz')

      // @ts-expect-error - processSchema is protected
      const schemas = await dbProcessor.processSchemas('sort_xyz')

      expect(schemas).toBeDefined()
      expect(schemas).toBeInstanceOf(Array)
      expect(schemas.length).toBe(2)

      expect(schemas).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.stringMatching(uuidFormat),
            name: 'test',
            database_id: 'sort_xyz',
            insertTables: expect.any(Array)
          })
        ])
      )
    })
  })

  describe('#processTables', () => {
    it('should process a table', async () => {
      const dbProcessor = new PostgresDatabaseBuilder(
        postgresConnectionMock.connection_string,
        pgConnMock.with_ssl
      )

      await insertSnapshot(getDb(), snapshotInsertMock)

      // @ts-expect-error - createKyselyResources is protected
      dbProcessor.createKyselyResources('sort_xyz')

      // @ts-expect-error - processSchema is protected
      const schemas = await dbProcessor.processSchemas('sort_xyz')

      // @ts-expect-error - processTables is protected
      const tables = await dbProcessor.processTables(
        schemas[0].id!,
        'public',
        []
      )

      expect(tables).toBeDefined()
      expect(tables).toBeInstanceOf(Array)
      // this will most likely break other tests as we add tables, so leaving it to be >15 for now
      expect(tables.length).toBeGreaterThanOrEqual(15)

      expect(tables[0]).toStrictEqual({
        id: expect.stringMatching(uuidFormat),
        name: 'change',
        is_view: false,
        schema_id: schemas[0].id,
        insertColumns: expect.any(Array)
      })
    })
  })

  describe('#processColumns', () => {
    it('should process a column', async () => {
      const dbProcessor = new PostgresDatabaseBuilder(
        postgresConnectionMock.connection_string,
        pgConnMock.with_ssl
      )

      await insertSnapshot(getDb(), snapshotInsertMock)

      // @ts-expect-error - createKyselyResources is protected
      dbProcessor.createKyselyResources('sort_xyz')

      // @ts-expect-error - processSchema is protected
      const schemas = await dbProcessor.processSchemas('sort_xyz')

      // @ts-expect-error - processTables is protected
      const tables = await dbProcessor.processTables(
        schemas[0].id!,
        'public',
        []
      )

      // @ts-expect-error - kysely is protected
      const tablesIntro = await dbProcessor.kysely.introspection.getTables()

      // @ts-expect-error - processColumns is protected
      const columns = dbProcessor.processColumns(
        tables[0].id!,
        tablesIntro[0].columns,
        [
          {
            column_name: tablesIntro[0].columns[0].name,
            table_name: tables[0].name
          }
        ]
      )

      expect(columns).toBeDefined()
      expect(columns).toBeInstanceOf(Array)
      // same as above
      expect(columns.length).toBeGreaterThanOrEqual(8)

      expect(columns[0]).toStrictEqual({
        id: expect.stringMatching(uuidFormat),
        has_default: true,
        name: 'id',
        table_id: tables[0].id,
        type: 'uuid',
        nullable: false,
        position: 0,
        is_primary_key: true
      })
    })
  })

  describe('#getPrimaryKeys', () => {
    it('should get primary keys', async () => {
      const dbProcessor = new PostgresDatabaseBuilder(
        postgresConnectionMock.connection_string,
        pgConnMock.with_ssl
      )

      // @ts-expect-error - createKyselyResources is protected
      dbProcessor.createKyselyResources('sort_xyz')

      // @ts-expect-error - getPrimaryKeys is protected
      const primaryKeys = await dbProcessor.getPrimaryKeys('public')

      expect(primaryKeys).toBeDefined()
      expect(primaryKeys).toBeInstanceOf(Array)
      expect(primaryKeys.length).toBe(51)
    })

    describe('when unable to get primary keys', () => {
      it('returns an empty array', async () => {
        const dbProcessor = new PostgresDatabaseBuilder(
          postgresConnectionMock.connection_string,
          pgConnMock.with_ssl
        )

        // @ts-expect-error - createKyselyResources is protected
        dbProcessor.createKyselyResources('sort_xyz')

        // @ts-expect-error - getPrimaryKeys is protected
        const primaryKeys = await dbProcessor.getPrimaryKeys('kdfsjdsf')

        expect(primaryKeys).toBeDefined()
        expect(primaryKeys).toBeInstanceOf(Array)
        expect(primaryKeys.length).toBe(0)
      })
    })
  })

  describe('#createKyselyResources', () => {
    it('should create kysely resources', async () => {
      const dbProcessor = new PostgresDatabaseBuilder(
        postgresConnectionMock.connection_string,
        pgConnMock.with_ssl
      )

      // @ts-expect-error - createKyselyResources is protected
      dbProcessor.createKyselyResources('sort_xyz')

      // @ts-expect-error - kysely is protected
      expect(dbProcessor.kysely).toBeDefined()
    })
  })
})
