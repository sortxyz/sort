import { Type } from '@sinclair/typebox'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  UuidSchema,
  ValidationErrorSchema,
  createMessageSchema
} from '@sort/shared/schemas/api.schema'
import { OrganizationSlugSchema } from '@sort/shared/schemas/org.schema'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import { createSchemaImporter } from '@sort/shared/utils/schema-import.util'

import {
  getDatabasesForOrganization,
  GetDatabasesForOrganizationSchema
} from '../services/snapshot.service'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { FastifySchema } from 'fastify'

const CreateParamsSchema = Type.Object({
  org_slug: OrganizationSlugSchema,
  connection_id: UuidSchema
})

export const createSchemaSnapshotSchema = {
  headers: AuthHeadersSchema,
  summary: "Import a snapshot of a Connection's schemas",
  operationId: 'create_schema_snapshot',
  tags: ['connection'],
  params: CreateParamsSchema,
  response: {
    200: createMessageSchema(
      'create_schema_snapshot',
      Type.Object({
        schema_snapshot_id: Type.String()
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const createSchemaSnapshot = async (
  request: FastifyRequestTypebox<typeof createSchemaSnapshotSchema>,
  reply: FastifyReplyTypebox<typeof createSchemaSnapshotSchema>
) => {
  const params = request.params

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  if (!org.permissions?.is_member.value) {
    return reply.sendNotFound('connection')
  }

  const connection = await ConnectionService.getById(params.connection_id)
  if (!connection) {
    return reply.sendNotFound('connection')
  }

  if (await ConnectionService.isReadOnlyConnection(params.connection_id)) {
    return reply.status(400).send({
      type: 'validation_error',
      payload: {
        validation_error: {
          message: 'Connection must not be readonly.',
          context: 'params',
          errors: {
            params: {
              connection_id: 'must not be a readonly connection'
            }
          }
        }
      }
    })
  }

  try {
    const schemaImporter = createSchemaImporter(connection)
    const snapshot = await schemaImporter.importSchema(
      request.sort.user.id,
      request.log
    )

    return reply.status(200).send({
      type: 'create_schema_snapshot',
      payload: {
        schema_snapshot_id: snapshot
      }
    })
  } catch (error) {
    const err = error as Error & { code: string; detail: string }

    if (
      err.code === '23503' &&
      /Key \(snapshot_id\)=\(.+\) is not present in table "snapshot"./.test(
        err.detail
      )
    ) {
      // org was probably deleted during import. confirm.
      const orgExists = await OrganizationService.getBySlug(
        params.org_slug,
        request.sort.user.id
      )

      if (!orgExists) {
        return reply.sendNotFound('organization')
      }
    }

    throw error
  }
}

const GetDatabasesResponseSchema = Type.Object({
  databases: GetDatabasesForOrganizationSchema
})

export const getOrganizationDatabasesSchema = {
  headers: AuthHeadersSchema,
  params: Type.Object({
    org_slug: OrganizationSlugSchema
  }),
  summary: 'Get the databases of a Sort Organization',
  operationId: 'list_databases',
  tags: ['organization', 'database'],
  response: {
    200: createMessageSchema('list_databases', GetDatabasesResponseSchema),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getOrganizationDatabases = async (
  request: FastifyRequestTypebox<typeof getOrganizationDatabasesSchema>,
  reply: FastifyReplyTypebox<typeof getOrganizationDatabasesSchema>
) => {
  const org = await OrganizationService.getBySlug(
    request.params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const isMember = org.permissions?.is_member.value === true
  const databases = await getDatabasesForOrganization(org.slug, { isMember })

  return reply.status(200).send({
    type: 'list_databases',
    payload: {
      databases
    }
  })
}
