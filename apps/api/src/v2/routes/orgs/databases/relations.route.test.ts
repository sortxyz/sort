import { randomUUID } from 'node:crypto'

import { getDb } from '@sort/shared'
import { ChangeRequestCommentMock } from '@sort/shared/mocks/change-requests/change-request-comment.mock'
import { ChangeRequestMock } from '@sort/shared/mocks/change-requests/change-request.mock'
import { ChangeMock } from '@sort/shared/mocks/change-requests/change.mock'
import { ChangeRequestTestTableMock } from '@sort/shared/mocks/change-requests/test-table.mock'
import { ConnectionMock } from '@sort/shared/mocks/connection.mock'
import { IssueMock } from '@sort/shared/mocks/issue.mock'
import { LabelMock } from '@sort/shared/mocks/label.mock'
import {
  MetadataDatabaseMock,
  MetadataTableMock
} from '@sort/shared/mocks/metadata.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { ReviewMock } from '@sort/shared/mocks/review.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ChangeRequestService from '@sort/shared/services/change-requests/change-request.service'
import * as RelationsService from '@sort/shared/services/change-requests/relations.service'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as IssueService from '@sort/shared/services/issue.service'
import * as MetadataDatabaseService from '@sort/shared/services/kysely/metadata/database.service'
import * as SnapshotService from '@sort/shared/services/kysely/snapshot/snapshot.service'
import * as LabelService from '@sort/shared/services/label.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as UserService from '@sort/shared/services/user.service'

import {
  createKysely,
  disconnectKysely
} from '../../../../global/services/kysely.service'
import { getTestServer } from '../../../../global/utils/test.util'
import { SnapshotMock } from '../../../mocks/snapshot/snapshot.mock'
import { createSortJwt } from '../../../utils/jwt.util'
import {
  testInvalidSortAuthHeaders,
  ParamsTester,
  expectNotFound
} from '../../../utils/test.util'

import type * as ConnectionType from '@sort/shared/types/kysely/connection/connection.type'
import type { SortDB } from '@sort/shared/types/kysely.type'
import type { User } from '@sort/shared/types/user.type'

type MetadataDatabase = SortDB['metadata_database']

describe('/v2 relations routes', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
  const connMock = new ConnectionMock()
  const changeRequestMock = new ChangeRequestMock()
  const changeRequestCommentMock = new ChangeRequestCommentMock()
  const reviewMock = new ReviewMock()
  const tableMock = new MetadataTableMock()
  const changeMock = new ChangeMock()
  const snapshotMock = new SnapshotMock()
  const testTableMock = new ChangeRequestTestTableMock()
  const issueMock = new IssueMock()

  const nonOrgUser1 = userMock.create()
  const nonOrgUser2 = userMock.create()
  const orgAdminUser = userMock.create()
  const orgMemberUser1 = userMock.create()
  const orgMemberUser2 = userMock.create()
  const org = orgMock.create({ created_by: orgAdminUser.id })
  const prvConn = connMock.create({
    organization_id: org.id,
    created_by: orgAdminUser.id
  })
  const pubConn = connMock.create({
    organization_id: org.id,
    visibility: 'public',
    created_by: orgAdminUser.id
  })

  const createMockSnapshot = ({
    connectionId,
    creator
  }: {
    connectionId: string
    creator: string
  }) => {
    const snapshot = snapshotMock.create({
      connection_id: connectionId,
      status: 'COMPLETED',
      creator
    })
    const db = snapshotMock.DatabaseMock.create({
      snapshot_id: snapshot.id,
      name: 'sort_xyz'
    })
    const schema1 = snapshotMock.SchemaMock.create({
      database_id: db.id,
      name: 'public'
    })
    const table1 = snapshotMock.TableMock.create({
      schema_id: schema1.id,
      name: 'users'
    })
    const column1 = snapshotMock.ColumnMock.create({
      table_id: table1.id,
      name: 'id',
      type: 'uuid',
      is_primary_key: true,
      nullable: false,
      position: 0
    })
    const column2 = snapshotMock.ColumnMock.create({
      table_id: table1.id,
      name: 'name',
      type: 'text',
      nullable: true,
      position: 1
    })
    const schema2 = snapshotMock.SchemaMock.create({
      database_id: db.id,
      name: 'test'
    })
    const table2 = snapshotMock.TableMock.create({
      schema_id: schema2.id,
      name: 'change_request_test'
    })
    const column3 = snapshotMock.ColumnMock.create({
      table_id: table2.id,
      name: 'id',
      type: 'uuid',
      is_primary_key: true,
      nullable: false,
      position: 0
    })

    return {
      snapshot,
      db,
      schema1,
      table1,
      column1,
      column2,
      schema2,
      table2,
      column3
    }
  }

  const publicSnapshotMock = createMockSnapshot({
    connectionId: pubConn.id,
    creator: orgAdminUser.id
  })

  const prvSnapshotMock = createMockSnapshot({
    connectionId: prvConn.id,
    creator: orgAdminUser.id
  })

  const prvDbEntry = dbMock.create({
    organization_id: org.id,
    connection_id: prvConn.id,
    raw_name: 'sort_xyz'
  })
  const pubDbEntry = dbMock.create({
    organization_id: org.id,
    connection_id: pubConn.id,
    raw_name: 'sort_xyz'
  })
  const label1 = labelMock.create({
    connection_id: prvConn.id,
    database_name: prvDbEntry.raw_name
  })
  const label2 = labelMock.create({
    connection_id: prvConn.id,
    database_name: prvDbEntry.raw_name
  })

  const testTableRow1 = testTableMock.create()
  let server: Awaited<ReturnType<typeof getTestServer>>

  const insertSnapshot = async (
    snap: ReturnType<typeof createMockSnapshot>
  ) => {
    await SnapshotService.insertSnapshot(getDb(), snap.snapshot)
    await snapshotMock.DatabaseMock.insert(snap.db)

    await snapshotMock.SchemaMock.insert(snap.schema1)
    await snapshotMock.TableMock.insert({
      connectionId: snap.snapshot.connection_id,
      databaseName: snap.db.name,
      schemaName: snap.schema1.name,
      table: snap.table1
    })
    await snapshotMock.ColumnMock.insert(snap.column1)
    await snapshotMock.ColumnMock.insert(snap.column2)

    await snapshotMock.SchemaMock.insert(snap.schema2)
    await snapshotMock.TableMock.insert({
      connectionId: snap.snapshot.connection_id,
      databaseName: snap.db.name,
      schemaName: snap.schema2.name,
      table: snap.table2
    })
    await snapshotMock.ColumnMock.insert(snap.column3)
  }

  async function setupTests() {
    await UserService.createUser(orgAdminUser)
    await UserService.createUser(nonOrgUser1)
    await UserService.createUser(nonOrgUser2)
    await UserService.createUser(orgMemberUser1)
    await UserService.createUser(orgMemberUser2)
    await OrganizationService.create(org)
    await OrganizationService.addMember(org.slug, orgMemberUser1.id, 'member')
    await OrganizationService.addMember(org.slug, orgMemberUser2.id, 'member')
    await ConnectionService.create(prvConn)
    await ConnectionService.create(pubConn)

    await insertSnapshot(publicSnapshotMock)
    await insertSnapshot(prvSnapshotMock)

    await MetadataDatabaseService.insertMetadataDb(getDb(), prvDbEntry)
    await MetadataDatabaseService.insertMetadataDb(getDb(), pubDbEntry)
    await LabelService.createDatabaseLabel(label1)
    await LabelService.createDatabaseLabel(label2)

    await testTableMock.insert(testTableRow1)
  }

  async function cleanupTests() {
    await changeRequestCommentMock.removeAll()
    await issueMock.removeAll()
    await snapshotMock.removeAll()
    await changeMock.removeAll()
    await tableMock.removeAll()
    await reviewMock.removeAll()
    await changeRequestMock.removeAll()
    await labelMock.removeAll()
    await connMock.removeAll()
    await dbMock.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()
    await testTableMock.removeAll()
  }

  beforeAll(async () => {
    server = await getTestServer()
    createKysely()
    await setupTests()
  })

  afterEach(async () => {
    await changeRequestCommentMock.removeAll()
    await changeMock.removeAll()
    await tableMock.removeAll()
    await reviewMock.removeAll()
    await changeRequestMock.removeAll()
  })

  afterAll(async () => {
    await cleanupTests()
    await disconnectKysely()
  })

  const createMockIssue = async (
    createdBy: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase
  ) => {
    const mockIssue = issueMock.create({
      created_by: createdBy.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    return await IssueService.createIssue(mockIssue)
  }

  const paramsTester = new ParamsTester({
    org_slug: {
      expectedNotFoundEntity: 'organization',
      expectedValidationError: 'must not have more than 99 characters',
      invalidValue: 'x'.repeat(100),
      validValue: org.slug,
      notFoundValue: 'non-existent'
    },
    db_slug: {
      expectedNotFoundEntity: 'database',
      expectedValidationError: 'must not have more than 99 characters',
      invalidValue: 'x'.repeat(100),
      get validValue() {
        return prvDbEntry.slug
      },
      notFoundValue: 'non-existent'
    },
    change_request_number: {
      expectedNotFoundEntity: 'change request',
      expectedValidationError: 'must be a valid number',
      invalidValue: 'invalid-change-request-number',
      validValue: '1',
      notFoundValue: '10'
    },
    comment_id: {
      expectedNotFoundEntity: 'change request comment',
      expectedValidationError: 'must be a valid GUID (UUID v4)',
      invalidValue: 'invalid-comment-id',
      validValue: randomUUID(),
      notFoundValue: randomUUID()
    }
  })

  const testGetRelations = async (
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const mockChangeRequest = changeRequestMock.create({
      created_by: orgAdminUser.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    const createdChangeRequest =
      await ChangeRequestService.createChangeRequest(mockChangeRequest)

    const createdIssue = await createMockIssue(
      orgAdminUser,
      connection,
      database
    )

    await RelationsService.createRelation(
      createdChangeRequest.id,
      createdIssue.id
    )

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'GET',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${createdChangeRequest.change_request_number}/relations`
    })

    if (statusCode === 200) {
      expect(response.json()).toEqual({
        type: 'list_change_request_relations',
        payload: {
          relations: [
            {
              change_request_number: createdChangeRequest.change_request_number,
              issue_number: createdIssue.issue_number,
              change_request_title: createdChangeRequest.title,
              issue_title: createdIssue.title,
              org_slug: org.slug,
              db_slug: database.slug
            }
          ]
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)

    const issueResponse = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'GET',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/issues/${createdIssue.issue_number}/relations`
    })

    if (statusCode === 200) {
      expect(issueResponse.json()).toEqual({
        type: 'list_issue_relations',
        payload: {
          relations: [
            {
              change_request_number: createdChangeRequest.change_request_number,
              issue_number: createdIssue.issue_number,
              change_request_title: createdChangeRequest.title,
              issue_title: createdIssue.title,
              org_slug: org.slug,
              db_slug: database.slug
            }
          ]
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(issueResponse, 'database')
    }

    expect(issueResponse.statusCode).toBe(statusCode)

    await RelationsService.deleteRelation(
      createdChangeRequest.id,
      createdIssue.id
    )
  }

  const testCreateRelation = async (
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const mockChangeRequest = changeRequestMock.create({
      created_by: orgAdminUser.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    const createdChangeRequest =
      await ChangeRequestService.createChangeRequest(mockChangeRequest)

    const createdIssue = await createMockIssue(
      orgAdminUser,
      connection,
      database
    )

    const payload = {
      issue_number: createdIssue.issue_number
    }

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'POST',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${createdChangeRequest.change_request_number}/relations`,
      payload
    })

    if (statusCode === 201) {
      const body = response.json()
      expect(body).toMatchObject({
        type: 'create_relation',
        payload: {
          relation: {
            change_request_number: createdChangeRequest.change_request_number,
            issue_number: createdIssue.issue_number,
            change_request_title: createdChangeRequest.title,
            issue_title: createdIssue.title,
            org_slug: org.slug,
            db_slug: database.slug
          }
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)

    await RelationsService.deleteRelation(
      createdChangeRequest.id,
      createdIssue.id
    )
  }

  const testDeleteRelation = async (
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const mockChangeRequest = changeRequestMock.create({
      created_by: orgAdminUser.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    const createdChangeRequest =
      await ChangeRequestService.createChangeRequest(mockChangeRequest)

    const createdIssue = await createMockIssue(
      orgAdminUser,
      connection,
      database
    )

    await RelationsService.createRelation(
      createdChangeRequest.id,
      createdIssue.id
    )

    const payload = {
      issue_number: createdIssue.issue_number
    }

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'DELETE',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/change-requests/${createdChangeRequest.change_request_number}/relations`,
      payload
    })

    if (statusCode === 200) {
      const body = response.json()
      expect(body).toMatchObject({
        type: 'success',
        payload: {
          success: {
            message: `Relation between issue ${createdIssue.issue_number} and change request ${createdChangeRequest.change_request_number} deleted successfully.`
          }
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)

    await RelationsService.deleteRelation(
      createdChangeRequest.id,
      createdIssue.id
    )
  }

  describe('list_issue_relations operation', () => {
    paramsTester.testInvalidParams({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues/342/relations',
      userId: orgAdminUser.id
    })

    paramsTester.testInvalidParams({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/342/relations',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues/342/relations'
    })

    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/324/relations'
    })

    paramsTester.testNotFound({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues/342/relations',
      userId: orgAdminUser.id
    })

    paramsTester.testNotFound({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/324/relations',
      userId: orgAdminUser.id
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return all change requests', async () => {
          await testGetRelations(orgAdminUser, pubConn, pubDbEntry, 200)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return all change requests', async () => {
          await testGetRelations(orgMemberUser1, pubConn, pubDbEntry, 200)
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 200 and return all change requests', async () => {
          await testGetRelations(nonOrgUser1, pubConn, pubDbEntry, 200)
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return all change requests', async () => {
          await testGetRelations(orgAdminUser, prvConn, prvDbEntry, 200)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return all change requests', async () => {
          await testGetRelations(orgMemberUser1, prvConn, prvDbEntry, 200)
        })
      })

      describe('when the caller is an Non-Org Member', () => {
        it('should respond with 404', async () => {
          await testGetRelations(nonOrgUser1, prvConn, prvDbEntry, 404)
        })
      })
    })
  })

  describe('create_relation operation', () => {
    paramsTester.testInvalidParams({
      method: 'POST',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/relations',
      userId: orgAdminUser.id,
      payload: { issue_number: 342 }
    })

    testInvalidSortAuthHeaders({
      method: 'POST',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/change-requests/432/relations'
    })

    paramsTester.testNotFound({
      method: 'POST',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/relations',
      userId: orgAdminUser.id,
      defaultPayload: { issue_number: 342 }
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 201 and successfully create a relation', async () => {
          await testCreateRelation(orgAdminUser, pubConn, pubDbEntry, 201)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 201 and successfully create a relation', async () => {
          await testCreateRelation(orgMemberUser1, pubConn, pubDbEntry, 201)
        })
      })

      describe('when the caller is an Non-Org Member', () => {
        it('should respond with 404 and an error message', async () => {
          await testCreateRelation(nonOrgUser1, pubConn, pubDbEntry, 403)
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 201 and successfully create an relation', async () => {
          await testCreateRelation(orgAdminUser, prvConn, prvDbEntry, 201)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 201 and successfully create an relation', async () => {
          await testCreateRelation(orgMemberUser1, prvConn, prvDbEntry, 201)
        })
      })

      describe('when the caller is an Non-Org Member', () => {
        it('should respond with 404 and an error message', async () => {
          await testCreateRelation(nonOrgUser1, prvConn, prvDbEntry, 404)
        })
      })
    })
  })

  describe('deleteRelation operation', () => {
    paramsTester.testInvalidParams({
      method: 'DELETE',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/relations',
      userId: orgAdminUser.id,
      payload: { issue_number: 342 }
    })

    testInvalidSortAuthHeaders({
      method: 'DELETE',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/change-requests/432/relations'
    })

    paramsTester.testNotFound({
      method: 'DELETE',
      url: '/v2/orgs/:org_slug/databases/:db_slug/change-requests/:change_request_number/relations',
      userId: orgAdminUser.id,
      defaultPayload: { issue_number: 342 }
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and successfully delete an relation', async () => {
          await testDeleteRelation(orgAdminUser, pubConn, pubDbEntry, 200)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and successfully delete an relation', async () => {
          await testDeleteRelation(orgMemberUser1, pubConn, pubDbEntry, 200)
        })
      })

      describe('when the caller is an Non-Org Member', () => {
        it('should respond with 403 and an error message', async () => {
          await testDeleteRelation(nonOrgUser1, pubConn, pubDbEntry, 403)
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and successfully delete an relation', async () => {
          await testDeleteRelation(orgAdminUser, prvConn, prvDbEntry, 200)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and successfully create an relation', async () => {
          await testDeleteRelation(orgMemberUser1, prvConn, prvDbEntry, 200)
        })
      })

      describe('when the caller is an Non-Org Member', () => {
        it('should respond with 404 and an error message', async () => {
          await testDeleteRelation(nonOrgUser1, prvConn, prvDbEntry, 404)
        })
      })
    })
  })
})
