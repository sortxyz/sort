import { randomUUID } from 'node:crypto'

import { getDb, createKysely, disconnectKysely } from '../..'
import * as ChangeRequestService from '../../services/change-requests/change-request.service'
import * as ChangeService from '../../services/changes/change.service'
import * as ConnectionService from '../../services/connection.service'
import * as MetadataDatabaseService from '../../services/kysely/metadata/database.service'
import * as MetadataTableService from '../../services/kysely/metadata/table.service'
import * as LabelService from '../../services/label.service'
import * as OrganizationService from '../../services/org.service'
import * as UserService from '../../services/user.service'
import { ConnectionMock, postgresConnectionMock } from '../connection.mock'
import { LabelMock } from '../label.mock'
import { MetadataDatabaseMock, MetadataTableMock } from '../metadata.mock'
import { OrganizationMock } from '../org.mock'
import { SnapshotMock } from '../snapshot/postgres.snapshot.mock'
import { UserMock } from '../user.mock'

import { ChangeRequestMock } from './change-request.mock'
import { ChangeMock } from './change.mock'

import type * as ChangeSchema from '../../schemas/change.schema'
import type * as OrganizationMemberSchema from '../../schemas/org-member.schema'
import type { ConnectionSelectWithEncryption } from '../../types/kysely/connection/connection.type'
import type { SortDB } from '../../types/kysely.type'

let createdChangeRequest: Awaited<
  ReturnType<typeof ChangeRequestService.createChangeRequest>
>

// This area serves to demonstrate what a change mock test could look like
describe('Change mock tests', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const snapshotMocks = new SnapshotMock()
  const connMock = new ConnectionMock()
  const dbMock = new MetadataDatabaseMock()
  const tableMock = new MetadataTableMock()
  const changeRequestMock = new ChangeRequestMock()
  const changeMock = new ChangeMock()
  const labelMock = new LabelMock()

  const orgOwner = userMock.create()
  const org = orgMock.create()

  let tableEntry: SortDB['metadata_table']
  let dbEntry: SortDB['metadata_database']
  let conn: ConnectionSelectWithEncryption

  async function cleanUp() {
    await connMock.removeAll()
    await changeMock.removeAll()
    await snapshotMocks.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()
  }

  afterAll(async () => {
    await cleanUp()

    await disconnectKysely()
  })

  beforeAll(async () => {
    createKysely()

    const user = await UserService.createUser(orgOwner)

    await OrganizationService.create({
      ...org,
      created_by: user.id
    })

    conn = connMock.create({
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
    tableEntry = tableMock.create({
      connection_id: conn.id,
      raw_database_name: dbEntry.raw_name,
      raw_schema_name: 'test',
      raw_name: 'change_request_test'
    })
    await MetadataTableService.insertTable(tableEntry)
    const label1 = labelMock.create({
      connection_id: conn.id,
      database_name: dbEntry.raw_name
    })
    await LabelService.createDatabaseLabel(label1)
    const label2 = labelMock.create({
      connection_id: conn.id,
      database_name: dbEntry.raw_name
    })
    await LabelService.createDatabaseLabel(label2)

    // TODO: Create an OrganizationMemberMock
    const orgOwnerMember = {
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

    const mockChangeRequest = changeRequestMock.create({
      id: randomUUID(),
      connection_id: dbEntry.connection_id,
      database_name: dbEntry.raw_name,
      created_by: user.id,
      title: 'Detailed Test Change Request',
      description: 'This change request has all possible fields defined.',
      labels: [label1, label2],
      reviewers: [orgOwnerMember],
      related_issues: []
    })

    createdChangeRequest =
      await ChangeRequestService.createChangeRequest(mockChangeRequest)
  })

  it('should test our mock a change request with a created change, values', async () => {
    const createdChange = changeMock.create({
      change_request_id: createdChangeRequest.id,
      connection_id: conn.id,
      metadata_database_name: dbEntry.raw_name,
      metadata_schema_name: tableEntry.raw_schema_name,
      metadata_table_name: tableEntry.raw_name,
      action: 'ADD' as ChangeSchema.Action
    })
    const insertedChange = await ChangeService.insertChange(
      getDb(),
      createdChange
    )

    expect(insertedChange).toMatchObject(createdChange)

    const createdChangeField = changeMock.createFieldValue({
      change_id: createdChange.id,
      column_name: 'id',
      string_value: randomUUID(),
      is_value_null: true
    })

    const insertedChangeFieldValue = await ChangeService.insertChangeFieldValue(
      getDb(),
      createdChangeField
    )

    expect(insertedChangeFieldValue).toMatchObject({
      ...createdChangeField,
      numeric_value: null,
      date_value: null,
      boolean_value: null,
      json_value: null,
      uuid_value: null
    })

    const createdChangePrimaryKey = changeMock.createPrimaryKey({
      change_id: createdChange.id,
      column_name: 'id',
      string_value: randomUUID()
    })

    const insertedPrimaryKeyValue = await ChangeService.insertChangePrimaryKey(
      getDb(),
      createdChangePrimaryKey
    )

    expect(insertedPrimaryKeyValue).toMatchObject({
      ...createdChangePrimaryKey,
      numeric_value: null,
      date_value: null,
      boolean_value: null,
      json_value: null,
      uuid_value: null
    })
  })

  it('should remove all mocks', async () => {
    await changeMock.removeAll()

    const changesCount = await getDb()
      .selectFrom('change')
      .selectAll()
      .execute()

    expect(changesCount).toHaveLength(0)

    expect(changeMock.changeMocks).toHaveLength(0)
    expect(changeMock.changeFieldValueMocks).toHaveLength(0)
    expect(changeMock.changePrimaryKeyMocks).toHaveLength(0)
  })
})
