import { Type } from '@sinclair/typebox'
import {
  DuplicateColumnNameError,
  DuplicateUniqueIndexError
} from '@sort/shared/errors/change-requests/duplicates.error'
import {
  NonNullableColumnError,
  NonNullableNonGeneratedFieldError
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
import { PostgresFkViolationError } from '@sort/shared/errors/postgres-fk-violation.error'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  GeneralSuccessSchema,
  UuidSchema,
  ValidationErrorSchema,
  createMessageSchema
} from '@sort/shared/schemas/api.schema'
import { ChangeRequestNumberSchema } from '@sort/shared/schemas/change-request.schema'
import * as ChangeSchema from '@sort/shared/schemas/change.schema'
import {
  RequestUpdateChangeSchema,
  RequestChangeSchema
} from '@sort/shared/schemas/change.schema'
import { DatabaseSlugSchema } from '@sort/shared/schemas/metadata.schema'
import { OrganizationSlugSchema } from '@sort/shared/schemas/org.schema'
import * as ChangeRequestPermissionService from '@sort/shared/services/change-requests/change-request.permissions'
import * as ChangeRequestService from '@sort/shared/services/change-requests/change-request.service'
import * as ChangeService from '@sort/shared/services/changes/change.service'
import * as UpdateChangeService from '@sort/shared/services/changes/update-change.service'
import * as MetadataDatabaseService from '@sort/shared/services/kysely/metadata/database.service'
import * as OrganizationService from '@sort/shared/services/org.service'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type {
  RequestChange,
  RequestChangeFieldValue
} from '@sort/shared/schemas/change.schema'
import type { FastifySchema } from 'fastify'

export const schemas = [
  ChangeSchema.ResponseAddChangeSchema,
  ChangeSchema.ResponseModifyChangeSchema,
  ChangeSchema.ResponseDeleteChangeSchema,
  ChangeSchema.RequestAddChangeSchema,
  ChangeSchema.RequestModifyChangeSchema,
  ChangeSchema.RequestDeleteChangeSchema
]

const createValidationError = ({
  change,
  field,
  message,
  payloadIndex
}: {
  change: RequestChange
  field: RequestChangeFieldValue
  message: string
  payloadIndex?: number
}) => {
  const fieldIndex =
    change.action === 'DELETE' ? -1 : change.fields.findIndex(f => f === field)
  const prefix = typeof payloadIndex === 'number' ? `${payloadIndex}/` : ''
  const path =
    fieldIndex > -1 ? `${prefix}fields/${fieldIndex}/value` : 'fields'

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

export const getChangesSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get the Changes of a Change Request',
  operationId: 'list_changes',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema
  }),
  response: {
    200: createMessageSchema(
      'list_changes',
      Type.Object({
        changes: Type.Array(ChangeSchema.ChangeResponseSchema)
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getChanges = async (
  request: FastifyRequestTypebox<typeof getChangesSchema>,
  reply: FastifyReplyTypebox<typeof getChangesSchema>
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

  const changes = await ChangeService.getFullChangesResponse(changeRequest.id)

  return reply.send({
    type: 'list_changes',
    payload: { changes }
  })
}

export const updateChangeSchema = {
  headers: AuthHeadersSchema,
  body: RequestUpdateChangeSchema,
  summary: 'Update a Change',
  operationId: 'update_change',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema,
    change_id: UuidSchema
  }),
  response: {
    200: createMessageSchema(
      'update_change',
      Type.Object({
        change: ChangeSchema.ChangeResponseSchema
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

export const updateChange = async (
  request: FastifyRequestTypebox<typeof updateChangeSchema>,
  reply: FastifyReplyTypebox<typeof updateChangeSchema>
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
  } else if (
    changeRequest.status !== 'open' &&
    changeRequest.status !== 'approved'
  ) {
    return reply.status(409).send({
      type: 'error',
      payload: {
        error: {
          message:
            'Unable to modify a Change Request which is not currently open or approved.'
        }
      }
    })
  }

  const change = await ChangeService.getFullChange(params.change_id)
  if (!change) {
    return reply.sendNotFound('change')
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

  try {
    const updatedChange = await UpdateChangeService.updateChangeInChangeRequest(
      changeRequest,
      change,
      request.body,
      request.sort.user.id
    )

    return reply.status(200).send({
      type: 'update_change',
      payload: { change: updatedChange }
    })
  } catch (error) {
    const err = error as NodeJS.ErrnoException

    if (
      err instanceof DuplicateUniqueIndexError ||
      err instanceof DuplicateColumnNameError ||
      err instanceof NonNullableNonGeneratedFieldError ||
      err instanceof RowMissingError
    ) {
      return reply.status(409).send({
        type: 'error',
        payload: {
          error: {
            message: err.message
          }
        }
      })
    } else if (
      err instanceof PrimaryKeyMatchError ||
      err instanceof PrimaryKeyDoesNotExistError
    ) {
      return reply.status(422).send({
        type: 'error',
        payload: {
          error: {
            message: err.message
          }
        }
      })
    }

    throw err
  }
}

export const deleteChangeSchema = {
  headers: AuthHeadersSchema,
  summary: 'Deletes a Change',
  operationId: 'delete_change',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema,
    change_id: UuidSchema
  }),
  response: {
    200: GeneralSuccessSchema,
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    410: GeneralErrorSchema,
    422: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const deleteChange = async (
  request: FastifyRequestTypebox<typeof deleteChangeSchema>,
  reply: FastifyReplyTypebox<typeof deleteChangeSchema>
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
  } else if (
    changeRequest.status !== 'open' &&
    changeRequest.status !== 'approved'
  ) {
    return reply.status(409).send({
      type: 'error',
      payload: {
        error: {
          message:
            'Unable to modify a Change Request which is not currently open or approved.'
        }
      }
    })
  }

  const change = await ChangeService.getChange(params.change_id)
  if (!change) {
    return reply.sendNotFound('change')
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

  await UpdateChangeService.deleteChangeInChangeRequest(
    changeRequest,
    params.change_id,
    request.sort.user.id
  )

  return reply.status(200).send({
    type: 'success',
    payload: {
      success: { message: `Change ${params.change_id} deleted successfully.` }
    }
  })
}

export const CreateChangesSchema = {
  headers: AuthHeadersSchema,
  body: Type.Array(RequestChangeSchema),
  summary: 'Create Changes',
  operationId: 'create_changes',
  tags: ['change_request'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    change_request_number: ChangeRequestNumberSchema
  }),
  response: {
    201: createMessageSchema(
      'create_changes',
      Type.Object({
        changes: Type.Array(ChangeSchema.ChangeResponseSchema)
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

export const createChanges = async (
  request: FastifyRequestTypebox<typeof CreateChangesSchema>,
  reply: FastifyReplyTypebox<typeof CreateChangesSchema>
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
  } else if (
    changeRequest.status !== 'open' &&
    changeRequest.status !== 'approved'
  ) {
    return reply.status(409).send({
      type: 'error',
      payload: {
        error: {
          message:
            'Unable to modify a Change Request which is not currently open or approved.'
        }
      }
    })
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

  try {
    const createdChanges =
      await UpdateChangeService.createChangesInChangeRequest(
        changeRequest,
        request.body,
        request.sort.user.id
      )

    return reply.status(201).send({
      type: 'create_changes',
      payload: { changes: createdChanges }
    })
  } catch (err) {
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
      err instanceof DuplicateUniqueIndexError ||
      err instanceof InvalidColumnTypeError ||
      err instanceof UnknownColumnTypeError ||
      err instanceof PrimaryKeyMatchError ||
      err instanceof PrimaryKeyDoesNotExistError ||
      err instanceof DuplicateColumnNameError ||
      err instanceof NonNullableNonGeneratedFieldError ||
      err instanceof RowMissingError
    ) {
      return reply.status(409).send({
        type: 'error',
        payload: {
          error: {
            message: err.message
          }
        }
      })
    }

    if (
      err instanceof NonNullableColumnError ||
      err instanceof InvalidValueError
    ) {
      const validationError = createValidationError({
        message: err.message,
        change: err.cause.change,
        field: err.cause.field,
        payloadIndex: err.cause.payloadIndex
      })
      return reply.status(400).send(validationError)
    }

    throw err
  }
}
