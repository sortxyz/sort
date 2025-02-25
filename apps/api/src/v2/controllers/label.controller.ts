import { Type } from '@sinclair/typebox'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  ValidationErrorSchema,
  createMessageSchema,
  UuidSchema,
  GeneralSuccessSchema
} from '@sort/shared/schemas/api.schema'
import {
  LabelSchema,
  LabelIdSchema,
  LabelNameSchema,
  LabelColorSchema,
  LabelDescriptionSchema
} from '@sort/shared/schemas/label.schema'
import { DatabaseSlugSchema } from '@sort/shared/schemas/metadata.schema'
import { OrganizationSlugSchema } from '@sort/shared/schemas/org.schema'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as DatabaseMetadataService from '@sort/shared/services/kysely/metadata/database.service'
import * as LabelService from '@sort/shared/services/label.service'
import * as OrganizationService from '@sort/shared/services/org.service'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { FastifySchema } from 'fastify'

export const getLabelsByDatabaseSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get all Labels for the given database',
  operationId: 'list_database_labels',
  tags: ['label'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema
  }),
  response: {
    200: createMessageSchema(
      'list_database_labels',
      Type.Object({ labels: Type.Array(LabelSchema) })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getLabelsByDatabase = async (
  request: FastifyRequestTypebox<typeof getLabelsByDatabaseSchema>,
  reply: FastifyReplyTypebox<typeof getLabelsByDatabaseSchema>
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
    orgSlug: params.org_slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const connection = (await ConnectionService.getById(database.connection_id))!

  // labels can be retrieved in two contexts:
  // 1) the connection is public, then anyone can pull them
  // 2) the connection is private, then the user must be a member of the org
  if (
    connection.visibility === 'private' &&
    !org.permissions?.is_member.value
  ) {
    return reply.sendNotFound('database')
  }

  const labels = await LabelService.getLabelsByDatabase({
    connection_id: database.connection_id,
    database_name: database.raw_name
  })

  return reply
    .status(200)
    .send({ type: 'list_database_labels', payload: { labels } })
}

export const getLabelSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get Label',
  operationId: 'get_database_label',
  tags: ['label'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    label_id: UuidSchema
  }),
  response: {
    200: createMessageSchema(
      'get_database_label',
      Type.Object({ label: LabelSchema })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getLabel = async (
  request: FastifyRequestTypebox<typeof getLabelSchema>,
  reply: FastifyReplyTypebox<typeof getLabelSchema>
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
    orgSlug: params.org_slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const connection = (await ConnectionService.getById(database.connection_id))!

  // labels can be retrieved in two contexts:
  // 1) the connection is public, then anyone can pull them
  // 2) the connection is private, then the user must be a member of the org
  if (
    connection.visibility === 'private' &&
    !org.permissions?.is_member.value
  ) {
    return reply.sendNotFound('database')
  }

  const label = await LabelService.getLabel(params.label_id)
  if (!label) {
    return reply.sendNotFound('label')
  }

  return reply
    .status(200)
    .send({ type: 'get_database_label', payload: { label } })
}

const CreateLabelBodySchema = Type.Object({
  name: LabelNameSchema,
  color: LabelColorSchema,
  description: Type.Optional(LabelDescriptionSchema)
})

export const createLabelSchema = {
  headers: AuthHeadersSchema,
  body: CreateLabelBodySchema,
  summary: 'Create a Label for a database',
  operationId: 'create_database_label',
  tags: ['label'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema
  }),
  response: {
    201: createMessageSchema(
      'create_database_label',
      Type.Object({ label: LabelSchema })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const createDatabaseLabel = async (
  request: FastifyRequestTypebox<typeof createLabelSchema>,
  reply: FastifyReplyTypebox<typeof createLabelSchema>
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
    orgSlug: params.org_slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  if (!org.permissions?.is_member.value) {
    return reply.sendNotFound('database')
  }

  const label = await LabelService.createDatabaseLabel({
    name: body.name,
    description: body.description || null,
    color: body.color,
    connection_id: database.connection_id,
    database_name: database.raw_name
  })

  return reply
    .status(201)
    .send({ type: 'create_database_label', payload: { label } })
}

const UpdateLabelBodySchema = Type.Object({
  name: LabelNameSchema,
  color: LabelColorSchema,
  id: Type.Optional(LabelIdSchema),
  description: Type.Optional(LabelDescriptionSchema)
})

export const updateLabelSchema = {
  headers: AuthHeadersSchema,
  body: UpdateLabelBodySchema,
  summary: 'Update a database Label',
  operationId: 'update_database_label',
  tags: ['label'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    label_id: UuidSchema
  }),
  response: {
    200: createMessageSchema(
      'update_database_label',
      Type.Object({ label: LabelSchema })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const updateDatabaseLabel = async (
  request: FastifyRequestTypebox<typeof updateLabelSchema>,
  reply: FastifyReplyTypebox<typeof updateLabelSchema>
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
    orgSlug: params.org_slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  const label = await LabelService.getLabel(params.label_id)
  if (!label) {
    return reply.sendNotFound('label')
  }

  if (
    database.connection_id !== label.connection_id ||
    database.raw_name !== label.database_name
  ) {
    return reply.sendNotFound('label')
  }

  if (!org.permissions?.is_member.value) {
    return reply.sendNotFound('label')
  }

  const updatedLabel = await LabelService.updateDatabaseLabel({
    id: params.label_id,
    name: body.name,
    description: body.description || null,
    color: body.color
  })

  return reply
    .status(200)
    .send({ type: 'update_database_label', payload: { label: updatedLabel } })
}

export const deleteLabelSchema = {
  headers: AuthHeadersSchema,
  summary: 'Delete a database Label',
  operationId: 'delete_database_label',
  tags: ['label'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    db_slug: DatabaseSlugSchema,
    label_id: UuidSchema
  }),
  response: {
    200: GeneralSuccessSchema,
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const deleteDatabaseLabel = async (
  request: FastifyRequestTypebox<typeof deleteLabelSchema>,
  reply: FastifyReplyTypebox<typeof deleteLabelSchema>
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
    orgSlug: params.org_slug,
    dbSlug: params.db_slug
  })

  if (!database) {
    return reply.sendNotFound('database')
  }

  if (!org.permissions?.is_member.value) {
    return reply.sendNotFound('label')
  }

  const label = await LabelService.getLabel(params.label_id)
  if (!label) {
    return reply.sendNotFound('label')
  }

  if (
    database.connection_id !== label.connection_id ||
    database.raw_name !== label.database_name
  ) {
    return reply.sendNotFound('label')
  }

  await LabelService.deleteDatabaseLabel(params.label_id)

  return reply.send({
    type: 'success',
    payload: {
      success: {
        message: `Label ${params.label_id} deleted successfully.`
      }
    }
  })
}
