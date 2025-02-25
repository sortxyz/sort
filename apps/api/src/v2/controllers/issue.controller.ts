import { randomUUID } from 'node:crypto'

import { Type } from '@sinclair/typebox'
import { IssueNotificationSource } from '@sort/shared/constants/notifications.constant'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  GeneralSuccessSchema,
  ValidationErrorSchema,
  createMessageSchema,
  UuidSchema,
  MarkdownColumnSchema
} from '@sort/shared/schemas/api.schema'
import { AssigneesSchema } from '@sort/shared/schemas/assignees.schema'
import * as IssueCommentSchema from '@sort/shared/schemas/issue-comment.schema'
import * as IssueHistorySchema from '@sort/shared/schemas/issue-history.schema'
import * as IssueSchema from '@sort/shared/schemas/issue.schema'
import { LabelIdSchema } from '@sort/shared/schemas/label.schema'
import { DatabaseSlugSchema } from '@sort/shared/schemas/metadata.schema'
import { OrganizationSlugSchema } from '@sort/shared/schemas/org.schema'
import * as ChangeRequestService from '@sort/shared/services/change-requests/change-request.service'
import * as ConnectionService from '@sort/shared/services/connection.service'
import {
  deleteCommentPermissionValues,
  getIssuePermissions,
  updateCommentPermissionValues,
  validateIssuePermissions as validatePermissions
} from '@sort/shared/services/issue.permissions.service'
import * as IssueSearchService from '@sort/shared/services/issue.search.service'
import * as IssueService from '@sort/shared/services/issue.service'
import * as DatabaseMetadataService from '@sort/shared/services/kysely/metadata/database.service'
import { createGetLabelsByDatabaseQuery } from '@sort/shared/services/label.service'
import { sendIssueNotification } from '@sort/shared/services/notification.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import { IssueStatusSchema } from '@sort/shared/types/kysely.type'
import { mdToHtml } from '@sort/shared/utils/string.util'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { Label } from '@sort/shared/schemas/label.schema'
import type { OrganizationMember } from '@sort/shared/schemas/org-member.schema'
import type { IssueRelationResponse } from '@sort/shared/schemas/relations.schema'
import type { FastifySchema } from 'fastify'

export const getIssuesSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get all Database Issues',
  operationId: 'list_issues',
  tags: ['issue'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema
  }),
  response: {
    200: createMessageSchema(
      'list_issues',
      Type.Object({ issues: Type.Array(IssueSchema.IssueSchema) })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getDatabaseIssues = async (
  request: FastifyRequestTypebox<typeof getIssuesSchema>,
  reply: FastifyReplyTypebox<typeof getIssuesSchema>
) => {
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const permCheck = await validatePermissions(
    database.connection_id,
    request.sort,
    org,
    {
      pub: { needsCustomerAccount: false }
    }
  )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  const issues = await IssueService.getDatabaseIssues({
    org_slug: org.slug,
    connection_id: database.connection_id,
    database_name: database.raw_name
  })

  return reply.status(200).send({ type: 'list_issues', payload: { issues } })
}

export const getIssueSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get an Issue',
  operationId: 'get_issue',
  tags: ['issue'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    issue_number: IssueSchema.IssueNumberSchema
  }),
  response: {
    200: createMessageSchema(
      'get_issue',
      Type.Object({ issue: IssueSchema.IssueSchema })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getIssue = async (
  request: FastifyRequestTypebox<typeof getIssueSchema>,
  reply: FastifyReplyTypebox<typeof getIssueSchema>
) => {
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const permCheck = await validatePermissions(
    database.connection_id,
    request.sort,
    org,
    {
      pub: { needsCustomerAccount: false }
    }
  )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  const issue = await IssueService.getIssue({
    org_slug: org.slug,
    connection_id: database.connection_id,
    database_name: database.raw_name,
    issue_number: params.issue_number
  })

  if (!issue) {
    return reply.sendNotFound('issue')
  }

  const permissions = await getIssuePermissions(issue, org, request.sort)

  return reply
    .status(200)
    .send({ type: 'get_issue', payload: { issue: { ...issue, permissions } } })
}

export const getIssueHistorySchema = {
  headers: AuthHeadersSchema,
  summary: 'Get event history for an Issue',
  operationId: 'list_issue_history',
  tags: ['issue'],
  hide: true, // not being used right now
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    issue_number: IssueSchema.IssueNumberSchema
  }),
  response: {
    200: createMessageSchema(
      'list_issue_history',
      Type.Object({
        issue_history: Type.Array(IssueHistorySchema.IssueHistorySchema)
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getIssueHistory = async (
  request: FastifyRequestTypebox<typeof getIssueHistorySchema>,
  reply: FastifyReplyTypebox<typeof getIssueHistorySchema>
) => {
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const permCheck = await validatePermissions(
    database.connection_id,
    request.sort,
    org,
    {
      pub: { needsCustomerAccount: false }
    }
  )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  const issue = await IssueService.getIssue({
    org_slug: org.slug,
    connection_id: database.connection_id,
    database_name: database.raw_name,
    issue_number: params.issue_number
  })

  if (!issue) {
    return reply.sendNotFound('issue')
  }

  const issueHistory = await IssueService.getIssueHistory(issue.id)

  if (!issueHistory.length) {
    return reply.sendNotFound('issue')
  }

  return reply.status(200).send({
    type: 'list_issue_history',
    payload: { issue_history: issueHistory }
  })
}

export const getIssueTimelineSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get the timeline of Issue events',
  operationId: 'list_issue_timeline',
  tags: ['issue'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    issue_number: IssueSchema.IssueNumberSchema
  }),
  response: {
    200: createMessageSchema(
      'list_issue_timeline',
      // Intentionally keeping IssueHistorySchema here for now.
      // We could tighten this up to a subset of the fields by omitting
      // a few types in the union if needed.
      Type.Object({
        issue_timeline: Type.Array(IssueHistorySchema.IssueHistorySchema)
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getIssueTimeline = async (
  request: FastifyRequestTypebox<typeof getIssueTimelineSchema>,
  reply: FastifyReplyTypebox<typeof getIssueTimelineSchema>
) => {
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const issue = await IssueService.getIssue({
    org_slug: org.slug,
    connection_id: database.connection_id,
    database_name: database.raw_name,
    issue_number: params.issue_number
  })

  if (!issue) {
    return reply.sendNotFound('issue')
  }

  const permCheck = await validatePermissions(
    database.connection_id,
    request.sort,
    org,
    {
      pub: { needsCustomerAccount: false }
    }
  )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  try {
    const issueTimeline = await IssueService.getIssueTimeline(issue.id)

    if (!issueTimeline.length) {
      return reply.sendNotFound('issue')
    }

    const issueTimelineWithPermissions =
      await IssueService.attachCommentPermissions(
        issueTimeline,
        issue,
        org,
        request.sort
      )

    return reply.status(200).send({
      type: 'list_issue_timeline',
      payload: { issue_timeline: issueTimelineWithPermissions }
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Issue does not exist') {
      return reply.sendNotFound('issue')
    }

    throw error
  }
}

const CreateIssueBodySchema = Type.Object({
  title: Type.String({ minLength: 2, maxLength: 256 }),
  description: Type.Optional(MarkdownColumnSchema),
  labels: Type.Optional(Type.Array(LabelIdSchema)),
  assignees: Type.Optional(AssigneesSchema),
  related_change_requests: Type.Optional(Type.Array(Type.Number()))
})

export const createIssueSchema = {
  headers: AuthHeadersSchema,
  body: CreateIssueBodySchema,
  summary: 'Create an Issue',
  operationId: 'create_issue',
  tags: ['issue'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema
  }),
  response: {
    201: createMessageSchema(
      'create_issue',
      Type.Object({ issue: IssueSchema.IssueSchema })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    422: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const createIssue = async (
  request: FastifyRequestTypebox<typeof createIssueSchema>,
  reply: FastifyReplyTypebox<typeof createIssueSchema>
) => {
  const body = request.body
  const params = request.params
  const userId = request.sort.user.id

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const permCheck = await validatePermissions(
    database.connection_id,
    request.sort,
    org
  )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  let labels: Label[] | undefined
  if (body.labels?.length) {
    labels = await createGetLabelsByDatabaseQuery({
      connection_id: database.connection_id,
      database_name: database.raw_name
    })
      .where('label.id', 'in', body.labels)
      .execute()

    // Check for presence of all expected labels
    if (labels.length !== body.labels.length) {
      return reply.status(422).send({
        type: 'error',
        payload: {
          error: { message: 'One or more labels not found' }
        }
      })
    }
  }

  let assignees: OrganizationMember[] | undefined
  if (body.assignees) {
    const assigneesRows = body.assignees.length
      ? await OrganizationService.createGetMembersBaseQueryBuilder(org.slug)
          .where('user.id', 'in', body.assignees)
          .execute()
      : []

    assignees = assigneesRows.map(OrganizationService.rowToOrganizationMember)

    // Check for presence of all expected assignees
    if (assignees.length !== body.assignees.length) {
      return reply.status(422).send({
        type: 'error',
        payload: {
          error: { message: 'One or more assignees not found' }
        }
      })
    }
  }

  let relatedChangeRequests: IssueRelationResponse[] | undefined
  if (body.related_change_requests) {
    relatedChangeRequests =
      await ChangeRequestService.getChangeRequestsByNumbers({
        connectionId: database.connection_id,
        databaseName: database.raw_name,
        changeRequestNumbers: body.related_change_requests
      })
    if (relatedChangeRequests.length !== body.related_change_requests?.length) {
      return reply.status(422).send({
        type: 'error',
        payload: {
          error: { message: 'One or more Change Requests not found.' }
        }
      })
    }
  }

  const issue = await IssueService.createIssue({
    id: randomUUID(),
    connection_id: database.connection_id,
    database_name: database.raw_name,
    created_by: userId,
    title: body.title,
    description: body.description ?? null,
    labels,
    assignees,
    related_change_requests: relatedChangeRequests
  })

  const username = request.sort.user.username
  const mdMessage = `@${username} opened an issue\n---\n${issue.description}`
  const htmlMessage = await mdToHtml(issue.description || '')
  await sendIssueNotification({
    org,
    database,
    issue,
    mdMessage,
    htmlMessage,
    logger: request.log,
    source: IssueNotificationSource.CREATE
  })

  return reply.status(201).send({ type: 'create_issue', payload: { issue } })
}

const UpdateIssueBodySchema = Type.Partial(
  Type.Object({
    title: Type.String({ minLength: 2, maxLength: 256 }),
    description: Type.Optional(MarkdownColumnSchema),
    status: IssueStatusSchema,
    labels: Type.Array(LabelIdSchema),
    assignees: Type.Array(Type.String({ minLength: 0, maxLength: 128 })),
    related_change_requests: Type.Array(Type.Number())
  }),
  { minProperties: 1 }
)

export const updateIssueSchema = {
  headers: AuthHeadersSchema,
  body: UpdateIssueBodySchema,
  summary: 'Update an Issue',
  operationId: 'update_issue',
  tags: ['issue'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    issue_number: IssueSchema.IssueNumberSchema
  }),
  response: {
    200: createMessageSchema(
      'update_issue',
      Type.Object({ issue: IssueSchema.IssueSchema })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const updateIssue = async (
  request: FastifyRequestTypebox<typeof updateIssueSchema>,
  reply: FastifyReplyTypebox<typeof updateIssueSchema>
) => {
  const {
    labels, // undefined = don't change
    assignees, // undefined = don't change
    // eslint-disable-next-line @typescript-eslint/naming-convention
    related_change_requests, // undefined = don't change
    description = null,
    status,
    title
  } = request.body
  const params = request.params
  const userId = request.sort.user.id

  const org = await OrganizationService.getBySlug(params.org_slug, userId)
  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  let labelsToUpdate: Label[] | undefined
  if (labels?.length) {
    labelsToUpdate = await createGetLabelsByDatabaseQuery({
      connection_id: database.connection_id,
      database_name: database.raw_name
    })
      .where('label.id', 'in', labels)
      .execute()

    // Check for presence of all expected labels
    if (labelsToUpdate.length !== labels.length) {
      return reply.status(422).send({
        type: 'error',
        payload: {
          error: { message: 'One or more labels not found' }
        }
      })
    }
  }

  const issue = await IssueService.getIssue({
    org_slug: org.slug,
    connection_id: database.connection_id,
    database_name: database.raw_name,
    issue_number: params.issue_number
  })

  if (!issue) {
    return reply.sendNotFound('issue')
  }

  let relatedChangeRequestsToUpdate: IssueRelationResponse[] | undefined
  if (related_change_requests !== undefined) {
    relatedChangeRequestsToUpdate =
      await ChangeRequestService.getChangeRequestsByNumbers({
        connectionId: database.connection_id,
        databaseName: database.raw_name,
        changeRequestNumbers: related_change_requests ?? []
      })
    if (
      relatedChangeRequestsToUpdate.length !== related_change_requests?.length
    ) {
      return reply.status(422).send({
        type: 'error',
        payload: {
          error: { message: 'One or more Change Requests not found.' }
        }
      })
    }
  }

  const permCheck = await validatePermissions(
    database.connection_id,
    request.sort,
    org,
    {
      isAuthor: userId === issue.created_by,
      pub: { needsAuthorOrOrgMember: true },
      prv: { needsAuthorOrOrgMember: true }
    }
  )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  let assigneesToUpdate: OrganizationMember[] | undefined
  if (assignees !== undefined) {
    const assigneesRows = assignees.length
      ? await OrganizationService.createGetMembersBaseQueryBuilder(org.slug)
          .where('user.id', 'in', assignees)
          .execute()
      : []

    assigneesToUpdate = assigneesRows.map(
      OrganizationService.rowToOrganizationMember
    )

    // Check for presence of all expected assignees
    if (assigneesToUpdate.length !== assignees.length) {
      return reply.status(422).send({
        type: 'error',
        payload: {
          error: { message: 'One or more assignees not found' }
        }
      })
    }
  }

  const updatedIssue = await IssueService.updateIssue(
    {
      user_id: userId,
      issueData: {
        org_slug: org.slug,
        connection_id: database.connection_id,
        database_name: database.raw_name,
        issue_number: params.issue_number
      }
    },
    {
      title,
      description,
      status,
      labels: labelsToUpdate,
      assignees: assigneesToUpdate,
      relatedChangeRequests: relatedChangeRequestsToUpdate
    }
  )

  if (issue.status !== updatedIssue.status) {
    const status = updatedIssue.status === 'closed' ? 'closed' : 'reopened'
    await sendIssueNotification({
      org,
      database,
      issue: updatedIssue,
      htmlMessage: `@${request.sort.user.username} ${status} issue #${issue.issue_number}`,
      logger: request.log,
      source: IssueNotificationSource.UPDATE
    })
  }

  return reply
    .status(200)
    .send({ type: 'update_issue', payload: { issue: updatedIssue } })
}

export const searchIssuesSchema = {
  headers: AuthHeadersSchema,
  summary: 'Search for Issues',
  operationId: 'search_issues',
  tags: ['issue', 'search'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema
  }),
  querystring: Type.Object({
    q: Type.Optional(Type.String({ maxLength: 256 })),
    limit: Type.Optional(
      Type.Integer({ minimum: 1, maximum: 100, default: 20 })
    )
  }),
  response: {
    200: createMessageSchema(
      'search_issues',
      Type.Object({
        issues: Type.Array(IssueSchema.IssueSchema)
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const searchDatabaseIssues = async (
  request: FastifyRequestTypebox<typeof searchIssuesSchema>,
  reply: FastifyReplyTypebox<typeof searchIssuesSchema>
) => {
  const query = request.query
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
    orgSlug: params.org_slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const permCheck = await validatePermissions(
    database.connection_id,
    request.sort,
    org,
    {
      pub: { needsCustomerAccount: false }
    }
  )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  const issues = await IssueSearchService.searchDatabaseIssues({
    orgSlug: params.org_slug,
    connectionId: database.connection_id,
    databaseName: database.raw_name,
    query: query.q || '',
    limit: query.limit ?? 100
  })

  return reply.status(200).send({
    type: 'search_issues',
    payload: { issues }
  })
}

const createIssueCommentBodySchema = Type.Object({
  content: IssueCommentSchema.IssueCommentContentSchema
})

export const createIssueCommentSchema = {
  headers: AuthHeadersSchema,
  body: createIssueCommentBodySchema,
  summary: 'Create an Issue Comment',
  operationId: 'create_issue_comment',
  tags: ['issue'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    issue_number: IssueSchema.IssueNumberSchema
  }),
  response: {
    201: createMessageSchema(
      'create_issue_comment',
      Type.Object({ issue_comment: IssueCommentSchema.IssueCommentSchema })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const createIssueComment = async (
  request: FastifyRequestTypebox<typeof createIssueCommentSchema>,
  reply: FastifyReplyTypebox<typeof createIssueCommentSchema>
) => {
  const body = request.body
  const params = request.params
  const userId = request.sort.user.id

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const connection = await ConnectionService.getByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!connection) {
    return reply.sendNotFound('database')
  }

  const permCheck = await validatePermissions(
    connection.id,
    request.sort,
    org,
    {
      pub: { needsCustomerAccount: false }
    }
  )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const issue = await IssueService.getIssue({
    org_slug: org.slug,
    connection_id: database.connection_id,
    database_name: database.raw_name,
    issue_number: params.issue_number
  })

  if (!issue) {
    return reply.sendNotFound('issue')
  }

  let issueComment: IssueCommentSchema.IssueComment
  try {
    issueComment = await IssueService.createIssueComment(
      { org_slug: org.slug, issue_id: issue.id },
      {
        id: randomUUID(),
        created_by: userId,
        content: body.content
      }
    )
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Failed to get issue by issue_number'
    ) {
      return reply.sendNotFound('issue')
    }

    throw error
  }

  const username = request.sort.user.username
  const mdMessage = `@${username} commented\n---\n${body.content}`
  const htmlMessage = await mdToHtml(
    `@${username} commented\n<hr>\n${body.content}`
  )
  const additionalRecipients =
    request.sort.user.email && request.sort.user.email_verified
      ? [
          {
            email: request.sort.user.email,
            name: request.sort.user.name || null
          }
        ]
      : []

  await sendIssueNotification({
    org,
    database,
    issue,
    htmlMessage,
    mdMessage,
    logger: request.log,
    source: IssueNotificationSource.COMMENT,
    additionalRecipients
  })

  return reply.status(201).send({
    type: 'create_issue_comment',
    payload: { issue_comment: issueComment }
  })
}

export const updateIssueCommentSchema = {
  headers: AuthHeadersSchema,
  body: Type.Omit(createIssueCommentBodySchema, ['id']),
  summary: 'Update an Issue Comment',
  operationId: 'update_issue_comment',
  tags: ['issue'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    issue_number: IssueSchema.IssueNumberSchema,
    comment_id: UuidSchema
  }),
  response: {
    200: createMessageSchema(
      'update_issue_comment',
      Type.Object({ issue_comment: IssueCommentSchema.IssueCommentSchema })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const updateIssueComment = async (
  request: FastifyRequestTypebox<typeof updateIssueCommentSchema>,
  reply: FastifyReplyTypebox<typeof updateIssueCommentSchema>
) => {
  const body = request.body
  const params = request.params
  const userId = request.sort.user.id

  const org = await OrganizationService.getBySlug(params.org_slug, userId)

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const issue = await IssueService.getIssue({
    org_slug: org.slug,
    connection_id: database.connection_id,
    database_name: database.raw_name,
    issue_number: params.issue_number
  })

  if (!issue) {
    return reply.sendNotFound('issue')
  }

  const issueComment = await IssueService.getIssueComment(params.comment_id)

  if (!issueComment) {
    return reply.sendNotFound('issue comment')
  }

  const permCheck = await validatePermissions(
    database.connection_id,
    request.sort,
    org,
    updateCommentPermissionValues(issueComment.created_by === userId)
  )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  const updatedIssueComment = await IssueService.updateIssueComment({
    id: issueComment.id,
    issue_id: issue.id,
    content: body.content
  })

  return reply.status(200).send({
    type: 'update_issue_comment',
    payload: { issue_comment: updatedIssueComment }
  })
}

export const deleteIssueCommentSchema = {
  headers: AuthHeadersSchema,
  summary: 'Delete an Issue Comment',
  operationId: 'delete_issue_comment',
  tags: ['issue'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    issue_number: IssueSchema.IssueNumberSchema,
    comment_id: UuidSchema
  }),
  response: {
    200: GeneralSuccessSchema,
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const deleteIssueComment = async (
  request: FastifyRequestTypebox<typeof deleteIssueCommentSchema>,
  reply: FastifyReplyTypebox<typeof deleteIssueCommentSchema>
) => {
  const params = request.params
  const userId = request.sort.user.id

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await DatabaseMetadataService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const issue = await IssueService.getIssue({
    org_slug: org.slug,
    connection_id: database.connection_id,
    database_name: database.raw_name,
    issue_number: params.issue_number
  })

  if (!issue) {
    return reply.sendNotFound('issue')
  }

  const issueComment = await IssueService.getIssueComment(params.comment_id)

  if (!issueComment) {
    return reply.sendNotFound('issue comment')
  }

  const permCheck = await validatePermissions(
    database.connection_id,
    request.sort,
    org,
    deleteCommentPermissionValues(issueComment.created_by === userId)
  )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  await IssueService.deleteIssueComment({
    id: issueComment.id,
    userId: userId,
    issue_id: issue.id
  })

  return reply.send({
    type: 'success',
    payload: {
      success: {
        message: `IssueComment ${params.comment_id} deleted successfully.`
      }
    }
  })
}
