import { Type } from '@sinclair/typebox'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  GeneralSuccessSchema,
  ValidationErrorSchema,
  createMessageSchema
} from '@sort/shared/schemas/api.schema'
import { ChangeRequestNumberSchema } from '@sort/shared/schemas/change-request.schema'
import { IssueNumberSchema } from '@sort/shared/schemas/issue.schema'
import { DatabaseSlugSchema } from '@sort/shared/schemas/metadata.schema'
import { OrganizationSlugSchema } from '@sort/shared/schemas/org.schema'
import { ResponseRelationSchema } from '@sort/shared/schemas/relations.schema'
import * as ChangeRequestService from '@sort/shared/services/change-requests/change-request.service'
import * as RelationsService from '@sort/shared/services/change-requests/relations.service'
import { validateIssuePermissions as validatePermissions } from '@sort/shared/services/issue.permissions.service'
import * as IssueService from '@sort/shared/services/issue.service'
import * as DatabaseMetadataService from '@sort/shared/services/kysely/metadata/database.service'
import * as OrganizationService from '@sort/shared/services/org.service'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { FastifySchema } from 'fastify'

export const schemas = [ResponseRelationSchema]

export const getRelationsByIssueSchema = {
  headers: AuthHeadersSchema,
  summary: 'Gets all Relations for an Issue',
  operationId: 'list_issue_relations',
  tags: ['relation', 'issue'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    issue_number: IssueNumberSchema
  }),
  response: {
    200: createMessageSchema(
      'list_issue_relations',
      Type.Object({
        relations: Type.Array(
          Type.Ref<typeof ResponseRelationSchema>(ResponseRelationSchema)
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

export const getRelationsByChangeRequestSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get all Relations for a Change Request',
  operationId: 'list_change_request_relations',
  tags: ['relation', 'change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema
  }),
  response: {
    200: createMessageSchema(
      'list_change_request_relations',
      Type.Object({
        relations: Type.Array(
          Type.Ref<typeof ResponseRelationSchema>(ResponseRelationSchema)
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

export const getRelationsByIssue = async (
  request: FastifyRequestTypebox<typeof getRelationsByIssueSchema>,
  reply: FastifyReplyTypebox<typeof getRelationsByIssueSchema>
) => {
  return await getRelations(request, reply, 'issue')
}

export const getRelationsByChangeRequest = async (
  request: FastifyRequestTypebox<typeof getRelationsByChangeRequestSchema>,
  reply: FastifyReplyTypebox<typeof getRelationsByChangeRequestSchema>
) => {
  return await getRelations(request, reply, 'change_request')
}

const getRelations = async (
  request:
    | FastifyRequestTypebox<typeof getRelationsByIssueSchema>
    | FastifyRequestTypebox<typeof getRelationsByChangeRequestSchema>,
  reply:
    | FastifyReplyTypebox<typeof getRelationsByIssueSchema>
    | FastifyReplyTypebox<typeof getRelationsByChangeRequestSchema>,
  type: 'issue' | 'change_request'
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

  if (type === 'change_request' && 'change_request_number' in params) {
    const changeRequest =
      await ChangeRequestService.getFullChangeRequestResponse({
        org_slug: org.slug,
        connection_id: database.connection_id,
        database_name: database.raw_name,
        change_request_number: params.change_request_number
      })

    if (!changeRequest) {
      return reply.sendNotFound('change request')
    }

    const relations = await RelationsService.getRelations({
      changeRequestId: changeRequest.id
    })

    return (
      reply as FastifyReplyTypebox<typeof getRelationsByChangeRequestSchema>
    )
      .status(200)
      .send({
        type: 'list_change_request_relations',
        payload: {
          relations: relations.map(relation => ({
            ...relation,
            org_slug: org.slug,
            db_slug: database.slug
          }))
        }
      })
  }

  if (type === 'issue' && 'issue_number' in params) {
    const issue = await IssueService.getIssue({
      org_slug: org.slug,
      connection_id: database.connection_id,
      database_name: database.raw_name,
      issue_number: params.issue_number
    })

    if (!issue) {
      return reply.sendNotFound('issue')
    }

    const relations = await RelationsService.getRelations({
      issueId: issue.id
    })

    return (reply as FastifyReplyTypebox<typeof getRelationsByIssueSchema>)
      .status(200)
      .send({
        type: 'list_issue_relations',
        payload: {
          relations: relations.map(relation => ({
            ...relation,
            org_slug: org.slug,
            db_slug: database.slug
          }))
        }
      })
  }

  const body: {
    change_request_id?: string
    issue_id?: string
  } = {}

  if (type === 'change_request') {
    body.change_request_id = 'change_request_id is required'
  } else {
    body.issue_id = 'issue_id is required'
  }

  return reply.status(400).send({
    type: 'validation_error',
    payload: {
      validation_error: {
        context: 'body',
        message: body.change_request_id || body.issue_id || 'Error',
        errors: {
          body
        }
      }
    }
  })
}

export const createRelationSchema = {
  headers: AuthHeadersSchema,
  summary: 'Create a Relation',
  operationId: 'create_relation',
  tags: ['relation', 'issue', 'change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema
  }),
  body: Type.Object(
    {
      issue_number: Type.Number({
        description: 'The number of the Issue to relate to the Change Request'
      })
    },
    { description: 'The create Relation post body' }
  ),
  response: {
    201: createMessageSchema(
      'create_relation',
      Type.Object({
        relation: Type.Ref<typeof ResponseRelationSchema>(
          ResponseRelationSchema
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

export const createRelation = async (
  request: FastifyRequestTypebox<typeof createRelationSchema>,
  reply: FastifyReplyTypebox<typeof createRelationSchema>
) => {
  const body = request.body
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

  const issue = await IssueService.getIssue({
    org_slug: org.slug,
    connection_id: database.connection_id,
    database_name: database.raw_name,
    issue_number: body.issue_number
  })

  if (!issue) {
    return reply.sendNotFound('issue')
  }

  const permCheck = await validatePermissions(
    database.connection_id,
    request.sort,
    org,
    {
      isAuthor:
        request.sort.user.id === changeRequest.created_by ||
        request.sort.user.id === issue.created_by,
      pub: { needsAuthorOrOrgMember: true }
    }
  )

  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  await RelationsService.createRelation(changeRequest.id, issue.id)

  const relation = {
    issue_number: issue.issue_number,
    change_request_number: changeRequest.change_request_number,
    issue_title: issue.title,
    change_request_title: changeRequest.title
  }

  return reply.status(201).send({
    type: 'create_relation',
    payload: {
      relation: { ...relation, org_slug: org.slug, db_slug: database.slug }
    }
  })
}

export const deleteRelationSchema = {
  headers: AuthHeadersSchema,
  summary: 'Delete a Relation',
  operationId: 'delete_relation',
  tags: ['relation', 'issue', 'change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema
  }),
  body: Type.Object(
    {
      issue_number: IssueNumberSchema
    },
    { description: 'The delete Relation post body' }
  ),
  response: {
    200: GeneralSuccessSchema,
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const deleteRelation = async (
  request: FastifyRequestTypebox<typeof deleteRelationSchema>,
  reply: FastifyReplyTypebox<typeof deleteRelationSchema>
) => {
  const body = request.body
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

  const issue = await IssueService.getIssue({
    org_slug: org.slug,
    connection_id: database.connection_id,
    database_name: database.raw_name,
    issue_number: body.issue_number
  })

  if (!issue) {
    return reply.sendNotFound('issue')
  }

  const permCheck = await validatePermissions(
    database.connection_id,
    request.sort,
    org,
    {
      isAuthor: request.sort.user.id === issue.created_by,
      pub: { needsAuthorOrOrgMember: true }
    }
  )
  if (permCheck === 404) {
    return reply.sendNotFound('database')
  } else if (permCheck === 403) {
    return reply.sendForbidden()
  }

  await RelationsService.deleteRelation(changeRequest.id, issue.id)

  return reply.send({
    type: 'success',
    payload: {
      success: {
        message: `Relation between issue ${body.issue_number} and change request ${params.change_request_number} deleted successfully.`
      }
    }
  })
}
