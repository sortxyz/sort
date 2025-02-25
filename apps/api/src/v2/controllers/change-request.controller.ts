import { randomUUID } from 'node:crypto'

import { Type } from '@sinclair/typebox'
import { ChangeRequestNotificationSource } from '@sort/shared/constants/notifications.constant'
import {
  DuplicateColumnNameError,
  DuplicateUniqueIndexError
} from '@sort/shared/errors/change-requests/duplicates.error'
import {
  NonNullableNonGeneratedFieldError,
  NonNullableColumnError
} from '@sort/shared/errors/change-requests/non-nullable.error'
import {
  PrimaryKeyDoesNotExistError,
  PrimaryKeyMatchError
} from '@sort/shared/errors/change-requests/primary-keys.error'
import { RowMissingError } from '@sort/shared/errors/change-requests/row-missing.error'
import {
  InvalidColumnTypeError,
  InvalidValueError,
  UnknownColumnTypeError
} from '@sort/shared/errors/change-requests/unknown.error'
import { JobExistsError } from '@sort/shared/errors/job-exists.error'
import { NotApprovedError } from '@sort/shared/errors/not-approved.error'
import { NotFoundError } from '@sort/shared/errors/not-found.error'
import { PostgresFkViolationError } from '@sort/shared/errors/postgres-fk-violation.error'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  GeneralSuccessSchema,
  ValidationErrorSchema,
  createMessageSchema
} from '@sort/shared/schemas/api.schema'
import * as ChangeRequestHistorySchema from '@sort/shared/schemas/change-request-history.schema'
import {
  ChangeRequestNumberSchema,
  CreateChangeRequestBodySchema,
  FullChangeRequestResponseSchema,
  ChangeRequestSearchResponseSchema,
  UpdateChangeRequestBodySchema
} from '@sort/shared/schemas/change-request.schema'
import { DatabaseSlugSchema } from '@sort/shared/schemas/metadata.schema'
import { OrganizationSlugSchema } from '@sort/shared/schemas/org.schema'
import * as ChangeRequestPermissionService from '@sort/shared/services/change-requests/change-request.permissions'
import * as ChangeRequestSearchService from '@sort/shared/services/change-requests/change-request.search.service'
import * as ChangeRequestService from '@sort/shared/services/change-requests/change-request.service'
import * as ChangeRequestTimelineService from '@sort/shared/services/change-requests/change-request.timeline.service'
import * as ConnectionService from '@sort/shared/services/connection.service'
import { getIssuesByNumbers } from '@sort/shared/services/issue.service'
import * as MetadataDatabaseService from '@sort/shared/services/kysely/metadata/database.service'
import { createGetLabelsByDatabaseQuery } from '@sort/shared/services/label.service'
import { sendChangeRequestNotification } from '@sort/shared/services/notification.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import { mdToHtml } from '@sort/shared/utils/string.util'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { TableContext } from '@sort/shared/errors/not-found.error'
import type {
  RequestChange,
  RequestChangeFieldValue
} from '@sort/shared/schemas/change.schema'
import type { Label } from '@sort/shared/schemas/label.schema'
import type { OrganizationMember } from '@sort/shared/schemas/org-member.schema'
import type { ChangeRequestRelationResponse } from '@sort/shared/schemas/relations.schema'
import type { FastifySchema } from 'fastify'

export const getChangeRequestsSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get all database Change Requests',
  operationId: 'list_change_requests',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema
  }),
  response: {
    200: createMessageSchema(
      'list_change_requests',
      Type.Object({
        change_requests: Type.Array(FullChangeRequestResponseSchema)
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getDatabaseChangeRequests = async (
  request: FastifyRequestTypebox<typeof getChangeRequestsSchema>,
  reply: FastifyReplyTypebox<typeof getChangeRequestsSchema>
) => {
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await MetadataDatabaseService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const permCheck =
    await ChangeRequestPermissionService.validateChangeRequestPermissions(
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

  const changeRequests =
    await ChangeRequestService.getFullChangeRequestsResponse({
      org_slug: org.slug,
      connection_id: database.connection_id,
      database_name: database.raw_name
    })

  return reply.status(200).send({
    type: 'list_change_requests',
    payload: { change_requests: changeRequests }
  })
}

export const getChangeRequestSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get a Change Request',
  operationId: 'get_change_request',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema
  }),
  response: {
    200: createMessageSchema(
      'get_change_request',
      Type.Object({
        change_request: FullChangeRequestResponseSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getChangeRequest = async (
  request: FastifyRequestTypebox<typeof getChangeRequestSchema>,
  reply: FastifyReplyTypebox<typeof getChangeRequestSchema>
) => {
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await MetadataDatabaseService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const permCheck =
    await ChangeRequestPermissionService.validateChangeRequestPermissions(
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

  const changeRequest = await ChangeRequestService.getFullChangeRequestResponse(
    {
      org_slug: org.slug,
      connection_id: database.connection_id,
      database_name: database.raw_name,
      change_request_number: params.change_request_number
    }
  )

  if (!changeRequest) {
    return reply.sendNotFound('change request')
  }

  const permissions =
    await ChangeRequestPermissionService.getChangeRequestPermissions(
      changeRequest,
      org,
      request.sort
    )

  return reply.status(200).send({
    type: 'get_change_request',
    payload: { change_request: { ...changeRequest, permissions } }
  })
}

export const getChangeRequestTimelineSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get the timeline of Change Request events',
  operationId: 'list_change_request_timeline',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema
  }),
  response: {
    200: createMessageSchema(
      'list_change_request_timeline',
      Type.Object({
        change_request_timeline: Type.Array(
          ChangeRequestHistorySchema.ChangeRequestHistorySchema
        )
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getChangeRequestTimeline = async (
  request: FastifyRequestTypebox<typeof getChangeRequestTimelineSchema>,
  reply: FastifyReplyTypebox<typeof getChangeRequestTimelineSchema>
) => {
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await MetadataDatabaseService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const changeRequest = await ChangeRequestService.getFullChangeRequestResponse(
    {
      org_slug: org.slug,
      connection_id: database.connection_id,
      database_name: database.raw_name,
      change_request_number: params.change_request_number
    }
  )

  if (!changeRequest) {
    return reply.sendNotFound('change request')
  }

  const permCheck =
    await ChangeRequestPermissionService.validateChangeRequestPermissions(
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
    const changeRequestTimeline =
      await ChangeRequestTimelineService.getChangeRequestTimeline(
        changeRequest.id
      )

    if (!changeRequestTimeline.length) {
      return reply.sendNotFound('change request')
    }

    const changeRequestTimelineWithPermissions =
      await ChangeRequestTimelineService.attachCommentPermissions(
        changeRequestTimeline,
        changeRequest,
        org,
        request.sort
      )

    return reply.status(200).send({
      type: 'list_change_request_timeline',
      payload: { change_request_timeline: changeRequestTimelineWithPermissions }
    })
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'Change Request does not exist'
    ) {
      return reply.sendNotFound('change request')
    }

    throw error
  }
}

export const createChangeRequestSchema = {
  headers: AuthHeadersSchema,
  body: CreateChangeRequestBodySchema,
  summary: 'Create a Change Request',
  operationId: 'create_change_request',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema
  }),
  response: {
    201: createMessageSchema(
      'create_change_request',
      Type.Object({
        change_request: FullChangeRequestResponseSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    409: GeneralErrorSchema,
    422: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

const createValidationError = ({
  change,
  field,
  submittedChanges,
  message
}: {
  change: RequestChange
  field: RequestChangeFieldValue
  submittedChanges: RequestChange[]
  message: string
}) => {
  const changeIndex = submittedChanges.findIndex(c => c === change) ?? -1
  const fieldIndex =
    change.action === 'DELETE' ? -1 : change.fields.findIndex(f => f === field)
  const path =
    changeIndex > -1 && fieldIndex > -1
      ? `changes/${changeIndex}/fields/${fieldIndex}/value`
      : 'changes'

  return {
    type: 'validation_error',
    payload: {
      validation_error: {
        message,
        context: 'body',
        errors: {
          body: {
            [path]: message
          }
        }
      }
    }
  } as const
}

export const createChangeRequest = async (
  request: FastifyRequestTypebox<typeof createChangeRequestSchema>,
  reply: FastifyReplyTypebox<typeof createChangeRequestSchema>
) => {
  const body = request.body
  const params = request.params
  const userId = request.sort.user.id
  const changes = request.body.changes

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await MetadataDatabaseService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const permCheck =
    await ChangeRequestPermissionService.validateChangeRequestPermissions(
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

  let relatedIssues: Awaited<ReturnType<typeof getIssuesByNumbers>> | undefined
  if (body.related_issues?.length) {
    relatedIssues = await getIssuesByNumbers({
      connection_id: database.connection_id,
      database_name: database.raw_name,
      issueNumbers: body.related_issues ?? []
    })
    if (relatedIssues.length !== body.related_issues?.length) {
      return reply.status(422).send({
        type: 'error',
        payload: {
          error: { message: 'One or more Issues not found.' }
        }
      })
    }
  }

  let reviewers: OrganizationMember[] | undefined
  if (body.reviewers) {
    const reviewersRows = body.reviewers.length
      ? await OrganizationService.createGetMembersBaseQueryBuilder(org.slug)
          .where('user.id', 'in', body.reviewers)
          .execute()
      : []

    reviewers = reviewersRows.map(OrganizationService.rowToOrganizationMember)

    // Check for presence of all expected reviewers
    if (reviewers.length !== body.reviewers.length) {
      return reply.status(422).send({
        type: 'error',
        payload: {
          error: { message: 'One or more reviewers not found' }
        }
      })
    }
  }

  try {
    const changeRequest = await ChangeRequestService.createChangeRequest({
      id: randomUUID(),
      connection_id: database.connection_id,
      database_name: database.raw_name,
      created_by: userId,
      title: body.title,
      description: body.description ?? null,
      labels: labels ?? [],
      reviewers: reviewers ?? [],
      changes: changes ?? [],
      related_issues: relatedIssues ?? []
    })

    const username = request.sort.user.username
    const description = changeRequest.description || ''
    const mdMessage = `@${username} opened a change request\n---\n${description}`
    const htmlMessage = await mdToHtml(description)

    await sendChangeRequestNotification({
      org,
      database,
      changeRequest,
      mdMessage,
      htmlMessage,
      logger: request.log,
      source: ChangeRequestNotificationSource.CREATE
    })

    return reply.status(201).send({
      type: 'create_change_request',
      payload: { change_request: changeRequest }
    })
  } catch (error) {
    const err = error as NodeJS.ErrnoException

    if (err.cause instanceof NotFoundError && err.cause?.entity === 'table') {
      const ctx = err.cause.context as TableContext
      const msgStart = `Table "${ctx?.missingTableName}" does not exist in the database.`
      const msg = `${msgStart} Please double check your table names and/or re-import your database before trying again.`
      return reply.status(409).send({
        type: 'error',
        payload: {
          error: {
            message: msg
          }
        }
      })
    }

    if (PostgresFkViolationError.isViolationError(err)) {
      const error = err as PostgresFkViolationError
      if (error.constraint === 'fk_change_metadata_table_name') {
        const msgStart = error.metadata.tableName
          ? `Table "${error.metadata.tableName}" does not exist in the database.`
          : 'One or more tables do not exist in the database.'
        const msg = `${msgStart} Please double check your table names and/or re-import your database before trying again.`
        return reply.status(409).send({
          type: 'error',
          payload: {
            error: {
              message: msg
            }
          }
        })
      }
    }

    if (
      err.cause instanceof DuplicateUniqueIndexError ||
      err.cause instanceof InvalidColumnTypeError ||
      err.cause instanceof UnknownColumnTypeError ||
      err.cause instanceof PrimaryKeyMatchError ||
      err.cause instanceof RowMissingError ||
      err.cause instanceof PrimaryKeyDoesNotExistError ||
      err.cause instanceof DuplicateColumnNameError ||
      err.cause instanceof NonNullableNonGeneratedFieldError
    ) {
      return reply.status(409).send({
        type: 'error',
        payload: {
          error: {
            message: err.cause?.message
          }
        }
      })
    }

    if (
      err.cause instanceof NonNullableColumnError ||
      err.cause instanceof InvalidValueError
    ) {
      const colError = err.cause
      const validationError = createValidationError({
        message: colError.message,
        change: colError.cause.change,
        field: colError.cause.field,
        submittedChanges: body.changes ?? []
      })
      return reply.status(400).send(validationError)
    }

    throw err
  }
}

export const updateChangeRequestSchema = {
  headers: AuthHeadersSchema,
  body: UpdateChangeRequestBodySchema,
  summary: 'Update a Change Request',
  operationId: 'update_change_request',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema
  }),
  response: {
    200: createMessageSchema(
      'update_change_request',
      Type.Object({
        change_request: FullChangeRequestResponseSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const updateChangeRequest = async (
  request: FastifyRequestTypebox<typeof updateChangeRequestSchema>,
  reply: FastifyReplyTypebox<typeof updateChangeRequestSchema>
) => {
  const {
    labels, // undefined = don't change
    reviewers, // undefined = don't change
    // eslint-disable-next-line @typescript-eslint/naming-convention
    related_issues, // undefined = don't change
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

  const database = await MetadataDatabaseService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const changeRequest = await ChangeRequestService.getFullChangeRequestResponse(
    {
      org_slug: org.slug,
      connection_id: database.connection_id,
      database_name: database.raw_name,
      change_request_number: params.change_request_number
    }
  )

  if (!changeRequest) {
    return reply.sendNotFound('change request')
  }

  const permCheck =
    await ChangeRequestPermissionService.validateChangeRequestPermissions(
      database.connection_id,
      request.sort,
      org,
      {
        isAuthor: userId === changeRequest.created_by,
        pub: { needsAuthorOrOrgMember: true },
        prv: { needsAuthorOrOrgMember: true }
      }
    )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  let reviewersToUpdate: OrganizationMember[] | undefined
  if (reviewers !== undefined) {
    const reviewersRows = reviewers.length
      ? await OrganizationService.createGetMembersBaseQueryBuilder(org.slug)
          .where('user.id', 'in', reviewers)
          .execute()
      : []

    reviewersToUpdate = reviewersRows.map(
      OrganizationService.rowToOrganizationMember
    )

    // Check for presence of all expected reviewers
    if (reviewersToUpdate.length !== reviewers.length) {
      return reply.status(422).send({
        type: 'error',
        payload: {
          error: { message: 'One or more reviewers not found' }
        }
      })
    }
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
    if (labelsToUpdate?.length !== labels.length) {
      return reply.status(422).send({
        type: 'error',
        payload: {
          error: { message: 'One or more Labels not found.' }
        }
      })
    }
  }

  let relatedIssuesToUpdate: ChangeRequestRelationResponse[] | undefined
  if (related_issues !== undefined) {
    relatedIssuesToUpdate = await getIssuesByNumbers({
      connection_id: database.connection_id,
      database_name: database.raw_name,
      issueNumbers: related_issues
    })
    if (relatedIssuesToUpdate?.length !== related_issues.length) {
      return reply.status(422).send({
        type: 'error',
        payload: {
          error: { message: 'One or more Issues not found.' }
        }
      })
    }
  }

  const updatedChangeRequest = await ChangeRequestService.updateChangeRequest(
    {
      user_id: userId,
      changeRequestData: {
        org_slug: org.slug,
        connection_id: database.connection_id,
        database_name: database.raw_name,
        change_request_number: params.change_request_number
      }
    },
    {
      title,
      description,
      status,
      labels: labelsToUpdate,
      reviewers: reviewersToUpdate,
      relatedIssues: relatedIssuesToUpdate
    }
  )

  if (changeRequest.status !== updatedChangeRequest.status) {
    const status =
      changeRequest.status === 'closed' &&
      updatedChangeRequest.status === 'open'
        ? 'reopened'
        : updatedChangeRequest.status
    await sendChangeRequestNotification({
      org,
      database,
      changeRequest: updatedChangeRequest,
      htmlMessage: `@${request.sort.user.username} ${status} change request #${changeRequest.change_request_number}`,
      logger: request.log,
      source: ChangeRequestNotificationSource.UPDATE
    })
  }

  return reply.status(200).send({
    type: 'update_change_request',
    payload: { change_request: updatedChangeRequest }
  })
}

export const searchChangeRequestsSchema = {
  headers: AuthHeadersSchema,
  summary: 'Search for Change Requests',
  operationId: 'search_change_requests',
  tags: ['change_request', 'search'],
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
      'search_change_requests',
      Type.Object({
        change_requests: Type.Array(ChangeRequestSearchResponseSchema)
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const searchDatabaseChangeRequests = async (
  request: FastifyRequestTypebox<typeof searchChangeRequestsSchema>,
  reply: FastifyReplyTypebox<typeof searchChangeRequestsSchema>
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

  const database = await MetadataDatabaseService.getDbByOrgAndDbSlug({
    orgSlug: params.org_slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const permCheck =
    await ChangeRequestPermissionService.validateChangeRequestPermissions(
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

  const changeRequests =
    await ChangeRequestSearchService.searchDatabaseChangeRequests({
      orgSlug: params.org_slug,
      connectionId: database.connection_id,
      databaseName: database.raw_name,
      query: query.q || '',
      limit: query.limit ?? 100
    })

  return reply.status(200).send({
    type: 'search_change_requests',
    payload: { change_requests: changeRequests }
  })
}
export const executeChangeRequestSchema = {
  headers: AuthHeadersSchema,
  summary: 'Begin executing a Change Request',
  operationId: 'execute_change_request',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema
  }),
  response: {
    200: GeneralSuccessSchema,
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const executeChangeRequest = async (
  request: FastifyRequestTypebox<typeof executeChangeRequestSchema>,
  reply: FastifyReplyTypebox<typeof executeChangeRequestSchema>
) => {
  const params = request.params
  const userId = request.sort.user.id

  const org = await OrganizationService.getBySlug(params.org_slug, userId)

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await MetadataDatabaseService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const connection = await ConnectionService.getByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })

  if (!connection) {
    return reply.sendNotFound('database')
  }

  if (org.permissions?.is_owner.value !== true) {
    if (connection.visibility === 'public') {
      return reply.sendForbidden()
    } else {
      if (org.permissions?.is_member.value === true) {
        return reply.sendForbidden()
      } else {
        return reply.sendNotFound('database')
      }
    }
  }

  try {
    await ChangeRequestService.executeChangeRequest({
      connectionId: connection.id,
      databaseRawName: database.raw_name,
      changeRequestNumber: params.change_request_number,
      userId
    })

    return reply.status(200).send({
      type: 'success',
      payload: {
        success: {
          message: `Change request #${params.change_request_number} execution scheduled.`
        }
      }
    })
  } catch (error) {
    if (error instanceof NotApprovedError) {
      return reply.status(409).send({
        type: 'error',
        payload: {
          error: {
            message: 'Change request must be approved before execution.'
          }
        }
      })
    }

    if (error instanceof JobExistsError) {
      return reply.status(409).send({
        type: 'error',
        payload: {
          error: {
            message: 'The change request is already executing.'
          }
        }
      })
    }

    throw error
  }
}

export const CreateUndoChangeRequestSchema = {
  headers: AuthHeadersSchema,
  summary: 'Create an "Undo" Change Request',
  operationId: 'create_undo_change_request',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema
  }),
  response: {
    201: createMessageSchema(
      'create_undo_change_request',
      Type.Object({
        change_request: FullChangeRequestResponseSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const createUndoChangeRequest = async (
  request: FastifyRequestTypebox<typeof CreateUndoChangeRequestSchema>,
  reply: FastifyReplyTypebox<typeof CreateUndoChangeRequestSchema>
) => {
  const params = request.params
  const userId = request.sort.user.id

  const org = await OrganizationService.getBySlug(params.org_slug, userId)
  if (!org) {
    return reply.sendNotFound('organization')
  }

  const database = await MetadataDatabaseService.getDbByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })
  if (!database) {
    return reply.sendNotFound('database')
  }

  const permCheck =
    await ChangeRequestPermissionService.validateChangeRequestPermissions(
      database.connection_id,
      request.sort,
      org
    )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  const connection = await ConnectionService.getByOrgAndDbSlug({
    orgSlug: org.slug,
    dbSlug: params.db_slug
  })
  if (!connection) {
    return reply.sendNotFound('database')
  }

  const changeRequest = await ChangeRequestService.getFullChangeRequestResponse(
    {
      org_slug: org.slug,
      connection_id: database.connection_id,
      database_name: database.raw_name,
      change_request_number: params.change_request_number
    }
  )
  if (!changeRequest) {
    return reply.sendNotFound('change request')
  }

  if (changeRequest.status !== 'applied') {
    return reply.status(409).send({
      type: 'error',
      payload: {
        error: {
          message: 'Change request must be applied before undoing.'
        }
      }
    })
  }

  const undoChangeRequest = await ChangeRequestService.createUndoChangeRequest(
    changeRequest,
    userId
  )

  const username = request.sort.user.username
  const description = changeRequest.description || ''
  const mdMessage = `@${username} opened a change request\n---\n${description}`
  const htmlMessage = await mdToHtml(description)

  await sendChangeRequestNotification({
    org,
    database,
    changeRequest: undoChangeRequest,
    mdMessage,
    htmlMessage,
    logger: request.log,
    source: ChangeRequestNotificationSource.UNDO
  })

  return reply.status(201).send({
    type: 'create_undo_change_request',
    payload: { change_request: undoChangeRequest }
  })
}
