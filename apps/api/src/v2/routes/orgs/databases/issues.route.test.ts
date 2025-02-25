import { randomUUID } from 'node:crypto'

import { dateFormat } from '@sort/shared/constants/type-mask.constant'
import { ChangeRequestMock } from '@sort/shared/mocks/change-requests/change-request.mock'
import { ConnectionMock } from '@sort/shared/mocks/connection.mock'
import { IssueCommentMock } from '@sort/shared/mocks/issue-comment.mock'
import { IssueMock } from '@sort/shared/mocks/issue.mock'
import { LabelMock } from '@sort/shared/mocks/label.mock'
import { MetadataDatabaseMock } from '@sort/shared/mocks/metadata.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import { createChangeRequest } from '@sort/shared/services/change-requests/change-request.service'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as IssueService from '@sort/shared/services/issue.service'
import * as MetadataDatabaseService from '@sort/shared/services/kysely/metadata/database.service'
import * as LabelService from '@sort/shared/services/label.service'
import * as NotificationService from '@sort/shared/services/notification.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as UserService from '@sort/shared/services/user.service'

import {
  createKysely,
  disconnectKysely,
  getDb
} from '../../../../global/services/kysely.service'
import { getTestServer } from '../../../../global/utils/test.util'
import { createSortJwt } from '../../../utils/jwt.util'
import {
  testInvalidSortAuthHeaders,
  ParamsTester,
  expectNotFound
} from '../../../utils/test.util'

import type { Label } from '@sort/shared/schemas/label.schema'
import type { OrganizationMember } from '@sort/shared/schemas/org-member.schema'
import type * as ConnectionType from '@sort/shared/types/kysely/connection/connection.type'
import type { SortDB } from '@sort/shared/types/kysely.type'
import type { User } from '@sort/shared/types/user.type'

type MetadataDatabase = SortDB['metadata_database']

describe('/v2 issues routes', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
  const connMock = new ConnectionMock()
  const issueMock = new IssueMock()
  const issueCommentMock = new IssueCommentMock()
  const changeRequestMock = new ChangeRequestMock()

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
  const prvDbEntry = dbMock.create({
    organization_id: org.id,
    connection_id: prvConn.id
  })
  const pubDbEntry = dbMock.create({
    organization_id: org.id,
    connection_id: pubConn.id
  })
  const label1 = labelMock.create({
    connection_id: prvConn.id,
    database_name: prvDbEntry.raw_name
  })
  const label2 = labelMock.create({
    connection_id: prvConn.id,
    database_name: prvDbEntry.raw_name
  })
  const label3 = labelMock.create({
    connection_id: pubConn.id,
    database_name: pubDbEntry.raw_name
  })
  const label4 = labelMock.create({
    connection_id: pubConn.id,
    database_name: pubDbEntry.raw_name
  })

  // TODO: Create an OrganizationMemberMock
  const orgMember1 = {
    user: {
      id: orgMemberUser1.id,
      username: orgMemberUser1.username,
      name: orgMemberUser1.name,
      picture: orgMemberUser1.picture
    },
    role: {
      id: 1,
      name: 'member'
    }
  } satisfies OrganizationMember

  const orgMember2 = {
    user: {
      id: orgMemberUser2.id,
      username: orgMemberUser2.username,
      name: orgMemberUser2.name,
      picture: orgMemberUser2.picture
    },
    role: {
      id: 1,
      name: 'member'
    }
  } satisfies OrganizationMember

  let server: Awaited<ReturnType<typeof getTestServer>>

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
    await MetadataDatabaseService.insertMetadataDb(getDb(), prvDbEntry)
    await MetadataDatabaseService.insertMetadataDb(getDb(), pubDbEntry)
    await LabelService.createDatabaseLabel(label1)
    await LabelService.createDatabaseLabel(label2)
    await LabelService.createDatabaseLabel(label3)
    await LabelService.createDatabaseLabel(label4)
  }

  async function cleanupTests() {
    await issueCommentMock.removeAll()
    await issueMock.removeAll()
    await labelMock.removeAll()
    await connMock.removeAll()
    await dbMock.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()
  }

  beforeAll(async () => {
    server = await getTestServer()
    createKysely()
    await setupTests()
  })

  afterEach(async () => {
    await changeRequestMock.removeAll()
    await issueCommentMock.removeAll()
    await issueMock.removeAll()
  })

  afterAll(async () => {
    await cleanupTests()
    await disconnectKysely()
  })

  const createMockIssue = async (
    createdBy: User,
    visibility: 'public' | 'private'
  ) => {
    const connection = visibility === 'public' ? pubConn : prvConn
    const database = visibility === 'public' ? pubDbEntry : prvDbEntry

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
    issue_number: {
      expectedNotFoundEntity: 'issue',
      expectedValidationError: 'must be a valid number',
      invalidValue: 'invalid-issue-number',
      validValue: '1',
      notFoundValue: '1000'
    },
    comment_id: {
      expectedNotFoundEntity: 'issue comment',
      expectedValidationError: 'must be a valid GUID (UUID v4)',
      invalidValue: 'invalid-comment-id',
      validValue: randomUUID(),
      notFoundValue: randomUUID()
    }
  })

  const testGetIssues = async (
    // createdBy: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const mockIssue = issueMock.create({
      // created_by: createdBy.id,
      created_by: orgAdminUser.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    const createdIssue = await IssueService.createIssue(mockIssue)

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'GET',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/issues`
    })

    if (statusCode === 200) {
      expect(response.json()).toEqual({
        type: 'list_issues',
        payload: {
          issues: [
            {
              ...mockIssue,
              id: createdIssue.id,
              description: null,
              issue_number: 1,
              status: 'open',
              created_at: expect.any(String),
              updated_at: expect.any(String)
            }
          ]
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testGetIssue = async (
    createdBy: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const mockIssue = issueMock.create({
      created_by: createdBy.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    const createdIssue = await IssueService.createIssue(mockIssue)

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'GET',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/issues/1`
    })

    const orgMemberIds = [orgAdminUser, orgMemberUser1, orgMemberUser2].map(
      user => user.id
    )
    const callerIsOrgMember = orgMemberIds.includes(caller.id)
    const callerIsCreator = caller.id === createdBy.id

    let permValue = true
    if (!callerIsOrgMember && !callerIsCreator) {
      permValue = false
    }

    if (statusCode === 200) {
      expect(response.json()).toEqual({
        type: 'get_issue',
        payload: {
          issue: {
            ...mockIssue,
            id: createdIssue.id,
            description: null,
            issue_number: 1,
            status: 'open',
            created_at: expect.any(String),
            updated_at: expect.any(String),
            permissions: {
              create_comment: {
                message: 'You do not have permission to create a comment.',
                value: true
              },
              edit_assignees: {
                message: 'You do not have permission to edit assignees.',
                value: permValue
              },
              edit_labels: {
                message: 'You do not have permission to edit labels.',
                value: permValue
              },
              edit_title_description: {
                message:
                  'You do not have permission to edit the title and description.',
                value: permValue
              },
              open_close_issue: {
                message:
                  'You do not have permission to open or close this issue.',
                value: permValue
              },
              edit_relations: {
                message: 'You do not have permission to edit relations.',
                value: permValue
              }
            }
          }
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testCreateIssue = async (
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const emailMock = jest.spyOn(NotificationService, 'sendIssueNotification')

    const payload = issueMock.createPayload({
      created_by: caller.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'POST',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/issues`,
      payload
    })

    if (statusCode === 201) {
      expect(response.json()).toMatchObject({
        type: 'create_issue',
        payload: {
          issue: expect.objectContaining({
            id: expect.any(String),
            title: payload.title,
            status: 'open'
          })
        }
      })

      expect(emailMock).toHaveBeenCalled()
      issueMock.addPayloadId(response.json().payload.issue.id)
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
      expect(emailMock).not.toHaveBeenCalled()
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testUpdateIssue = async (
    createdBy: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number,
    baseLabels: Label[],
    updatedLabels: Label[]
  ) => {
    const emailMock = jest.spyOn(NotificationService, 'sendIssueNotification')

    const mockIssue = issueMock.create({
      created_by: createdBy.id,
      connection_id: connection.id,
      database_name: database.raw_name,
      labels: baseLabels,
      assignees: [orgMember1]
    })

    const createdIssue = await IssueService.createIssue(mockIssue)

    const changeRequest1 = changeRequestMock.create({
      created_by: createdBy.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })
    const createdChangeRequest = await createChangeRequest(changeRequest1)

    const updatePayload = {
      title: 'Updated Title',
      description: 'Updated Description',
      status: 'closed',
      labels: updatedLabels.map(label => label.id),
      assignees: [orgMember2.user.id], // Remove orgMember 1 and add orgMember 2
      related_change_requests: [createdChangeRequest.change_request_number] // Add change request 1 to the issue
    }

    const updateResponse = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'PATCH',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/issues/${createdIssue.issue_number}`,
      payload: updatePayload
    })

    if (statusCode === 200) {
      expect(updateResponse.json()).toEqual({
        type: 'update_issue',
        payload: {
          issue: {
            ...mockIssue,
            id: createdIssue.id,
            title: 'Updated Title',
            description: 'Updated Description',
            status: 'closed',
            labels: updatedLabels,
            assignees: [orgMember2],
            related_change_requests: [
              {
                change_request_id: createdChangeRequest.id,
                change_request_number:
                  createdChangeRequest.change_request_number,
                change_request_title: createdChangeRequest.title
              }
            ],
            issue_number: 1,
            created_at: expect.any(String),
            updated_at: expect.any(String)
          }
        }
      })

      // we notify when status changes
      expect(emailMock).toHaveBeenCalled()
    } else if (statusCode === 403) {
      expect(updateResponse.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'Forbidden.'
          }
        }
      })
      expect(emailMock).not.toHaveBeenCalled()
    } else if (statusCode === 404) {
      expect(updateResponse.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'Database not found.'
          }
        }
      })
      expect(emailMock).not.toHaveBeenCalled()
    }

    expect(updateResponse.statusCode).toBe(statusCode)
  }

  const testCreateIssueComment = async (
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const emailMock = jest.spyOn(NotificationService, 'sendIssueNotification')

    const mockIssue = issueMock.create({
      created_by: orgAdminUser.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    const createdIssue = await IssueService.createIssue(mockIssue)

    const commentPayload = issueCommentMock.createPayload()

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'POST',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/issues/${createdIssue.issue_number}/comments`,
      payload: commentPayload
    })

    if (statusCode === 201) {
      expect(response.json()).toEqual({
        type: 'create_issue_comment',
        payload: {
          issue_comment: {
            id: expect.any(String),
            issue_id: createdIssue.id,
            created_by: caller.id,
            content: commentPayload.content,
            created_at: expect.any(String),
            updated_at: expect.any(String)
          }
        }
      })
      expect(emailMock).toHaveBeenCalled()
      issueCommentMock.addPayloadId(response.json().payload.issue_comment.id)
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
      expect(emailMock).not.toHaveBeenCalled()
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testUpdateIssueComment = async (
    author: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const mockIssue = issueMock.create({
      created_by: orgAdminUser.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    const createdIssue = await IssueService.createIssue(mockIssue)

    const mockComment = issueCommentMock.create({
      issue_id: mockIssue.id,
      created_by: author.id
    })

    const createdComment = await IssueService.createIssueComment(
      {
        org_slug: org.slug,
        issue_id: mockComment.issue_id
      },
      {
        id: mockComment.id,
        created_by: mockComment.created_by,
        content: mockComment.content
      }
    )

    const updatePayload = {
      content: 'Updated Comment Content'
    }

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'PATCH',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/issues/${createdIssue.issue_number}/comments/${createdComment.id}`,
      payload: updatePayload
    })

    if (statusCode === 200) {
      expect(response.json()).toEqual({
        type: 'update_issue_comment',
        payload: {
          issue_comment: {
            id: createdComment.id,
            issue_id: createdIssue.id,
            created_by: author.id,
            content: 'Updated Comment Content',
            created_at: expect.any(String),
            updated_at: expect.any(String)
          }
        }
      })
    } else if (statusCode === 403) {
      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'Forbidden.'
          }
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }

    expect(response.statusCode).toBe(statusCode)
  }

  const testDeleteIssueComment = async (
    author: User,
    caller: User,
    connection: ConnectionType.ConnectionSelectWithEncryption,
    database: MetadataDatabase,
    statusCode: number
  ) => {
    const mockIssue = issueMock.create({
      created_by: orgAdminUser.id,
      connection_id: connection.id,
      database_name: database.raw_name
    })

    const createdIssue = await IssueService.createIssue(mockIssue)

    const mockComment = issueCommentMock.create({
      issue_id: mockIssue.id,
      created_by: author.id
    })

    const createdComment = await IssueService.createIssueComment(
      {
        org_slug: org.slug,
        issue_id: mockComment.issue_id
      },
      {
        id: mockComment.id,
        created_by: mockComment.created_by,
        content: mockComment.content
      }
    )

    const response = await server.inject({
      headers: {
        authorization: `Bearer ${createSortJwt(caller.id)}`
      },
      method: 'DELETE',
      url: `/v2/orgs/${org.slug}/databases/${database.slug}/issues/${createdIssue.issue_number}/comments/${createdComment.id}`
    })

    if (statusCode === 200) {
      expect(response.json()).toEqual({
        type: 'success',
        payload: {
          success: {
            message: `IssueComment ${mockComment.id} deleted successfully.`
          }
        }
      })
    } else if (statusCode === 403) {
      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'Forbidden.'
          }
        }
      })
    } else if (statusCode === 404) {
      expectNotFound(response, 'database')
    }
  }

  describe('create_issue operation', () => {
    paramsTester.testInvalidParams({
      method: 'POST',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues',
      userId: orgAdminUser.id
    })

    it('should respond with 400 when no values are passed in the payload', async () => {
      const payload = {}

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                title: 'is required'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when the title is too long', async () => {
      const payload = {
        created_by: orgAdminUser.id,
        title: 'x'.repeat(257),
        labels: [],
        assignees: []
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        payload,
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                title: 'must not have more than 256 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when title is an empty string', async () => {
      const payload = { title: '', labels: [], assignees: [] }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                title: 'must not have fewer than 2 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when title is null', async () => {
      const payload = {
        created_by: orgAdminUser.id,
        title: null,
        labels: [],
        assignees: []
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                title: 'must not have fewer than 2 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when the description is too long', async () => {
      const payload = issueMock.createPayload({
        created_by: orgAdminUser.id,
        title: 'Test Issue Title',
        description: 'x'.repeat(150001)
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        payload,
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                description: 'must not have more than 150000 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    testInvalidSortAuthHeaders({
      method: 'POST',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/issues'
    })

    it('should create an issue with all fields', async () => {
      const changeRequest1 = changeRequestMock.create({
        created_by: orgAdminUser.id,
        connection_id: prvConn.id,
        database_name: prvDbEntry.raw_name
      })
      const createdChangeRequest = await createChangeRequest(changeRequest1)

      const payload = issueMock.createPayload({
        created_by: orgAdminUser.id,
        title: 'Detailed Test Issue',
        description: 'This issue has all possible fields defined.',
        labels: [label1.id],
        assignees: [orgMemberUser1.id],
        related_change_requests: [createdChangeRequest.change_request_number]
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'create_issue',
        payload: {
          issue: {
            id: expect.any(String),
            connection_id: prvConn.id,
            database_name: prvDbEntry.raw_name,
            title: payload.title,
            description: payload.description,
            status: 'open',
            issue_number: 2,
            assignees: [orgMember1],
            labels: [label1],
            created_by: orgAdminUser.id,
            created_at: expect.any(String),
            updated_at: expect.any(String),
            related_change_requests: [
              {
                change_request_id: createdChangeRequest.id,
                change_request_number:
                  createdChangeRequest.change_request_number,
                change_request_title: createdChangeRequest.title
              }
            ]
          }
        }
      })

      expect(response.statusCode).toBe(201)

      issueMock.addPayloadId(response.json().payload.issue.id)
    })

    it('should create an issue with minimal fields', async () => {
      const payload = issueMock.createPayload({
        created_by: orgAdminUser.id,
        title: 'Minimal Test Issue'
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'create_issue',
        payload: {
          issue: {
            id: expect.any(String),
            connection_id: prvConn.id,
            database_name: prvDbEntry.raw_name,
            title: payload.title,
            description: null,
            status: 'open',
            issue_number: 1,
            assignees: [],
            labels: [],
            created_by: orgAdminUser.id,
            created_at: expect.any(String),
            updated_at: expect.any(String),
            related_change_requests: []
          }
        }
      })

      expect(response.statusCode).toBe(201)

      issueMock.addPayloadId(response.json().payload.issue.id)
    })

    it('should create an issue when description is null', async () => {
      const payload = issueMock.createPayload({
        created_by: orgAdminUser.id,
        title: 'Null Description Issue',
        description: null
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'create_issue',
        payload: {
          issue: {
            id: expect.any(String),
            connection_id: prvConn.id,
            database_name: prvDbEntry.raw_name,
            title: payload.title,
            description: null,
            status: 'open',
            issue_number: 1,
            assignees: [],
            labels: [],
            created_by: orgAdminUser.id,
            created_at: expect.any(String),
            updated_at: expect.any(String),
            related_change_requests: []
          }
        }
      })

      expect(response.statusCode).toBe(201)

      issueMock.addPayloadId(response.json().payload.issue.id)
    })

    paramsTester.testNotFound({
      method: 'POST',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues',
      userId: orgAdminUser.id,
      defaultPayload: issueMock.createPayload()
    })

    it('should respond with 422 when one or more labels cannot be found', async () => {
      const label3 = labelMock.create({
        name: 'Label 3',
        connection_id: pubConn.id,
        database_name: pubDbEntry.raw_name
      })

      await LabelService.createDatabaseLabel(label3)

      const payload = {
        created_by: orgAdminUser.id,
        title: 'Never becomes an issue :( ',
        labels: [label3.id]
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        payload,
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`
      })

      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'One or more labels not found'
          }
        }
      })

      expect(response.statusCode).toBe(422)
    })

    it('should respond with 422 when one or more assignees cannot be found', async () => {
      const user2 = userMock.create()
      await UserService.createUser(user2)

      const payload = {
        created_by: orgAdminUser.id,
        title: 'Never becomes an issue :( ',
        labels: [],
        assignees: [user2.id]
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        payload,
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`
      })

      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: 'One or more assignees not found'
          }
        }
      })

      expect(response.statusCode).toBe(422)
    })

    it('should respond with 500 when a service error occurs', async () => {
      jest
        .spyOn(IssueService, 'createIssue')
        .mockRejectedValueOnce(new Error('fake error'))

      const payload = issueMock.createPayload({
        created_by: orgAdminUser.id,
        title: 'Never becomes an Issue :('
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        payload,
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`
      })

      expect(response.json()).toEqual({
        type: 'error',
        payload: {
          error: {
            message: expect.stringMatching(/If the problem persists/)
          }
        }
      })

      expect(response.statusCode).toBe(500)
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 201 and successfully create an issue', async () => {
          await testCreateIssue(orgAdminUser, pubConn, pubDbEntry, 201)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 201 and successfully create an issue', async () => {
          await testCreateIssue(orgMemberUser1, pubConn, pubDbEntry, 201)
        })
      })

      describe('when the caller is an Non-Org Member', () => {
        it('should respond with 201 and successfully create an issue', async () => {
          await testCreateIssue(nonOrgUser1, pubConn, pubDbEntry, 201)
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 201 and successfully create an issue', async () => {
          await testCreateIssue(orgAdminUser, prvConn, prvDbEntry, 201)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 201 and successfully create an issue', async () => {
          await testCreateIssue(orgMemberUser1, prvConn, prvDbEntry, 201)
        })
      })

      describe('when the caller is an Non-Org Member', () => {
        it('should respond with 404 and an error message', async () => {
          await testCreateIssue(nonOrgUser1, prvConn, prvDbEntry, 404)
        })
      })
    })
  })

  describe('list_issues operation', () => {
    paramsTester.testInvalidParams({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/issues'
    })

    paramsTester.testNotFound({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues',
      userId: orgAdminUser.id
    })

    it('should return all issues for a database', async () => {
      const payload = issueMock.createPayload({
        created_by: orgAdminUser.id,
        title: 'Detailed Test Issue',
        description: 'This issue has all possible fields defined.',
        labels: [label1.id, label2.id],
        assignees: [orgAdminUser.id]
      })

      const response1 = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
        payload
      })

      const createdIssue = response1.json().payload.issue
      issueMock.addPayloadId(createdIssue.id)

      const response2 = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`
      })

      const orgMemberRows =
        await OrganizationService.createGetMembersBaseQueryBuilder(org.slug)
          .innerJoin('issue_assignee', 'issue_assignee.user_id', 'user.id')
          .where('issue_assignee.issue_id', 'in', [createdIssue.id])
          .select('issue_assignee.issue_id')
          .execute()

      const orgMembers = orgMemberRows.map(
        OrganizationService.rowToOrganizationMember
      )

      expect(response2.json()).toEqual({
        type: 'list_issues',
        payload: {
          issues: [
            {
              ...payload,
              id: createdIssue.id,
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              issue_number: 1,
              status: 'open',
              labels: [label1, label2],
              assignees: [orgMembers[0]],
              created_at: expect.any(String),
              updated_at: expect.any(String)
            }
          ]
        }
      })

      expect(response2.statusCode).toBe(200)
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return all issues', async () => {
          await testGetIssues(orgAdminUser, pubConn, pubDbEntry, 200)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return all issues', async () => {
          await testGetIssues(orgMemberUser1, pubConn, pubDbEntry, 200)
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 200 and return all issues', async () => {
          await testGetIssues(nonOrgUser1, pubConn, pubDbEntry, 200)
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return all issues', async () => {
          await testGetIssues(orgAdminUser, prvConn, prvDbEntry, 200)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return all issues', async () => {
          await testGetIssues(orgMemberUser1, prvConn, prvDbEntry, 200)
        })
      })

      describe('when the caller is an Non-Org Member', () => {
        it('should respond with 404', async () => {
          await testGetIssues(nonOrgUser1, prvConn, prvDbEntry, 404)
        })
      })
    })
  })

  describe('get_issue operation', () => {
    paramsTester.testInvalidParams({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/issues/some-issue-number'
    })

    paramsTester.testNotFound({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number',
      userId: orgAdminUser.id
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return the issue with full permissions', async () => {
          await testGetIssue(
            orgAdminUser,
            orgAdminUser,
            pubConn,
            pubDbEntry,
            200
          )
        })
      })
      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return the issue with full permissions', async () => {
          await testGetIssue(
            orgAdminUser,
            orgMemberUser1,
            pubConn,
            pubDbEntry,
            200
          )
        })
      })
      describe('when the caller is an Non-Org Member', () => {
        describe('and is the issue creator', () => {
          it('should respond with 200 and return the issue with full permissions', async () => {
            await testGetIssue(
              nonOrgUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('and is not the issue creator', () => {
          it('should respond with 200 and return the issue with only comment permissions', async () => {
            await testGetIssue(
              orgAdminUser,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and return the issue with full permissions', async () => {
          await testGetIssue(
            orgAdminUser,
            orgAdminUser,
            prvConn,
            prvDbEntry,
            200
          )
        })
      })
      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and return the issue with full permissions', async () => {
          await testGetIssue(
            orgAdminUser,
            orgMemberUser1,
            prvConn,
            prvDbEntry,
            200
          )
        })
      })
      describe('when the caller is an Non-Org Member', () => {
        it('should respond with 404', async () => {
          await testGetIssue(
            orgAdminUser,
            nonOrgUser1,
            prvConn,
            prvDbEntry,
            404
          )
        })
      })
    })

    it('should return an issue for a given issue_number', async () => {
      const payload = issueMock.createPayload({
        created_by: orgAdminUser.id,
        title: 'Detailed Test Issue',
        description: 'This issue has all possible fields defined.',
        labels: [label1.id, label2.id],
        assignees: [orgAdminUser.id]
      })

      const response1 = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
        payload
      })

      const createdIssue = response1.json().payload.issue
      issueMock.addPayloadId(createdIssue.id)

      const response2 = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}`
      })

      const orgMemberRows =
        await OrganizationService.createGetMembersBaseQueryBuilder(org.slug)
          .innerJoin('issue_assignee', 'issue_assignee.user_id', 'user.id')
          .where('issue_assignee.issue_id', 'in', [createdIssue.id])
          .select('issue_assignee.issue_id')
          .execute()

      const orgMembers = orgMemberRows.map(
        OrganizationService.rowToOrganizationMember
      )

      expect(response2.json()).toEqual({
        type: 'get_issue',
        payload: {
          issue: {
            ...payload,
            id: createdIssue.id,
            connection_id: prvConn.id,
            database_name: prvDbEntry.raw_name,
            issue_number: 1,
            status: 'open',
            labels: [label1, label2],
            assignees: [orgMembers[0]],
            created_at: expect.any(String),
            updated_at: expect.any(String),
            permissions: {
              create_comment: {
                value: true,
                message: 'You do not have permission to create a comment.'
              },
              edit_title_description: {
                value: true,
                message:
                  'You do not have permission to edit the title and description.'
              },
              edit_labels: {
                value: true,
                message: 'You do not have permission to edit labels.'
              },
              edit_assignees: {
                value: true,
                message: 'You do not have permission to edit assignees.'
              },
              open_close_issue: {
                value: true,
                message:
                  'You do not have permission to open or close this issue.'
              },
              edit_relations: {
                value: true,
                message: 'You do not have permission to edit relations.'
              }
            }
          }
        }
      })

      expect(response2.statusCode).toBe(200)
    })

    it('should return a 404 when issue_number is > max postgres integer', async () => {
      const invalidInt = '3774390408407582700'

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${invalidInt}`
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the params.',
            context: 'params',
            errors: {
              params: {
                issue_number:
                  'must be a number less than or equal to 2147483647'
              }
            }
          }
        }
      })
    })
  })

  describe('update_issue operation', () => {
    paramsTester.testInvalidParams({
      method: 'PATCH',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number',
      userId: orgAdminUser.id
    })

    it('should respond with 400 when no values are passed in the payload', async () => {
      const mockIssue = issueMock.create({
        created_by: orgAdminUser.id,
        connection_id: pubConn.id,
        database_name: pubDbEntry.raw_name
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const payload = {}

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                $root: 'cannot be an empty object'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when the title is too long', async () => {
      const mockIssue = issueMock.create({
        created_by: orgAdminUser.id,
        connection_id: pubConn.id,
        database_name: pubDbEntry.raw_name
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const payload = {
        title: 'x'.repeat(257)
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                title: 'must not have more than 256 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when title is an empty string', async () => {
      const mockIssue = issueMock.create({
        created_by: orgAdminUser.id,
        connection_id: pubConn.id,
        database_name: pubDbEntry.raw_name
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const payload = {
        title: ''
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                title: 'must not have fewer than 2 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when title is null', async () => {
      const mockIssue = issueMock.create({
        created_by: orgAdminUser.id,
        connection_id: pubConn.id,
        database_name: pubDbEntry.raw_name
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const payload = {
        title: null
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                title: 'must not have fewer than 2 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when the description is too long', async () => {
      const mockIssue = issueMock.create({
        created_by: orgAdminUser.id,
        connection_id: pubConn.id,
        database_name: pubDbEntry.raw_name
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const payload = issueMock.createPayload({
        description: 'x'.repeat(150001)
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                description: 'must not have more than 150000 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when the status is not either open or closed', async () => {
      const mockIssue = issueMock.create({
        created_by: orgAdminUser.id,
        connection_id: pubConn.id,
        database_name: pubDbEntry.raw_name
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const payload = {
        status: 'neither-open-nor-closed'
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                status: 'must match a schema in anyOf'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when the status is null', async () => {
      const mockIssue = issueMock.create({
        created_by: orgAdminUser.id,
        connection_id: pubConn.id,
        database_name: pubDbEntry.raw_name
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const payload = {
        status: null
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                status: 'must match a schema in anyOf'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    testInvalidSortAuthHeaders({
      method: 'PATCH',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/issues/some-issue-number'
    })

    paramsTester.testNotFound({
      method: 'PATCH',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number',
      userId: orgAdminUser.id,
      defaultPayload: { title: 'Updated Title' }
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and update all issue fields', async () => {
          await testUpdateIssue(
            orgAdminUser,
            orgAdminUser,
            pubConn,
            pubDbEntry,
            200,
            [label3],
            [label4]
          )
        })
      })
      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and update all issue fields', async () => {
          await testUpdateIssue(
            orgAdminUser,
            orgMemberUser1,
            pubConn,
            pubDbEntry,
            200,
            [label3],
            [label4]
          )
        })
      })
      describe('when the caller is an Non-Org Member', () => {
        describe('and is the issue creator', () => {
          it('should respond with 200 and update all issue fields', async () => {
            await testUpdateIssue(
              nonOrgUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              200,
              [label3],
              [label4]
            )
          })
        })
        describe('and is not the issue creator', () => {
          it('should respond with 403 and be forbidden from updating the issue', async () => {
            await testUpdateIssue(
              orgAdminUser,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403,
              [label3],
              [label4]
            )
          })
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 200 and update all issue fields', async () => {
          await testUpdateIssue(
            orgAdminUser,
            orgAdminUser,
            prvConn,
            prvDbEntry,
            200,
            [label1],
            [label2]
          )
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 200 and update all issue fields', async () => {
          await testUpdateIssue(
            orgAdminUser,
            orgMemberUser1,
            prvConn,
            prvDbEntry,
            200,
            [label1],
            [label2]
          )
        })
      })
      describe('when the caller is an Non-Org Member', () => {
        it('should respond with 404', async () => {
          await testUpdateIssue(
            orgAdminUser,
            nonOrgUser1,
            prvConn,
            prvDbEntry,
            404,
            [label1],
            [label2]
          )
        })
      })
    })

    it('should successfully update labels and assignees without updating issue direct properties when they are unchanged', async () => {
      const createPayload = issueMock.createPayload({
        created_by: orgAdminUser.id,
        title: 'Original Title',
        description: 'Original Description',
        labels: [label1.id],
        assignees: [orgAdminUser.id]
      })

      const createResponse = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
        payload: createPayload
      })

      const createdIssue = createResponse.json().payload.issue
      issueMock.addPayloadId(createdIssue.id)

      const updatePayload = {
        title: 'Original Title',
        description: 'Original Description',
        status: 'open',
        labels: [label2.id],
        assignees: []
      }

      const updateResponse = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}`,
        payload: updatePayload
      })

      expect(updateResponse.json()).toEqual({
        type: 'update_issue',
        payload: {
          issue: {
            id: createdIssue.id,
            connection_id: prvConn.id,
            database_name: prvDbEntry.raw_name,
            created_by: orgAdminUser.id,
            issue_number: 1,
            title: updatePayload.title,
            description: updatePayload.description,
            status: updatePayload.status,
            created_at: createdIssue.created_at,
            updated_at: expect.any(String),
            labels: [label2],
            assignees: [],
            related_change_requests: []
          }
        }
      })

      expect(updateResponse.statusCode).toBe(200)
    })

    it('should successfully update labels without updating issue direct properties when they are unchanged', async () => {
      const createPayload = issueMock.createPayload({
        created_by: orgAdminUser.id,
        title: 'Original Title',
        description: 'Original Description',
        labels: [label1.id],
        assignees: [orgAdminUser.id]
      })

      const createResponse = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
        payload: createPayload
      })

      const createdIssue = createResponse.json().payload.issue
      issueMock.addPayloadId(createdIssue.id)

      const updatePayload = {
        title: 'Original Title',
        description: 'Original Description',
        status: 'open',
        labels: [label2.id]
      }

      const updateResponse = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}`,
        payload: updatePayload
      })

      const getOrgUsers = await OrganizationService.getMembersByIds(org.slug, [
        orgAdminUser.id
      ])

      expect(updateResponse.json()).toEqual({
        type: 'update_issue',
        payload: {
          issue: {
            id: createdIssue.id,
            connection_id: prvConn.id,
            database_name: prvDbEntry.raw_name,
            created_by: orgAdminUser.id,
            issue_number: 1,
            title: updatePayload.title,
            description: updatePayload.description,
            status: updatePayload.status,
            created_at: createdIssue.created_at,
            updated_at: expect.any(String),
            labels: [label2],
            assignees: getOrgUsers,
            related_change_requests: []
          }
        }
      })

      expect(updateResponse.statusCode).toBe(200)
    })

    it('should successfully update assignees without updating labels when they are unchanged', async () => {
      const createPayload = issueMock.createPayload({
        created_by: orgAdminUser.id,
        title: 'Original Title',
        description: 'Original Description',
        labels: [label1.id],
        assignees: [orgAdminUser.id, orgMemberUser1.id]
      })

      const createResponse = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
        payload: createPayload
      })

      const createdIssue = createResponse.json().payload.issue
      issueMock.addPayloadId(createdIssue.id)

      const updatePayload = {
        title: 'Original Title',
        description: 'Original Description',
        status: 'open',
        assignees: [orgMemberUser1.id]
      }

      const updateResponse = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}`,
        payload: updatePayload
      })

      const getOrgUsers = await OrganizationService.getMembersByIds(org.slug, [
        orgMemberUser1.id
      ])

      expect(updateResponse.json()).toEqual({
        type: 'update_issue',
        payload: {
          issue: {
            id: createdIssue.id,
            connection_id: prvConn.id,
            database_name: prvDbEntry.raw_name,
            created_by: orgAdminUser.id,
            issue_number: 1,
            title: updatePayload.title,
            description: updatePayload.description,
            status: updatePayload.status,
            created_at: createdIssue.created_at,
            updated_at: expect.any(String),
            labels: [label1],
            related_change_requests: [],
            assignees: getOrgUsers
          }
        }
      })

      expect(updateResponse.statusCode).toBe(200)
    })

    describe('for field-specific updates', () => {
      it('should successfully update issue without affecting assignees or labels', async () => {
        const createPayload = issueMock.createPayload({
          created_by: orgAdminUser.id,
          title: 'Original Title',
          description: 'Original Description',
          labels: [label1.id],
          assignees: [orgAdminUser.id, orgMemberUser1.id]
        })

        const createResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
          payload: createPayload
        })

        const createdIssue = createResponse.json().payload.issue
        issueMock.addPayloadId(createdIssue.id)

        const updatePayload = {
          title: 'Updated Title',
          description: 'Updated Description',
          status: 'closed'
        }

        const updateResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}`,
          payload: updatePayload
        })

        const getOrgUsers = await OrganizationService.getMembersByIds(
          org.slug,
          [orgAdminUser.id, orgMemberUser1.id]
        )

        expect(updateResponse.json()).toEqual({
          type: 'update_issue',
          payload: {
            issue: {
              id: createdIssue.id,
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              created_by: orgAdminUser.id,
              issue_number: 1,
              title: updatePayload.title,
              description: updatePayload.description,
              status: updatePayload.status,
              created_at: createdIssue.created_at,
              updated_at: expect.any(String),
              labels: [label1],
              related_change_requests: [],
              assignees: expect.arrayContaining(getOrgUsers)
            }
          }
        })

        expect(updateResponse.statusCode).toBe(200)
      })

      it('should successfully close an issue', async () => {
        const createPayload = issueMock.createPayload({
          created_by: orgAdminUser.id,
          title: 'Original Title',
          description: 'Original Description',
          labels: [label1.id],
          assignees: [orgAdminUser.id, orgMemberUser1.id]
        })

        const createResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
          payload: createPayload
        })

        const createdIssue = createResponse.json().payload.issue
        issueMock.addPayloadId(createdIssue.id)

        const updatePayload = {
          title: 'Original Title',
          description: 'Original Description',
          status: 'closed'
        }

        const updateResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}`,
          payload: updatePayload
        })

        const getOrgUsers = await OrganizationService.getMembersByIds(
          org.slug,
          [orgAdminUser.id, orgMemberUser1.id]
        )

        expect(updateResponse.json()).toEqual({
          type: 'update_issue',
          payload: {
            issue: {
              id: createdIssue.id,
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              created_by: orgAdminUser.id,
              issue_number: 1,
              title: updatePayload.title,
              description: updatePayload.description,
              status: updatePayload.status,
              created_at: createdIssue.created_at,
              updated_at: expect.any(String),
              labels: [label1],
              assignees: expect.arrayContaining(getOrgUsers),
              related_change_requests: []
            }
          }
        })

        expect(updateResponse.statusCode).toBe(200)
      })

      it('should successfully re-open a closed issue', async () => {
        const createPayload = issueMock.createPayload({
          created_by: orgAdminUser.id,
          title: 'Original Title',
          description: 'Original Description',
          labels: [label1.id],
          assignees: [orgAdminUser.id, orgMemberUser1.id]
        })

        const createResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
          payload: createPayload
        })

        const createdIssue = createResponse.json().payload.issue
        issueMock.addPayloadId(createdIssue.id)

        const updatePayload = {
          title: 'Original Title',
          description: 'Original Description',
          status: 'closed'
        }

        const updateResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}`,
          payload: updatePayload
        })

        expect(updateResponse.statusCode).toBe(200)

        const updatePayload2 = {
          title: 'Reopen Title',
          description: 'Reopen Description',
          status: 'open'
        }

        const updateResponse2 = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'PATCH',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}`,
          payload: updatePayload2
        })

        const getOrgUsers = await OrganizationService.getMembersByIds(
          org.slug,
          [orgAdminUser.id, orgMemberUser1.id]
        )

        expect(updateResponse2.json()).toEqual({
          type: 'update_issue',
          payload: {
            issue: {
              id: createdIssue.id,
              connection_id: prvConn.id,
              database_name: prvDbEntry.raw_name,
              created_by: orgAdminUser.id,
              issue_number: 1,
              title: updatePayload2.title,
              description: updatePayload2.description,
              status: updatePayload2.status,
              created_at: createdIssue.created_at,
              updated_at: expect.any(String),
              labels: [label1],
              assignees: expect.arrayContaining(getOrgUsers),
              related_change_requests: []
            }
          }
        })

        expect(updateResponse.statusCode).toBe(200)
      })
    })
  })

  describe('create_issue_comment operation', () => {
    paramsTester.testInvalidParams({
      method: 'POST',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number/comments',
      userId: orgAdminUser.id
    })

    it('should respond with 400 when no values are passed in the payload', async () => {
      const payload = {}

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/123/comments`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'is required'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when the content is too long', async () => {
      const payload = issueCommentMock.createPayload({
        content: 'x'.repeat(150001)
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/123/comments`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'must not have more than 500 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when content is an empty string', async () => {
      const payload = {
        content: ''
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/123/comments`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'must not have fewer than 1 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when content is null', async () => {
      const payload = {
        content: null
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/123/comments`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'must not have fewer than 1 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    testInvalidSortAuthHeaders({
      method: 'POST',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/issues/some-issue-number/comments'
    })

    paramsTester.testNotFound({
      method: 'POST',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number/comments',
      userId: orgAdminUser.id,
      defaultPayload: { content: 'Updated Content' }
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 201 and successfully create an issue comment', async () => {
          await testCreateIssueComment(orgAdminUser, pubConn, pubDbEntry, 201)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 201 and successfully create an issue comment', async () => {
          await testCreateIssueComment(orgMemberUser1, pubConn, pubDbEntry, 201)
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 201 and successfully create an issue comment', async () => {
          await testCreateIssueComment(nonOrgUser1, pubConn, pubDbEntry, 201)
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        it('should respond with 201 and successfully create an issue comment', async () => {
          await testCreateIssueComment(orgAdminUser, prvConn, prvDbEntry, 201)
        })
      })

      describe('when the caller is an Org Member', () => {
        it('should respond with 201 and successfully create an issue comment', async () => {
          await testCreateIssueComment(orgMemberUser1, prvConn, prvDbEntry, 201)
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        it('should respond with 404', async () => {
          await testCreateIssueComment(nonOrgUser1, prvConn, prvDbEntry, 404)
        })
      })
    })
  })

  describe('update_issue_comment operation', () => {
    paramsTester.testInvalidParams({
      method: 'PATCH',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number/comments/:comment_id',
      userId: orgAdminUser.id
    })

    it('should respond with 400 when no values are passed in the payload', async () => {
      const payload = {}

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/some-org-slug/databases/some-db-slug/issues/123/comments/${randomUUID()}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'is required'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when the content is too long', async () => {
      const payload = issueCommentMock.createPayload({
        content: 'x'.repeat(150001)
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/some-org-slug/databases/some-db-slug/issues/123/comments/${randomUUID()}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'must not have more than 500 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when content is an empty string', async () => {
      const payload = {
        content: ''
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/some-org-slug/databases/some-db-slug/issues/123/comments/${randomUUID()}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'must not have fewer than 1 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    it('should respond with 400 when content is null', async () => {
      const payload = {
        content: null
      }

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/some-org-slug/databases/some-db-slug/issues/123/comments/${randomUUID()}`,
        payload
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'A validation error occurred when validating the body.',
            context: 'body',
            errors: {
              body: {
                content: 'must not have fewer than 1 characters'
              }
            }
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })

    testInvalidSortAuthHeaders({
      method: 'PATCH',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/issues/some-issue-number/comments/some-comment-id'
    })

    describe('not found', () => {
      beforeEach(async () => {
        await createMockIssue(orgAdminUser, 'private')
      })

      paramsTester.testNotFound({
        method: 'PATCH',
        url: '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number/comments/:comment_id',
        userId: orgAdminUser.id,
        defaultPayload: { content: 'Updated Content' }
      })
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully update the issue comment', async () => {
            await testUpdateIssueComment(
              orgAdminUser,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to update Org Member comments', async () => {
            await testUpdateIssueComment(
              orgMemberUser1,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to update Non-Org Member comments', async () => {
            await testUpdateIssueComment(
              nonOrgUser1,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is an Org Member', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully update the issue comment', async () => {
            await testUpdateIssueComment(
              orgMemberUser1,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to update Org Owner comments', async () => {
            await testUpdateIssueComment(
              orgAdminUser,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to update other Org Member comments', async () => {
            await testUpdateIssueComment(
              orgMemberUser2,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to update Non-Org Member comments', async () => {
            await testUpdateIssueComment(
              nonOrgUser1,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully update the issue comment', async () => {
            await testUpdateIssueComment(
              nonOrgUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to update Org Owner comments', async () => {
            await testUpdateIssueComment(
              orgAdminUser,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to update Org Member comments', async () => {
            await testUpdateIssueComment(
              orgMemberUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to update other Non-Org Member comments', async () => {
            await testUpdateIssueComment(
              nonOrgUser2,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully update the issue comment', async () => {
            await testUpdateIssueComment(
              orgAdminUser,
              orgAdminUser,
              prvConn,
              prvDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to update Org Member comments', async () => {
            await testUpdateIssueComment(
              orgMemberUser1,
              orgAdminUser,
              prvConn,
              prvDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is an Org Member', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully update the issue comment', async () => {
            await testUpdateIssueComment(
              orgMemberUser1,
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to update Org Owner comments', async () => {
            await testUpdateIssueComment(
              orgAdminUser,
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to update other Org Member comments', async () => {
            await testUpdateIssueComment(
              orgMemberUser2,
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        describe('who is not the comment Author', () => {
          it('should respond with 404 and be forbidden to update Org Owner comments', async () => {
            await testUpdateIssueComment(
              orgAdminUser,
              nonOrgUser1,
              prvConn,
              prvDbEntry,
              404
            )
          })

          it('should respond with 404 and be forbidden to update Org Member comments', async () => {
            await testUpdateIssueComment(
              orgMemberUser1,
              nonOrgUser1,
              prvConn,
              prvDbEntry,
              404
            )
          })
        })
      })
    })
  })

  describe('delete_issue_comment operation', () => {
    paramsTester.testInvalidParams({
      method: 'DELETE',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number/comments/:comment_id',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'DELETE',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/issues/some-issue-number/comments/some-comment-id'
    })

    describe('not found', () => {
      beforeEach(async () => {
        await createMockIssue(orgAdminUser, 'private')
      })

      paramsTester.testNotFound({
        method: 'DELETE',
        url: '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number/comments/:comment_id',
        userId: orgAdminUser.id
      })
    })

    describe('for Public Connections', () => {
      describe('when the caller is an Org Owner', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully delete the issue comment', async () => {
            await testDeleteIssueComment(
              orgAdminUser,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 200 and successfully delete Org Member comments', async () => {
            await testDeleteIssueComment(
              orgMemberUser1,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              200
            )
          })

          it('should respond with 200 and successfully delete Non-Org Member comments', async () => {
            await testDeleteIssueComment(
              nonOrgUser1,
              orgAdminUser,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })
      })

      describe('when the caller is an Org Member', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully delete the issue comment', async () => {
            await testDeleteIssueComment(
              orgMemberUser1,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to delete Org Owner comments', async () => {
            await testDeleteIssueComment(
              orgAdminUser,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to delete other Org Member comments', async () => {
            await testDeleteIssueComment(
              orgMemberUser2,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to delete Non-Org Member comments', async () => {
            await testDeleteIssueComment(
              nonOrgUser1,
              orgMemberUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully delete the issue comment', async () => {
            await testDeleteIssueComment(
              nonOrgUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to delete Org Owner comments', async () => {
            await testDeleteIssueComment(
              orgAdminUser,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to delete Org Member comments', async () => {
            await testDeleteIssueComment(
              orgMemberUser1,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to delete other Non-Org Member comments', async () => {
            await testDeleteIssueComment(
              nonOrgUser2,
              nonOrgUser1,
              pubConn,
              pubDbEntry,
              403
            )
          })
        })
      })
    })

    describe('for Private Connections', () => {
      describe('when the caller is an Org Owner', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully delete the issue comment', async () => {
            await testDeleteIssueComment(
              orgAdminUser,
              orgAdminUser,
              prvConn,
              prvDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 200 and successfully delete Org Member comments', async () => {
            await testDeleteIssueComment(
              orgMemberUser1,
              orgAdminUser,
              prvConn,
              prvDbEntry,
              200
            )
          })

          it('should respond with 200 and successfully delete Non-Org Member comments', async () => {
            await testDeleteIssueComment(
              nonOrgUser1,
              orgAdminUser,
              prvConn,
              prvDbEntry,
              200
            )
          })
        })
      })

      describe('when the caller is an Org Member', () => {
        describe('who is the comment Author', () => {
          it('should respond with 200 and successfully delete the issue comment', async () => {
            await testDeleteIssueComment(
              orgMemberUser1,
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              200
            )
          })
        })

        describe('who is not the comment Author', () => {
          it('should respond with 403 and be forbidden to delete Org Owner comments', async () => {
            await testDeleteIssueComment(
              orgAdminUser,
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              403
            )
          })

          it('should respond with 403 and be forbidden to delete other Org Member comments', async () => {
            await testDeleteIssueComment(
              orgMemberUser2,
              orgMemberUser1,
              prvConn,
              prvDbEntry,
              403
            )
          })
        })
      })

      describe('when the caller is a Non-Org Member', () => {
        describe('who is not the comment Author', () => {
          it('should respond with 404 and prevent the deletion of Org Owner comments', async () => {
            await testDeleteIssueComment(
              orgAdminUser,
              nonOrgUser1,
              prvConn,
              prvDbEntry,
              404
            )
          })

          it('should respond with 404 and prevent the deletion of Org Member comments', async () => {
            await testDeleteIssueComment(
              orgMemberUser1,
              nonOrgUser1,
              prvConn,
              prvDbEntry,
              404
            )
          })
        })
      })
    })
  })

  describe('list_issue_timeline operation', () => {
    paramsTester.testInvalidParams({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number/timeline',
      userId: orgAdminUser.id
    })

    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/issues/some-issue-number/timeline'
    })

    it('should respond with 200 with a correct timeline events array', async () => {
      const mockIssue = issueMock.create({
        created_by: orgAdminUser.id,
        connection_id: prvConn.id,
        database_name: prvDbEntry.raw_name
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(orgAdminUser.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}/timeline`
      })

      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { issue_timeline } = response.json().payload

      expect(issue_timeline.length).toBe(1)
      expect(issue_timeline).toEqual([
        {
          id: expect.any(String),
          issue_id: createdIssue.id,
          user: {
            id: orgAdminUser.id,
            username: orgAdminUser.username,
            name: orgAdminUser.name,
            picture: orgAdminUser.picture
          },
          action_type: 'CREATE_ISSUE',
          action_details: { issue_number: 1 },
          created_at: expect.stringMatching(dateFormat)
        }
      ])

      expect(response.statusCode).toBe(200)
    })

    it('should respond with 401 for unauthorized access', async () => {
      const mockIssue = issueMock.create({
        created_by: orgAdminUser.id,
        connection_id: prvConn.id,
        database_name: prvDbEntry.raw_name
      })

      const createdIssue = await IssueService.createIssue(mockIssue)

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(nonOrgUser1.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}/timeline`
      })

      expectNotFound(response, 'database')
    })

    paramsTester.testNotFound({
      method: 'GET',
      url: '/v2/orgs/:org_slug/databases/:db_slug/issues/:issue_number/timeline',
      userId: orgAdminUser.id
    })

    describe('has permissions and', () => {
      it('should return a timeline for a given issue_number', async () => {
        const payload = issueMock.createPayload({
          created_by: orgAdminUser.id,
          title: 'Detailed Test Issue',
          description: 'This issue has all possible fields defined.'
        })

        const response1 = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
          payload
        })

        const createdIssue = response1.json().payload.issue
        issueMock.addPayloadId(createdIssue.id)

        const commentPayload = issueCommentMock.createPayload()

        const commentResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}/comments`,
          payload: commentPayload
        })

        expect(commentResponse.statusCode).toBe(201)
        issueCommentMock.addPayloadId(
          commentResponse.json().payload.issue_comment.id
        )

        const response2 = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'GET',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}/timeline`
        })

        expect(response2.json()).toEqual({
          type: 'list_issue_timeline',
          payload: {
            issue_timeline: [
              {
                id: expect.any(String),
                issue_id: createdIssue.id,
                user: expect.any(Object),
                action_details: {
                  issue_number: createdIssue.issue_number
                },
                action_type: 'CREATE_ISSUE',
                created_at: expect.any(String)
              },
              {
                id: expect.any(String),
                issue_id: createdIssue.id,
                user: expect.any(Object),
                action_details: {
                  comment_id: expect.any(String),
                  content: commentPayload.content
                },
                action_type: 'ADD_COMMENT',
                created_at: expect.any(String),
                permissions: {
                  delete_comment: {
                    value: true,
                    message:
                      'You do not have permission to delete this comment.'
                  },
                  update_comment: {
                    value: true,
                    message:
                      'You do not have permission to update this comment.'
                  }
                }
              }
            ]
          }
        })

        expect(response2.statusCode).toBe(200)
      })

      it('should return a timeline with a member created comment, that the org_admin can update', async () => {
        const payload = issueMock.createPayload({
          created_by: orgMemberUser1.id,
          title: 'Detailed Test Issue',
          description: 'This issue has all possible fields defined.'
        })

        const response1 = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgMemberUser1.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues`,
          payload
        })

        const createdIssue = response1.json().payload.issue
        issueMock.addPayloadId(createdIssue.id)

        const commentPayload = issueCommentMock.createPayload()

        const commentResponse = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgMemberUser1.id)}`
          },
          method: 'POST',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}/comments`,
          payload: commentPayload
        })

        expect(commentResponse.statusCode).toBe(201)
        issueCommentMock.addPayloadId(
          commentResponse.json().payload.issue_comment.id
        )

        const response2 = await server.inject({
          headers: {
            authorization: `Bearer ${createSortJwt(orgAdminUser.id)}`
          },
          method: 'GET',
          url: `/v2/orgs/${org.slug}/databases/${prvDbEntry.slug}/issues/${createdIssue.issue_number}/timeline`
        })

        expect(response2.json()).toEqual({
          type: 'list_issue_timeline',
          payload: {
            issue_timeline: [
              {
                id: expect.any(String),
                issue_id: createdIssue.id,
                user: expect.any(Object),
                action_details: {
                  issue_number: createdIssue.issue_number
                },
                action_type: 'CREATE_ISSUE',
                created_at: expect.any(String)
              },
              {
                id: expect.any(String),
                issue_id: createdIssue.id,
                user: expect.any(Object),
                action_details: {
                  comment_id: expect.any(String),
                  content: commentPayload.content
                },
                action_type: 'ADD_COMMENT',
                created_at: expect.any(String),
                permissions: {
                  delete_comment: {
                    value: true,
                    message:
                      'You do not have permission to delete this comment.'
                  },
                  update_comment: {
                    value: false,
                    message:
                      'You do not have permission to update this comment.'
                  }
                }
              }
            ]
          }
        })

        expect(response2.statusCode).toBe(200)
      })
    })
  })
})
