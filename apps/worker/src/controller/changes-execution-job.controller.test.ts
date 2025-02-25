import { randomUUID } from 'node:crypto'

import { createKysely, disconnectKysely, getDb } from '@sort/shared'
import { ChangeRequestMock } from '@sort/shared/mocks/change-requests/change-request.mock'
import { ChangeRequestTestAllPrimaryKeysTableMock } from '@sort/shared/mocks/change-requests/test-table-all-primary-keys.mock'
import { ChangeRequestTestTableMock } from '@sort/shared/mocks/change-requests/test-table.mock'
import {
  ConnectionMock,
  postgresConnectionMock
} from '@sort/shared/mocks/connection.mock'
import { LabelMock } from '@sort/shared/mocks/label.mock'
import {
  MetadataDatabaseMock,
  MetadataTableMock
} from '@sort/shared/mocks/metadata.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { SnapshotMock } from '@sort/shared/mocks/snapshot/postgres.snapshot.mock'
import { SnapshotColumnMock } from '@sort/shared/mocks/snapshot/snapshot-column.mock'
import { SnapshotDatabaseMock } from '@sort/shared/mocks/snapshot/snapshot-database.mock'
import { SnapshotSchemaMock } from '@sort/shared/mocks/snapshot/snapshot-schema.mock'
import { SnapshotTableMock } from '@sort/shared/mocks/snapshot/snapshot-table.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ChangeRequestService from '@sort/shared/services/change-requests/change-request.service'
import { getChangeRequestTimeline } from '@sort/shared/services/change-requests/change-request.timeline.service'
import * as ChangeService from '@sort/shared/services/changes/change.service'
import * as ChangeJobService from '@sort/shared/services/changes/job.service'
import { KyselyExtractor } from '@sort/shared/services/changes/kysely-extractor.service'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as MetadataDatabaseService from '@sort/shared/services/kysely/metadata/database.service'
import * as MetadataTableService from '@sort/shared/services/kysely/metadata/table.service'
import * as LabelService from '@sort/shared/services/label.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as UserService from '@sort/shared/services/user.service'
import { sql } from 'kysely'

import { config, logger } from '../config/bootstrap'

import { ChangesExecutionJobController } from './changes-execution-job.controller'

import type * as ChangeSchema from '@sort/shared/schemas/change.schema'
import type { Label } from '@sort/shared/schemas/label.schema'
import type * as OrganizationMemberSchema from '@sort/shared/schemas/org-member.schema'
import type { MetadataDatabase } from '@sort/shared/types/__generated/kysely.type'
import type * as ChangeType from '@sort/shared/types/change-request.types'
import type { User } from '@sort/shared/types/user.type'

const userMock = new UserMock()
const orgMock = new OrganizationMock()
const snapshotMocks = new SnapshotMock()
const snapshotDatabaseMock = new SnapshotDatabaseMock()
const snapshotSchemaMock = new SnapshotSchemaMock()
const snapshotTableMock = new SnapshotTableMock()
const snapshotColumnMock = new SnapshotColumnMock()
const connMock = new ConnectionMock()
const dbMock = new MetadataDatabaseMock()
const tableMock = new MetadataTableMock()
const changeRequestMock = new ChangeRequestMock()
const labelMock = new LabelMock()
const testTableMock = new ChangeRequestTestTableMock()
const testTableAllPrimaryKeysMock =
  new ChangeRequestTestAllPrimaryKeysTableMock()

const orgOwner = userMock.create()
const org = orgMock.create()

async function cleanUp() {
  await testTableMock.removeAll()
  await testTableAllPrimaryKeysMock.removeAll()
  await connMock.removeAll()
  await snapshotColumnMock.removeAll()
  await snapshotTableMock.removeAll()
  await snapshotSchemaMock.removeAll()
  await snapshotDatabaseMock.removeAll()
  await snapshotMocks.removeAll()
  await orgMock.removeAll(true)
  await userMock.removeAll()
}

let createdChangeRequest: Awaited<
  ReturnType<typeof ChangeRequestService.createChangeRequest>
>

let createdChangeRequest2: Awaited<
  ReturnType<typeof ChangeRequestService.createChangeRequest>
>

let dbEntry: MetadataDatabase
let orgOwnerMember: OrganizationMemberSchema.OrganizationMember
let user: User
let label1: Label
let label2: Label

describe('Changes Execution Job Controller tests', () => {
  beforeAll(async () => {
    createKysely({ config, sortLogger: logger })
    user = await UserService.createUser(orgOwner)

    await OrganizationService.create({
      ...org,
      created_by: user.id
    })

    const conn = connMock.create({
      ...postgresConnectionMock,
      organization_id: org.id,
      created_by: user.id
    })
    await ConnectionService.create(conn)

    dbEntry = dbMock.create({
      raw_name: 'sort_xyz',
      organization_id: org.id,
      connection_id: conn.id
    })
    await MetadataDatabaseService.insertMetadataDb(getDb(), dbEntry)
    const tableEntry = tableMock.create({
      connection_id: conn.id,
      raw_database_name: dbEntry.raw_name,
      raw_schema_name: 'test',
      raw_name: 'change_request_test'
    })
    await MetadataTableService.insertTable(tableEntry)

    const tableEntry2 = tableMock.create({
      connection_id: conn.id,
      raw_database_name: dbEntry.raw_name,
      raw_schema_name: 'test',
      raw_name: 'change_request_test_all_primary_keys'
    })
    await MetadataTableService.insertTable(tableEntry2)

    const snapshot = snapshotMocks.create({
      status: 'COMPLETED',
      connection_id: conn.id
    })
    await getDb().insertInto('snapshot').values(snapshot).execute()

    const snapshotDatabase = snapshotDatabaseMock.create({
      name: dbEntry.raw_name,
      snapshot_id: snapshot.id
    })
    await getDb()
      .insertInto('snapshot_database')
      .values(snapshotDatabase)
      .executeTakeFirstOrThrow()

    const snapshotSchema = snapshotSchemaMock.create({
      name: tableEntry.raw_schema_name,
      database_id: snapshotDatabase.id
    })
    await getDb()
      .insertInto('snapshot_schema')
      .values(snapshotSchema)
      .executeTakeFirstOrThrow()

    const snapshotTable = snapshotTableMock.create({
      name: tableEntry.raw_name,
      schema_id: snapshotSchema.id
    })
    await getDb()
      .insertInto('snapshot_table')
      .values(snapshotTable)
      .executeTakeFirstOrThrow()

    const snapshotTable2 = snapshotTableMock.create({
      name: tableEntry2.raw_name,
      schema_id: snapshotSchema.id
    })
    await getDb()
      .insertInto('snapshot_table')
      .values(snapshotTable2)
      .executeTakeFirstOrThrow()

    const snapshotColumns = [
      snapshotColumnMock.create({
        table_id: snapshotTable.id,
        is_primary_key: true,
        name: 'id',
        type: 'uuid',
        nullable: false
      }),
      snapshotColumnMock.create({
        table_id: snapshotTable.id,
        is_primary_key: false,
        name: 'test_uuid',
        type: 'uuid',
        nullable: true
      }),
      snapshotColumnMock.create({
        table_id: snapshotTable.id,
        is_primary_key: false,
        name: 'test_numeric',
        type: 'numeric',
        nullable: true
      }),
      snapshotColumnMock.create({
        table_id: snapshotTable.id,
        is_primary_key: false,
        name: 'test_boolean',
        type: 'boolean',
        nullable: true
      }),
      snapshotColumnMock.create({
        table_id: snapshotTable.id,
        is_primary_key: false,
        name: 'test_jsonb',
        type: 'json',
        nullable: true
      }),
      snapshotColumnMock.create({
        table_id: snapshotTable.id,
        is_primary_key: false,
        name: 'test_text',
        type: 'text',
        nullable: true
      }),
      snapshotColumnMock.create({
        table_id: snapshotTable.id,
        is_primary_key: false,
        name: 'test_timestamp',
        type: 'date',
        nullable: true
      }),
      snapshotColumnMock.create({
        table_id: snapshotTable.id,
        is_primary_key: false,
        name: 'test_timestamptz',
        type: 'date',
        nullable: true
      }),
      snapshotColumnMock.create({
        table_id: snapshotTable.id,
        is_primary_key: false,
        name: 'test_date',
        type: 'date',
        nullable: true
      }),
      snapshotColumnMock.create({
        table_id: snapshotTable.id,
        is_primary_key: false,
        name: 'test_binary',
        type: 'binary',
        nullable: true
      })
    ]

    await getDb()
      .insertInto('snapshot_column')
      .values(snapshotColumns)
      .execute()

    const snapshotColumns2 = [
      snapshotColumnMock.create({
        table_id: snapshotTable2.id,
        is_primary_key: true,
        name: 'id',
        type: 'uuid',
        nullable: false
      }),
      snapshotColumnMock.create({
        table_id: snapshotTable2.id,
        is_primary_key: true,
        name: 'numeric_id',
        type: 'numeric',
        nullable: false
      }),
      snapshotColumnMock.create({
        table_id: snapshotTable2.id,
        is_primary_key: true,
        name: 'boolean_id',
        type: 'bool',
        nullable: false
      }),
      snapshotColumnMock.create({
        table_id: snapshotTable2.id,
        is_primary_key: true,
        name: 'jsonb_id',
        type: 'json',
        nullable: false
      }),
      snapshotColumnMock.create({
        table_id: snapshotTable2.id,
        is_primary_key: true,
        name: 'timestamp_id',
        type: 'date',
        nullable: false
      }),
      snapshotColumnMock.create({
        table_id: snapshotTable2.id,
        is_primary_key: true,
        name: 'binary_id',
        type: 'bytea',
        nullable: false
      })
    ]

    await getDb()
      .insertInto('snapshot_column')
      .values(snapshotColumns2)
      .execute()

    label1 = labelMock.create({
      connection_id: conn.id,
      database_name: dbEntry.raw_name
    })

    await LabelService.createDatabaseLabel(label1)
    label2 = labelMock.create({
      connection_id: conn.id,
      database_name: dbEntry.raw_name
    })
    await LabelService.createDatabaseLabel(label2)

    // TODO: We need an OrgMember mock
    orgOwnerMember = {
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        picture: user.picture
      },
      role: {
        id: 0,
        name: 'owner'
      }
    } satisfies OrganizationMemberSchema.OrganizationMember
  })

  beforeEach(async () => {
    const mockChangeRequest = changeRequestMock.create({
      id: randomUUID(),
      connection_id: dbEntry.connection_id,
      database_name: dbEntry.raw_name,
      created_by: user.id,
      title: 'Detailed Test Change Request',
      description: 'This change request has all possible fields defined.',
      labels: [label1, label2],
      reviewers: [orgOwnerMember]
    })

    createdChangeRequest =
      await ChangeRequestService.createChangeRequest(mockChangeRequest)

    const mockChangeRequest2 = changeRequestMock.create({
      id: randomUUID(),
      connection_id: dbEntry.connection_id,
      database_name: dbEntry.raw_name,
      created_by: user.id,
      title: 'Detailed Test Change Request 2',
      description:
        'This change request has all possible primary keys fields defined.',
      labels: [label1, label2],
      reviewers: [orgOwnerMember]
    })

    createdChangeRequest2 =
      await ChangeRequestService.createChangeRequest(mockChangeRequest2)

    expect(createdChangeRequest2).toBeDefined()
  })

  afterAll(async () => {
    await cleanUp()
    await disconnectKysely()
  })

  describe('#runJob', () => {
    beforeEach(async () => {
      await testTableMock.removeAll()
    })

    describe('when the transaction succeeds', () => {
      it('should insert a change with one numeric value and one generated UUID value', async () => {
        const change = {
          id: randomUUID(),
          change_request_id: createdChangeRequest.id,
          index: 0,
          action: 'ADD',
          connection_id: createdChangeRequest.connection_id,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test'
        } satisfies ChangeSchema.Change
        const insertedChange = await ChangeService.insertChange(getDb(), change)

        const changeFieldValues = {
          id: randomUUID(),
          change_id: insertedChange.id,
          column_name: 'id',
          string_value: undefined,
          numeric_value: undefined,
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: randomUUID(),
          is_value_null: false
        } satisfies ChangeSchema.ChangeFieldValue
        await ChangeService.insertChangeFieldValue(getDb(), changeFieldValues)

        const changeFieldValues2 = {
          id: randomUUID(),
          change_id: insertedChange.id,
          column_name: 'test_numeric',
          string_value: undefined,
          numeric_value: 200,
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: undefined,
          is_value_null: false
        } satisfies ChangeSchema.ChangeFieldValue
        await ChangeService.insertChangeFieldValue(getDb(), changeFieldValues2)

        const job = await ChangeJobService.insertTestJob({
          id: randomUUID(),
          status: 'PENDING',
          change_request_id: createdChangeRequest.id,
          start_time: null,
          end_time: null,
          updated_at: new Date(),
          created_at: new Date(),
          error_message: null,
          rows_affected: null
        } satisfies ChangeType.ChangeRequestJobSelect)

        const controller = new ChangesExecutionJobController(job)
        await controller.runJob()

        const finishedJob = await ChangeJobService.getChangeJobById(
          getDb(),
          job.id
        )
        expect(finishedJob).toEqual({
          ...job,
          status: 'COMPLETED',
          start_time: expect.any(Date),
          end_time: expect.any(Date),
          updated_at: expect.any(Date),
          rows_affected: 1
        })

        const cr = await ChangeRequestService.getChangeRequestById(
          createdChangeRequest.id
        )
        expect(cr.status).toEqual('applied')

        const user = await UserService.getSortBotSvcUser(getDb(), config)
        const timeline = await getChangeRequestTimeline(cr.id)
        const item = timeline.at(-1)
        expect(item).toEqual({
          action_type: 'COMPLETE_EXECUTE',
          id: expect.any(String),
          change_request_id: cr.id,
          user: {
            id: user.id,
            name: user.name,
            picture: user.picture,
            username: user.username
          },
          action_details: {
            change_request_job_id: job.id,
            num_affected_rows: 1
          },
          created_at: expect.any(Date)
        })
      })

      it('should update a change with one numeric value and one generated UUID value', async () => {
        const testRow = await testTableMock.insert(
          testTableMock.create({
            id: randomUUID(),
            test_numeric: '100'
          })
        )

        const change = {
          id: randomUUID(),
          change_request_id: createdChangeRequest.id,
          index: 0,
          action: 'MODIFY',
          connection_id: createdChangeRequest.connection_id,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test'
        } satisfies ChangeSchema.Change
        const insertedChange = await ChangeService.insertChange(getDb(), change)

        const primaryKey = {
          id: randomUUID(),
          change_id: insertedChange.id,
          column_name: 'id',
          string_value: undefined,
          numeric_value: undefined,
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: testRow.id
        } satisfies ChangeSchema.ChangePrimaryKey
        await ChangeService.insertChangePrimaryKey(getDb(), primaryKey)

        const changeFieldValues2 = {
          id: randomUUID(),
          change_id: insertedChange.id,
          column_name: 'test_numeric',
          string_value: undefined,
          numeric_value: 200,
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: undefined,
          is_value_null: false
        } satisfies ChangeSchema.ChangeFieldValue
        await ChangeService.insertChangeFieldValue(getDb(), changeFieldValues2)

        const job = await ChangeJobService.insertTestJob({
          id: randomUUID(),
          status: 'PENDING',
          change_request_id: createdChangeRequest.id,
          start_time: null,
          end_time: null,
          updated_at: new Date(),
          created_at: new Date(),
          error_message: null,
          rows_affected: null
        } satisfies ChangeType.ChangeRequestJobSelect)

        const controller = new ChangesExecutionJobController(job)
        await controller.runJob()

        const finishedJob = await ChangeJobService.getChangeJobById(
          getDb(),
          job.id
        )
        expect(finishedJob).toEqual({
          ...job,
          status: 'COMPLETED',
          start_time: expect.any(Date),
          end_time: expect.any(Date),
          updated_at: expect.any(Date),
          rows_affected: 1
        })

        const cr = await ChangeRequestService.getChangeRequestById(
          createdChangeRequest.id
        )
        expect(cr.status).toEqual('applied')

        const user = await UserService.getSortBotSvcUser(getDb(), config)
        const timeline = await getChangeRequestTimeline(cr.id)
        const item = timeline.at(-1)
        expect(item).toEqual({
          action_type: 'COMPLETE_EXECUTE',
          id: expect.any(String),
          change_request_id: cr.id,
          user: {
            id: user.id,
            name: user.name,
            picture: user.picture,
            username: user.username
          },
          action_details: {
            change_request_job_id: job.id,
            num_affected_rows: 1
          },
          created_at: expect.any(Date)
        })

        const updatedRow = await getDb()
          .selectFrom('test.change_request_test')
          .where('id', '=', testRow.id)
          .selectAll()
          .executeTakeFirstOrThrow()

        expect(updatedRow.test_numeric).toEqual('200')
      })

      it('should delete a change with one numeric value and one generated UUID value', async () => {
        const testRow = await testTableMock.insert(
          testTableMock.create({
            test_numeric: '100'
          })
        )

        const change = {
          id: randomUUID(),
          change_request_id: createdChangeRequest.id,
          index: 0,
          action: 'DELETE',
          connection_id: createdChangeRequest.connection_id,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test'
        } satisfies ChangeSchema.Change
        const insertedChange = await ChangeService.insertChange(getDb(), change)

        const primaryKey = {
          id: randomUUID(),
          change_id: insertedChange.id,
          column_name: 'id',
          string_value: undefined,
          numeric_value: undefined,
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: testRow.id
        } satisfies ChangeSchema.ChangePrimaryKey
        await ChangeService.insertChangePrimaryKey(getDb(), primaryKey)

        const job = await ChangeJobService.insertTestJob({
          id: randomUUID(),
          status: 'PENDING',
          change_request_id: createdChangeRequest.id,
          start_time: null,
          end_time: null,
          updated_at: new Date(),
          created_at: new Date(),
          error_message: null,
          rows_affected: null
        } satisfies ChangeType.ChangeRequestJobSelect)

        const controller = new ChangesExecutionJobController(job)
        await controller.runJob()

        const finishedJob = await ChangeJobService.getChangeJobById(
          getDb(),
          job.id
        )
        expect(finishedJob).toEqual({
          ...job,
          status: 'COMPLETED',
          start_time: expect.any(Date),
          end_time: expect.any(Date),
          updated_at: expect.any(Date),
          rows_affected: 1
        })

        const cr = await ChangeRequestService.getChangeRequestById(
          createdChangeRequest.id
        )
        expect(cr.status).toEqual('applied')

        const user = await UserService.getSortBotSvcUser(getDb(), config)
        const timeline = await getChangeRequestTimeline(cr.id)
        const item = timeline.at(-1)
        expect(item).toEqual({
          action_type: 'COMPLETE_EXECUTE',
          id: expect.any(String),
          change_request_id: cr.id,
          user: {
            id: user.id,
            name: user.name,
            picture: user.picture,
            username: user.username
          },
          action_details: {
            change_request_job_id: job.id,
            num_affected_rows: 1
          },
          created_at: expect.any(Date)
        })

        const deletedRow = await getDb()
          .selectFrom('test.change_request_test')
          .where('id', '=', testRow.id)
          .selectAll()
          .executeTakeFirst()

        expect(deletedRow).toBeUndefined()
      })

      it('should insert two changes with one numeric value; one string, with generated UUID ids', async () => {
        const changeOne = {
          id: randomUUID(),
          change_request_id: createdChangeRequest.id,
          index: 0,
          action: 'ADD',
          connection_id: createdChangeRequest.connection_id,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test'
        } satisfies ChangeSchema.Change
        const insertedChangeOne = await ChangeService.insertChange(
          getDb(),
          changeOne
        )

        const changeFieldValuesOne = {
          id: randomUUID(),
          change_id: insertedChangeOne.id,
          column_name: 'id',
          string_value: undefined,
          numeric_value: undefined,
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: randomUUID(),
          is_value_null: false
        } satisfies ChangeSchema.ChangeFieldValue
        await ChangeService.insertChangeFieldValue(
          getDb(),
          changeFieldValuesOne
        )

        const changeFieldValuesOne2 = {
          id: randomUUID(),
          change_id: insertedChangeOne.id,
          column_name: 'test_numeric',
          string_value: undefined,
          numeric_value: 200,
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: undefined,
          is_value_null: false
        } satisfies ChangeSchema.ChangeFieldValue
        await ChangeService.insertChangeFieldValue(
          getDb(),
          changeFieldValuesOne2
        )

        const changeTwo = {
          id: randomUUID(),
          change_request_id: createdChangeRequest.id,
          index: 1,
          action: 'ADD',
          connection_id: createdChangeRequest.connection_id,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test'
        } satisfies ChangeSchema.Change
        const insertedChangeTwo = await ChangeService.insertChange(
          getDb(),
          changeTwo
        )

        const changeFieldValuesTwo = {
          id: randomUUID(),
          change_id: insertedChangeTwo.id,
          column_name: 'id',
          string_value: undefined,
          numeric_value: undefined,
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: randomUUID(),
          is_value_null: false
        } satisfies ChangeSchema.ChangeFieldValue
        await ChangeService.insertChangeFieldValue(
          getDb(),
          changeFieldValuesTwo
        )

        const changeFieldValuesTwo2 = {
          id: randomUUID(),
          change_id: insertedChangeTwo.id,
          column_name: 'test_timestamp',
          string_value: undefined,
          numeric_value: undefined,
          date_value: new Date(),
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: undefined,
          is_value_null: false
        } satisfies ChangeSchema.ChangeFieldValue
        await ChangeService.insertChangeFieldValue(
          getDb(),
          changeFieldValuesTwo2
        )

        const job = await ChangeJobService.insertTestJob({
          id: randomUUID(),
          status: 'PENDING',
          change_request_id: createdChangeRequest.id,
          start_time: null,
          end_time: null,
          updated_at: new Date(),
          created_at: new Date(),
          error_message: null,
          rows_affected: null
        } satisfies ChangeType.ChangeRequestJobSelect)

        const controller = new ChangesExecutionJobController(job)
        await controller.runJob()

        const finishedJob = await ChangeJobService.getChangeJobById(
          getDb(),
          job.id
        )
        expect(finishedJob).toEqual({
          ...job,
          status: 'COMPLETED',
          start_time: expect.any(Date),
          end_time: expect.any(Date),
          updated_at: expect.any(Date),
          rows_affected: 2
        })

        const cr = await ChangeRequestService.getChangeRequestById(
          createdChangeRequest.id
        )
        expect(cr.status).toEqual('applied')

        const user = await UserService.getSortBotSvcUser(getDb(), config)
        const timeline = await getChangeRequestTimeline(cr.id)
        const item = timeline.at(-1)
        expect(item).toEqual({
          action_type: 'COMPLETE_EXECUTE',
          id: expect.any(String),
          change_request_id: cr.id,
          user: {
            id: user.id,
            name: user.name,
            picture: user.picture,
            username: user.username
          },
          action_details: {
            change_request_job_id: job.id,
            num_affected_rows: 2
          },
          created_at: expect.any(Date)
        })
      })

      it('supports inserting values for all column types', async () => {
        const testRow = testTableMock.create({
          test_numeric: '100'
        })
        const testRowId = testRow.id

        const changes = [
          {
            id: randomUUID(),
            change_request_id: createdChangeRequest.id,
            index: 0,
            action: 'ADD',
            connection_id: createdChangeRequest.connection_id,
            metadata_database_name: 'sort_xyz',
            metadata_schema_name: 'test',
            metadata_table_name: 'change_request_test'
          }
        ] satisfies ChangeSchema.Change[]

        const insertedChanges = await Promise.all(
          changes.map(chg => ChangeService.insertChange(getDb(), chg))
        )

        const jsonValue = { super: ['Mario World 64'] }
        const datetimeValue = new Date()

        const changeFieldValues1 = [
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'id',
            uuid_value: testRowId,
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_uuid',
            is_value_null: false,
            uuid_value: '7d1e09f3-cda8-438a-b2dc-b8fa242796a2'
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_numeric',
            numeric_value: 47,
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_boolean',
            boolean_value: true,
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_jsonb',
            json_value: jsonValue,
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_text',
            string_value: 'Far Harbor',
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_timestamp',
            date_value: datetimeValue,
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_timestamptz',
            date_value: datetimeValue,
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_date',
            date_value: datetimeValue,
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_binary',
            binary_value: Buffer.from('hello world').toString('base64'),
            is_value_null: false
          }
        ] satisfies ChangeSchema.ChangeFieldValue[]

        await Promise.all(
          changeFieldValues1.map(cfv =>
            ChangeService.insertChangeFieldValue(getDb(), cfv)
          )
        )

        const job = await ChangeJobService.insertTestJob({
          id: randomUUID(),
          status: 'PENDING',
          change_request_id: createdChangeRequest.id,
          start_time: null,
          end_time: null,
          updated_at: new Date(),
          created_at: new Date(),
          error_message: null,
          rows_affected: null
        } satisfies ChangeType.ChangeRequestJobSelect)

        const controller = new ChangesExecutionJobController(job)
        await controller.runJob()

        const finishedJob = await ChangeJobService.getChangeJobById(
          getDb(),
          job.id
        )
        expect(finishedJob).toEqual({
          ...job,
          status: 'COMPLETED',
          start_time: expect.any(Date),
          end_time: expect.any(Date),
          updated_at: expect.any(Date),
          rows_affected: 1
        })

        const cr = await ChangeRequestService.getChangeRequestById(
          createdChangeRequest.id
        )
        expect(cr.status).toEqual('applied')

        const user = await UserService.getSortBotSvcUser(getDb(), config)
        const timeline = await getChangeRequestTimeline(cr.id)
        const item = timeline.at(-1)
        expect(item).toEqual({
          action_type: 'COMPLETE_EXECUTE',
          id: expect.any(String),
          change_request_id: cr.id,
          user: {
            id: user.id,
            name: user.name,
            picture: user.picture,
            username: user.username
          },
          action_details: {
            change_request_job_id: job.id,
            num_affected_rows: 1
          },
          created_at: expect.any(Date)
        })

        const result = await getDb()
          .selectFrom('test.change_request_test')
          .where('id', '=', testRowId)
          .selectAll()
          .executeTakeFirst()

        expect(result).toEqual({
          id: testRowId,
          test_uuid: '7d1e09f3-cda8-438a-b2dc-b8fa242796a2',
          test_numeric: '47',
          test_boolean: true,
          test_jsonb: jsonValue,
          test_text: 'Far Harbor',
          test_timestamp: datetimeValue,
          test_timestamptz: datetimeValue,
          test_date: new Date(datetimeValue.toDateString()),
          test_binary: Buffer.from(
            Buffer.from('hello world').toString('base64')
          )
        })
      })

      it('supports inserting null for all column types', async () => {
        const testRow = testTableMock.create({
          test_numeric: '100'
        })
        const testRowId = testRow.id

        const changes = [
          {
            id: randomUUID(),
            change_request_id: createdChangeRequest.id,
            index: 0,
            action: 'ADD',
            connection_id: createdChangeRequest.connection_id,
            metadata_database_name: 'sort_xyz',
            metadata_schema_name: 'test',
            metadata_table_name: 'change_request_test'
          }
        ] satisfies ChangeSchema.Change[]

        const insertedChanges = await Promise.all(
          changes.map(chg => ChangeService.insertChange(getDb(), chg))
        )

        const changeFieldValues = [
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'id',
            uuid_value: testRowId,
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_uuid',
            is_value_null: true
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_numeric',
            is_value_null: true
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_boolean',
            is_value_null: true
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_jsonb',
            is_value_null: true
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_text',
            is_value_null: true
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_timestamp',
            is_value_null: true
          },
          {
            id: randomUUID(),
            change_id: insertedChanges[0].id,
            column_name: 'test_binary',
            is_value_null: true
          }
        ] satisfies ChangeSchema.ChangeFieldValue[]

        await Promise.all(
          changeFieldValues.map(cfv =>
            ChangeService.insertChangeFieldValue(getDb(), cfv)
          )
        )

        const job = await ChangeJobService.insertTestJob({
          id: randomUUID(),
          status: 'PENDING',
          change_request_id: createdChangeRequest.id,
          start_time: null,
          end_time: null,
          updated_at: new Date(),
          created_at: new Date(),
          error_message: null,
          rows_affected: null
        } satisfies ChangeType.ChangeRequestJobSelect)

        const controller = new ChangesExecutionJobController(job)
        await controller.runJob()

        const finishedJob = await ChangeJobService.getChangeJobById(
          getDb(),
          job.id
        )
        expect(finishedJob).toEqual({
          ...job,
          status: 'COMPLETED',
          start_time: expect.any(Date),
          end_time: expect.any(Date),
          updated_at: expect.any(Date),
          rows_affected: 1
        })

        const cr = await ChangeRequestService.getChangeRequestById(
          createdChangeRequest.id
        )
        expect(cr.status).toEqual('applied')

        const user = await UserService.getSortBotSvcUser(getDb(), config)
        const timeline = await getChangeRequestTimeline(cr.id)
        const item = timeline.at(-1)
        expect(item).toEqual({
          action_type: 'COMPLETE_EXECUTE',
          id: expect.any(String),
          change_request_id: cr.id,
          user: {
            id: user.id,
            name: user.name,
            picture: user.picture,
            username: user.username
          },
          action_details: {
            change_request_job_id: job.id,
            num_affected_rows: 1
          },
          created_at: expect.any(Date)
        })

        const result = await getDb()
          .selectFrom('test.change_request_test')
          .where('id', '=', testRowId)
          .selectAll()
          .executeTakeFirst()

        expect(result).toEqual({
          id: testRowId,
          test_uuid: null,
          test_numeric: null,
          test_boolean: null,
          test_jsonb: null,
          test_text: null,
          test_timestamp: null,
          test_timestamptz: null,
          test_date: null,
          test_binary: null
        })
      })

      it('supports updating values for all column types', async () => {
        const testRow = await testTableMock.insert(
          testTableMock.create({
            test_numeric: '100'
          })
        )
        const testRowId = testRow.id

        const change = {
          id: randomUUID(),
          change_request_id: createdChangeRequest.id,
          index: 0,
          action: 'MODIFY',
          connection_id: createdChangeRequest.connection_id,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test'
        } satisfies ChangeSchema.Change
        const insertedChange = await ChangeService.insertChange(getDb(), change)

        const primaryKey = {
          id: randomUUID(),
          change_id: insertedChange.id,
          column_name: 'id',
          uuid_value: testRow.id
        } satisfies ChangeSchema.ChangePrimaryKey
        await ChangeService.insertChangePrimaryKey(getDb(), primaryKey)

        const jsonValue = { question: ['Answer'] }
        const datetimeValue = new Date(new Date().getTime() + 10000)
        const uuidValue = '11111111-cda8-438a-b2dc-b8fa00000000'
        const numericValue = 108
        const booleanValue = false
        const stringValue = 'Nuka World'

        const changeFieldValues = [
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_uuid',
            is_value_null: false,
            uuid_value: uuidValue
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_numeric',
            numeric_value: numericValue,
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_boolean',
            boolean_value: booleanValue,
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_jsonb',
            json_value: jsonValue,
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_text',
            string_value: stringValue,
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_timestamp',
            date_value: datetimeValue,
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_timestamptz',
            date_value: datetimeValue,
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_date',
            date_value: datetimeValue,
            is_value_null: false
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_binary',
            binary_value: Buffer.from('hello world').toString('base64'),
            is_value_null: false
          }
        ] satisfies ChangeSchema.ChangeFieldValue[]

        await Promise.all(
          changeFieldValues.map(cfv =>
            ChangeService.insertChangeFieldValue(getDb(), cfv)
          )
        )

        const job = await ChangeJobService.insertTestJob({
          id: randomUUID(),
          status: 'PENDING',
          change_request_id: createdChangeRequest.id,
          start_time: null,
          end_time: null,
          updated_at: new Date(),
          created_at: new Date(),
          error_message: null,
          rows_affected: null
        } satisfies ChangeType.ChangeRequestJobSelect)

        const controller = new ChangesExecutionJobController(job)
        await controller.runJob()

        const finishedJob = await ChangeJobService.getChangeJobById(
          getDb(),
          job.id
        )
        expect(finishedJob).toEqual({
          ...job,
          status: 'COMPLETED',
          start_time: expect.any(Date),
          end_time: expect.any(Date),
          updated_at: expect.any(Date),
          rows_affected: 1
        })

        const cr = await ChangeRequestService.getChangeRequestById(
          createdChangeRequest.id
        )
        expect(cr.status).toEqual('applied')

        const user = await UserService.getSortBotSvcUser(getDb(), config)
        const timeline = await getChangeRequestTimeline(cr.id)
        const item = timeline.at(-1)
        expect(item).toEqual({
          action_type: 'COMPLETE_EXECUTE',
          id: expect.any(String),
          change_request_id: cr.id,
          user: {
            id: user.id,
            name: user.name,
            picture: user.picture,
            username: user.username
          },
          action_details: {
            change_request_job_id: job.id,
            num_affected_rows: 1
          },
          created_at: expect.any(Date)
        })

        const result = await getDb()
          .selectFrom('test.change_request_test')
          .where('id', '=', testRowId)
          .selectAll()
          .executeTakeFirst()

        expect(result).toEqual({
          id: testRowId,
          test_uuid: uuidValue,
          test_numeric: numericValue.toString(),
          test_boolean: booleanValue,
          test_jsonb: jsonValue,
          test_text: stringValue,
          test_timestamp: datetimeValue,
          test_timestamptz: datetimeValue,
          test_date: new Date(datetimeValue.toDateString()),
          test_binary: Buffer.from(
            Buffer.from('hello world').toString('base64')
          )
        })
      })

      it('supports updating null for all column types', async () => {
        const testRow = await testTableMock.insert(
          testTableMock.create({
            test_numeric: '100'
          })
        )

        const change = {
          id: randomUUID(),
          change_request_id: createdChangeRequest.id,
          index: 0,
          action: 'MODIFY',
          connection_id: createdChangeRequest.connection_id,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test'
        } satisfies ChangeSchema.Change
        const insertedChange = await ChangeService.insertChange(getDb(), change)

        const primaryKey = {
          id: randomUUID(),
          change_id: insertedChange.id,
          column_name: 'id',
          string_value: undefined,
          numeric_value: undefined,
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: testRow.id
        } satisfies ChangeSchema.ChangePrimaryKey
        await ChangeService.insertChangePrimaryKey(getDb(), primaryKey)

        const changeFieldValues = [
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_uuid',
            is_value_null: true
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_numeric',
            is_value_null: true
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_boolean',
            is_value_null: true
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_jsonb',
            is_value_null: true
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_text',
            is_value_null: true
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_timestamp',
            is_value_null: true
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_timestamptz',
            is_value_null: true
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_date',
            is_value_null: true
          },
          {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_binary',
            is_value_null: true
          }
        ] satisfies ChangeSchema.ChangeFieldValue[]

        await Promise.all(
          changeFieldValues.map(cfv =>
            ChangeService.insertChangeFieldValue(getDb(), cfv)
          )
        )

        const job = await ChangeJobService.insertTestJob({
          id: randomUUID(),
          status: 'PENDING',
          change_request_id: createdChangeRequest.id,
          start_time: null,
          end_time: null,
          updated_at: new Date(),
          created_at: new Date(),
          error_message: null,
          rows_affected: null
        } satisfies ChangeType.ChangeRequestJobSelect)

        const controller = new ChangesExecutionJobController(job)
        await controller.runJob()

        const finishedJob = await ChangeJobService.getChangeJobById(
          getDb(),
          job.id
        )
        expect(finishedJob).toEqual({
          ...job,
          status: 'COMPLETED',
          start_time: expect.any(Date),
          end_time: expect.any(Date),
          updated_at: expect.any(Date),
          rows_affected: 1
        })

        const cr = await ChangeRequestService.getChangeRequestById(
          createdChangeRequest.id
        )
        expect(cr.status).toEqual('applied')

        const user = await UserService.getSortBotSvcUser(getDb(), config)
        const timeline = await getChangeRequestTimeline(cr.id)
        const item = timeline.at(-1)
        expect(item).toEqual({
          action_type: 'COMPLETE_EXECUTE',
          id: expect.any(String),
          change_request_id: cr.id,
          user: {
            id: user.id,
            name: user.name,
            picture: user.picture,
            username: user.username
          },
          action_details: {
            change_request_job_id: job.id,
            num_affected_rows: 1
          },
          created_at: expect.any(Date)
        })

        const result = await getDb()
          .selectFrom('test.change_request_test')
          .where('id', '=', testRow.id)
          .selectAll()
          .executeTakeFirst()

        expect(result).toEqual({
          id: testRow.id,
          test_uuid: null,
          test_numeric: null,
          test_boolean: null,
          test_jsonb: null,
          test_text: null,
          test_timestamp: null,
          test_date: null,
          test_timestamptz: null,
          test_binary: null
        })
      })

      it('supports recapture of primary keys after insert', async () => {
        const change = {
          id: randomUUID(),
          change_request_id: createdChangeRequest2.id,
          index: 0,
          action: 'ADD',
          connection_id: createdChangeRequest2.connection_id,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test_all_primary_keys'
        } satisfies ChangeSchema.Change
        const insertedChange = await ChangeService.insertChange(getDb(), change)

        const id = randomUUID()
        const changeFieldValues = {
          id: randomUUID(),
          change_id: insertedChange.id,
          column_name: 'id',
          string_value: undefined,
          numeric_value: undefined,
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: id,
          binary_value: undefined,
          is_value_null: false
        } satisfies ChangeSchema.ChangeFieldValue
        await ChangeService.insertChangeFieldValue(getDb(), changeFieldValues)
        testTableAllPrimaryKeysMock.addId(id)

        const changeFieldValues2 = {
          id: randomUUID(),
          change_id: insertedChange.id,
          column_name: 'numeric_id',
          string_value: undefined,
          numeric_value: 200,
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: undefined,
          binary_value: undefined,
          is_value_null: false
        } satisfies ChangeSchema.ChangeFieldValue
        await ChangeService.insertChangeFieldValue(getDb(), changeFieldValues2)

        const changeFieldValues3 = {
          id: randomUUID(),
          change_id: insertedChange.id,
          column_name: 'boolean_id',
          string_value: undefined,
          numeric_value: undefined,
          date_value: undefined,
          boolean_value: true,
          json_value: undefined,
          uuid_value: undefined,
          binary_value: undefined,
          is_value_null: false
        } satisfies ChangeSchema.ChangeFieldValue
        await ChangeService.insertChangeFieldValue(getDb(), changeFieldValues3)

        const changeFieldValues4 = {
          id: randomUUID(),
          change_id: insertedChange.id,
          column_name: 'jsonb_id',
          string_value: undefined,
          numeric_value: undefined,
          date_value: undefined,
          boolean_value: undefined,
          json_value: JSON.stringify({ foo: 'bar' }),
          uuid_value: undefined,
          binary_value: undefined,
          is_value_null: false
        } satisfies ChangeSchema.ChangeFieldValue
        await ChangeService.insertChangeFieldValue(getDb(), changeFieldValues4)

        const changeFieldValues5 = {
          id: randomUUID(),
          change_id: insertedChange.id,
          column_name: 'timestamp_id',
          string_value: undefined,
          numeric_value: undefined,
          date_value: new Date('2024-05-15T15:04:05Z'),
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: undefined,
          binary_value: undefined,
          is_value_null: false
        } satisfies ChangeSchema.ChangeFieldValue
        await ChangeService.insertChangeFieldValue(getDb(), changeFieldValues5)

        const changeFieldValues6 = {
          id: randomUUID(),
          change_id: insertedChange.id,
          column_name: 'binary_id',
          string_value: undefined,
          numeric_value: undefined,
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: undefined,
          binary_value: Buffer.from('hello world').toString('base64'),
          is_value_null: false
        } satisfies ChangeSchema.ChangeFieldValue
        await ChangeService.insertChangeFieldValue(getDb(), changeFieldValues6)

        const job = await ChangeJobService.insertTestJob({
          id: randomUUID(),
          status: 'PENDING',
          change_request_id: createdChangeRequest2.id,
          start_time: null,
          end_time: null,
          updated_at: new Date(),
          created_at: new Date(),
          error_message: null,
          rows_affected: null
        } satisfies ChangeType.ChangeRequestJobSelect)

        const controller = new ChangesExecutionJobController(job)
        await controller.runJob()

        const finishedJob = await ChangeJobService.getChangeJobById(
          getDb(),
          job.id
        )
        expect(finishedJob).toEqual({
          ...job,
          status: 'COMPLETED',
          start_time: expect.any(Date),
          end_time: expect.any(Date),
          updated_at: expect.any(Date),
          rows_affected: 1
        })

        const cr = await ChangeRequestService.getChangeRequestById(
          createdChangeRequest2.id
        )
        expect(cr.status).toEqual('applied')

        const user = await UserService.getSortBotSvcUser(getDb(), config)
        const timeline = await getChangeRequestTimeline(cr.id)
        const item = timeline.at(-1)
        expect(item).toEqual({
          action_type: 'COMPLETE_EXECUTE',
          id: expect.any(String),
          change_request_id: cr.id,
          user: {
            id: user.id,
            name: user.name,
            picture: user.picture,
            username: user.username
          },
          action_details: {
            change_request_job_id: job.id,
            num_affected_rows: 1
          },
          created_at: expect.any(Date)
        })

        const dbResult = await getDb()
          .selectFrom('test.change_request_test_all_primary_keys')
          .where('id', '=', id)
          .selectAll()
          .executeTakeFirst()

        expect(dbResult).toEqual({
          id,
          binary_id: Buffer.from(Buffer.from('hello world').toString('base64')),
          boolean_id: true,
          jsonb_id: { foo: 'bar' },
          numeric_id: '200',
          timestamp_id: new Date('2024-05-15T15:04:05Z')
        })

        const keys = await getDb()
          .selectFrom('change_previous_primary_key')
          .where('change_id', '=', insertedChange.id)
          .selectAll()
          .execute()

        expect(keys).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              change_id: insertedChange.id,
              column_name: 'id',
              uuid_value: id
            }),
            expect.objectContaining({
              id: expect.any(String),
              change_id: insertedChange.id,
              column_name: 'numeric_id',
              numeric_value: '200'
            }),
            expect.objectContaining({
              id: expect.any(String),
              change_id: insertedChange.id,
              column_name: 'boolean_id',
              boolean_value: true
            }),
            expect.objectContaining({
              id: expect.any(String),
              change_id: insertedChange.id,
              column_name: 'jsonb_id',
              json_value: { foo: 'bar' }
            }),
            expect.objectContaining({
              id: expect.any(String),
              change_id: insertedChange.id,
              column_name: 'timestamp_id',
              date_value: new Date('2024-05-15T15:04:05Z')
            }),
            expect.objectContaining({
              id: expect.any(String),
              change_id: insertedChange.id,
              column_name: 'binary_id',
              binary_value: Buffer.from(
                Buffer.from('hello world').toString('base64')
              )
            })
          ])
        )
      })
    })

    describe('when the transaction fails', () => {
      it('updates the job, change request, and timeline', async () => {
        const change = {
          id: randomUUID(),
          change_request_id: createdChangeRequest.id,
          index: 0,
          action: 'ADD',
          connection_id: createdChangeRequest.connection_id,
          metadata_database_name: 'sort_xyz',
          metadata_schema_name: 'test',
          metadata_table_name: 'change_request_test'
        } satisfies ChangeSchema.Change
        const insertedChange = await ChangeService.insertChange(getDb(), change)

        const changeFieldValues1 = {
          id: randomUUID(),
          change_id: insertedChange.id,
          column_name: 'id',
          string_value: undefined,
          numeric_value: undefined,
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: randomUUID(),
          is_value_null: false
        } satisfies ChangeSchema.ChangeFieldValue
        await ChangeService.insertChangeFieldValue(getDb(), changeFieldValues1)

        const changeFieldValues2 = {
          id: randomUUID(),
          change_id: insertedChange.id,
          column_name: 'test_numeric',
          string_value: undefined,
          numeric_value: 200,
          date_value: undefined,
          boolean_value: undefined,
          json_value: undefined,
          uuid_value: undefined,
          is_value_null: false
        } satisfies ChangeSchema.ChangeFieldValue
        await ChangeService.insertChangeFieldValue(getDb(), changeFieldValues2)

        const job = await ChangeJobService.insertTestJob({
          id: randomUUID(),
          status: 'PENDING',
          change_request_id: createdChangeRequest.id,
          start_time: null,
          end_time: null,
          updated_at: new Date(),
          created_at: new Date(),
          error_message: null,
          rows_affected: null
        } satisfies ChangeType.ChangeRequestJobSelect)

        const cols = sql.join(['a', 'b', 'c'].map(v => sql.id(v)))
        jest
          .spyOn(KyselyExtractor.prototype, 'extractSQL')
          .mockImplementationOnce(() => {
            return [
              {
                statement: sql`insert into bark (${cols}) values (${sql.join(
                  [1, 2, 3],
                  sql`, `
                )});`,
                change: insertedChange,
                keys: undefined
              }
            ]
          })

        const controller = new ChangesExecutionJobController(job)
        await controller.runJob()

        const finishedJob = await ChangeJobService.getChangeJobById(
          getDb(),
          job.id
        )
        expect(finishedJob).toEqual({
          ...job,
          status: 'FAILED',
          start_time: expect.any(Date),
          end_time: expect.any(Date),
          updated_at: expect.any(Date),
          error_message: expect.any(String)
        })

        const cr = await ChangeRequestService.getChangeRequestById(
          createdChangeRequest.id
        )
        expect(cr.status).toEqual('approved')

        const user = await UserService.getSortBotSvcUser(getDb(), config)
        const timeline = await getChangeRequestTimeline(cr.id)
        const item = timeline.at(-1)
        expect(item).toEqual({
          action_type: 'FAIL_EXECUTE',
          id: expect.any(String),
          change_request_id: cr.id,
          user: {
            id: user.id,
            name: user.name,
            picture: user.picture,
            username: user.username
          },
          action_details: {
            change_request_job_id: job.id,
            code: 'EXECUTION_FAILURE',
            sql: 'insert into bark ("a", "b", "c") values (1, 2, 3);',
            reason: 'relation "bark" does not exist'
          },
          created_at: expect.any(Date)
        })
      })
    })
  })

  describe('#endJob', () => {
    describe('when error is passed', () => {
      describe('when unable to update job', () => {
        it('uses logger.error to report', async () => {
          const change = {
            id: randomUUID(),
            change_request_id: createdChangeRequest.id,
            index: 0,
            action: 'ADD',
            connection_id: createdChangeRequest.connection_id,
            metadata_database_name: 'sort_xyz',
            metadata_schema_name: 'test',
            metadata_table_name: 'change_request_test'
          } satisfies ChangeSchema.Change

          const insertedChange = await ChangeService.insertChange(
            getDb(),
            change
          )

          const changeFieldValues = {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'id',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: randomUUID(),
            is_value_null: false
          } satisfies ChangeSchema.ChangeFieldValue

          await ChangeService.insertChangeFieldValue(getDb(), changeFieldValues)

          const changeFieldValues2 = {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_numeric',
            string_value: undefined,
            numeric_value: 200,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined,
            is_value_null: false
          } satisfies ChangeSchema.ChangeFieldValue

          await ChangeService.insertChangeFieldValue(
            getDb(),
            changeFieldValues2
          )

          const job = await ChangeJobService.insertTestJob({
            id: randomUUID(),
            status: 'PENDING',
            change_request_id: createdChangeRequest.id,
            start_time: null,
            end_time: null,
            updated_at: new Date(),
            created_at: new Date(),
            error_message: null,
            rows_affected: null
          } satisfies ChangeType.ChangeRequestJobSelect)

          const mockGetJobFail = new Error('mock getJob fail')
          jest
            .spyOn(ChangeJobService, 'getChangeJobById')
            .mockRejectedValueOnce(mockGetJobFail)

          const mockUpdateJobFail = new Error('mock updateJob fail')
          jest
            .spyOn(ChangeJobService, 'updateJob')
            .mockRejectedValueOnce(mockUpdateJobFail)

          const controller = new ChangesExecutionJobController(job)
          const mockLogger = jest
            .spyOn(controller.log, 'error')
            .mockImplementation()

          await controller.runJob()

          expect(mockLogger).toHaveBeenCalledWith(
            mockGetJobFail,
            'mock getJob fail'
          )
          expect(mockLogger).toHaveBeenCalledWith(
            mockUpdateJobFail,
            'Failed to update job state to FAILED.'
          )
        })
      })
    })

    describe('when no error is passed', () => {
      describe('when unable to update job', () => {
        it('uses logger.error to report', async () => {
          const change = {
            id: randomUUID(),
            change_request_id: createdChangeRequest.id,
            index: 0,
            action: 'ADD',
            connection_id: createdChangeRequest.connection_id,
            metadata_database_name: 'sort_xyz',
            metadata_schema_name: 'test',
            metadata_table_name: 'change_request_test'
          } satisfies ChangeSchema.Change

          const insertedChange = await ChangeService.insertChange(
            getDb(),
            change
          )

          const changeFieldValues = {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'id',
            string_value: undefined,
            numeric_value: undefined,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: randomUUID(),
            is_value_null: false
          } satisfies ChangeSchema.ChangeFieldValue

          await ChangeService.insertChangeFieldValue(getDb(), changeFieldValues)

          const changeFieldValues2 = {
            id: randomUUID(),
            change_id: insertedChange.id,
            column_name: 'test_numeric',
            string_value: undefined,
            numeric_value: 200,
            date_value: undefined,
            boolean_value: undefined,
            json_value: undefined,
            uuid_value: undefined,
            is_value_null: false
          } satisfies ChangeSchema.ChangeFieldValue

          await ChangeService.insertChangeFieldValue(
            getDb(),
            changeFieldValues2
          )

          const job = await ChangeJobService.insertTestJob({
            id: randomUUID(),
            status: 'PENDING',
            change_request_id: createdChangeRequest.id,
            start_time: null,
            end_time: null,
            updated_at: new Date(),
            created_at: new Date(),
            error_message: null,
            rows_affected: null
          } satisfies ChangeType.ChangeRequestJobSelect)

          const mockGetUserFail = new Error('mock get svc user fail')
          jest
            .spyOn(UserService, 'getSortBotSvcUser')
            .mockRejectedValueOnce(mockGetUserFail)

          const controller = new ChangesExecutionJobController(job)

          const mockLogger = jest
            .spyOn(controller.log, 'error')
            .mockImplementation()

          await controller.runJob()

          expect(mockLogger).toHaveBeenCalledTimes(1)
          expect(mockLogger).toHaveBeenCalledWith(
            mockGetUserFail,
            'Failed to update job state to COMPLETED.'
          )
        })
      })
    })
  })
})
