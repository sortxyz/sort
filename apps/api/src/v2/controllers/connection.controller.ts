import { Type } from '@sinclair/typebox'
import { PublicFacingError } from '@sort/shared/errors/public-facing.error'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  GeneralSuccessSchema,
  ValidationErrorSchema,
  createMessageSchema,
  UuidSchema,
  DiscriminatedUnion
} from '@sort/shared/schemas/api.schema'
import {
  ConnectionNameSchema,
  ConnectionSchema,
  ConnectionResponseSchema,
  ConnectionTestSchema,
  VisibilitySchema,
  WarehouseSchema
} from '@sort/shared/schemas/connection.schema'
import { ConnectionDataProviderSchema } from '@sort/shared/schemas/data-provider.schema'
import { OrganizationSlugSchema } from '@sort/shared/schemas/org.schema'
import * as ConnectionService from '@sort/shared/services/connection.service'
import { retrieveWorkingConnection } from '@sort/shared/services/customer-connection/index'
import * as OrganizationService from '@sort/shared/services/org.service'
import { createJob as createSchemaImportJob } from '@sort/shared/services/schema-import/job.service'
import { sendAnalyticsSlackNotification } from '@sort/shared/services/slack.service'
import * as SharedUtils from '@sort/shared/utils/index'

import { config } from '../../config/bootstrap'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { Static } from '@sinclair/typebox'
import type * as ConnectionType from '@sort/shared/types/kysely/connection/connection.type'
import type { Visibility } from '@sort/shared/types/kysely.type'
import type { FastifySchema } from 'fastify'

const { IS_PROD_ENV } = config

const validateSnowflakeWarehouse = (body: {
  type: string
  warehouse?: string
  parameters?: Record<string, unknown>
}) => {
  let errorPath = ''
  if (body.type === 'connection_string' && !body.warehouse) {
    errorPath = 'warehouse'
  } else if (body.type === 'parameters' && !body.parameters?.warehouse) {
    errorPath = 'parameters/warehouse'
  }

  if (errorPath) {
    return {
      type: 'validation_error',
      payload: {
        validation_error: {
          context: 'body',
          message: 'A validation error occurred when validating the body.',
          errors: {
            body: {
              [errorPath]: 'is required'
            }
          }
        }
      }
    } as const
  }
}

export const getOrganizationConnectionsSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get all database connections of an Organization',
  operationId: 'list_connections',
  tags: ['connection'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema
  }),
  response: {
    200: createMessageSchema(
      'list_connections',
      Type.Object({
        connections: Type.Array(ConnectionResponseSchema)
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getOrganizationConnections = async (
  request: FastifyRequestTypebox<typeof getOrganizationConnectionsSchema>,
  reply: FastifyReplyTypebox<typeof getOrganizationConnectionsSchema>
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

  const connections = await ConnectionService.getAll({ orgId: org.id })

  return reply.status(200).send({
    type: 'list_connections',
    payload: {
      connections: connections.map(SharedUtils.sanitizeConnectionForResponse)
    }
  })
}

export const getOrganizationConnectionSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get a database Connection',
  operationId: 'get_connection',
  tags: ['connection'],
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    connection_id: UuidSchema
  }),
  response: {
    200: createMessageSchema(
      'get_connection',
      Type.Object({
        connection: ConnectionResponseSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getOrganizationConnection = async (
  request: FastifyRequestTypebox<typeof getOrganizationConnectionSchema>,
  reply: FastifyReplyTypebox<typeof getOrganizationConnectionSchema>
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

  return reply.status(200).send({
    type: 'get_connection',
    payload: {
      connection: SharedUtils.sanitizeConnectionForResponse(connection)
    }
  })
}

const CreateParamsSchema = Type.Object({
  org_slug: OrganizationSlugSchema
})

const ConnectionTypeSchema = Type.Object({
  read_only: Type.Boolean({ default: false }),
  data_provider: ConnectionDataProviderSchema,
  parent_connection_id: Type.Optional(
    Type.String({
      format: 'uuid',
      description:
        'The `id` of an existing connection to the _same_ database. Required when `read_only` is true.'
    })
  ),
  name: Type.Optional(ConnectionNameSchema),
  visibility: Type.Optional(VisibilitySchema)
})

const ConnectionParametersBodySchema = Type.Composite([
  ConnectionTypeSchema,
  Type.Object({
    parameters: Type.Object({
      host: Type.String({ minLength: 1 }),
      port: Type.Number(),
      database: Type.String({ minLength: 1 }),
      user: Type.String({ minLength: 1 }),
      password: Type.String({ minLength: 1 }),
      warehouse: Type.Optional(WarehouseSchema)
    })
  })
])

const ConnectionStringBodySchema = Type.Composite([
  ConnectionTypeSchema,
  Type.Pick(ConnectionSchema, ['connection_string']),
  Type.Object({
    warehouse: Type.Optional(WarehouseSchema)
  })
])

const RequestCreateConnectionWithParametersSchema = Type.Composite(
  [
    Type.Object({ type: Type.Literal('parameters') }),
    ConnectionParametersBodySchema
  ],
  {
    $id: 'RequestCreateConnectionWithParametersSchema'
  }
)

const RequestCreateConnectionWithConnectionStringSchema = Type.Composite(
  [
    Type.Object({ type: Type.Literal('connection_string') }),
    ConnectionStringBodySchema
  ],
  {
    $id: 'RequestCreateConnectionWithConnectionStringSchema'
  }
)

const CreateBodySchema = DiscriminatedUnion('type', [
  Type.Ref<typeof RequestCreateConnectionWithParametersSchema>(
    RequestCreateConnectionWithParametersSchema
  ),
  Type.Ref<typeof RequestCreateConnectionWithConnectionStringSchema>(
    RequestCreateConnectionWithConnectionStringSchema
  )
])

type CreateBody = Static<typeof CreateBodySchema>

export const createConnectionSchema = {
  headers: AuthHeadersSchema,
  summary: 'Create a database Connection',
  operationId: 'create_connection',
  tags: ['connection'],
  params: CreateParamsSchema,
  body: CreateBodySchema,
  response: {
    201: createMessageSchema(
      'create_connection',
      Type.Object({
        connection: ConnectionResponseSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

const attemptCreateConnection = async ({
  body,
  orgId,
  createdByUserId,
  fallbackName,
  fallbackVisibility
}: {
  body: CreateBody
  orgId: string
  createdByUserId: string
  fallbackName?: string
  fallbackVisibility?: Visibility
}) =>
  await retrieveWorkingConnection({
    organization_id: orgId,
    name: body.name ?? fallbackName ?? `readonly-connection-for-${orgId}`,
    data_provider: body.data_provider,
    connection_string:
      body.type === 'connection_string'
        ? body.connection_string
        : SharedUtils.buildConnectionString({
            data_provider: body.data_provider,
            database: body.parameters.database,
            host: body.parameters.host,
            password: body.parameters.password,
            port: body.parameters.port,
            user: body.parameters.user
          }),
    created_at: new Date(),
    created_by: createdByUserId,
    with_ssl: true,
    visibility: body.visibility ?? fallbackVisibility ?? 'private',
    warehouse:
      body.type === 'connection_string' && body.data_provider === 'snowflake'
        ? body.warehouse
        : body.type === 'parameters'
          ? body.parameters.warehouse
          : undefined
  } satisfies ConnectionType.ConnectionInsert)

export const create = async (
  request: FastifyRequestTypebox<typeof createConnectionSchema>,
  reply: FastifyReplyTypebox<typeof createConnectionSchema>
) => {
  const params = request.params
  const body = request.body

  const isOwner = await OrganizationService.isOwnerBySlug({
    userId: request.sort.user.id,
    slug: params.org_slug
  })

  request.log.info({ isOwner })

  if (!isOwner) {
    return reply.sendNotFound('organization')
  }

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  // if we're creating a read-only connection, we need to make sure there's a parent connection id
  let parentConnection:
    | ConnectionType.ConnectionSelectWithEncryption
    | undefined

  if (body.read_only) {
    if (!body.parent_connection_id) {
      return reply.status(400).send({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'Missing parent connection id.',
            context: 'body',
            errors: {
              body: {
                parent_connection_id: 'must be a valid connection id'
              }
            }
          }
        }
      })
    }

    parentConnection = await ConnectionService.getById(
      body.parent_connection_id
    )
    if (!parentConnection) {
      return reply.status(400).send({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'Invalid parent connection id.',
            context: 'body',
            errors: {
              body: {
                parent_connection_id: 'must be a valid connection id'
              }
            }
          }
        }
      })
    }
  }

  // if we're creating a normal connection, we need the name and visibility fields
  if (!body.read_only && (!body.name || !body.visibility)) {
    if (!body.name) {
      return reply.status(400).send({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'Missing name.',
            context: 'body',
            errors: {
              body: {
                name: 'must be a valid connection name'
              }
            }
          }
        }
      })
    }

    if (!body.visibility) {
      return reply.status(400).send({
        type: 'validation_error',
        payload: {
          validation_error: {
            message: 'Missing visibility.',
            context: 'body',
            errors: {
              body: {
                visibility: 'must be a valid connection visibility'
              }
            }
          }
        }
      })
    }
  }

  if (body.data_provider === 'snowflake') {
    const invalidWarehouse = validateSnowflakeWarehouse(body)
    if (invalidWarehouse) {
      return reply.status(400).send(invalidWarehouse)
    }
  }

  let connection: Awaited<ReturnType<typeof attemptCreateConnection>>
  try {
    connection = await attemptCreateConnection({
      body,
      orgId: org.id,
      createdByUserId: request.sort.user.id,
      fallbackName: `${parentConnection?.name}-readonly`,
      fallbackVisibility: 'private'
    })
  } catch (err) {
    return reply.status(400).send({
      type: 'validation_error',
      payload: {
        validation_error: {
          message:
            err instanceof PublicFacingError
              ? err.message
              : `Connection "${body.name}" failed to connect.`,
          context: 'body',
          errors: {
            body: {
              connection_string: 'must be a valid, working connection string'
            }
          }
        }
      }
    })
  }

  const createdConnection = await ConnectionService.create({
    ...connection,
    connection_string: SharedUtils.EncryptedField.fromDecryptedValue(
      connection.connection_string
    )
  })

  if (!createdConnection) {
    throw new Error('Failed to create a connection.')
  }

  if (body.read_only && parentConnection) {
    // update the parent connection with the read-only connection id
    await ConnectionService.updateById(parentConnection.id, {
      readonly_connection_id: createdConnection?.id
    })
  }

  // we don't import the schema for the read-only connection
  if (!body.read_only) {
    await createSchemaImportJob({
      connection_id: createdConnection.id,
      user_id: request.sort.user.id
    })
  }

  if (IS_PROD_ENV) {
    void sendAnalyticsSlackNotification({
      message: `Connection successfully added by ${request.sort.user.email ?? request.sort.user.username} for connection ${createdConnection.name}`,
      logger: request.log,
      initiatingUserEmail: request.sort.user?.email
    })
  }

  return reply.status(201).send({
    type: 'create_connection',
    payload: {
      connection: SharedUtils.sanitizeConnectionForResponse(createdConnection)
    }
  })
}

const OrganizationConnectionParamsSchema = Type.Object({
  org_slug: OrganizationSlugSchema,
  connection_id: UuidSchema
})

const UpdateBodySchema = DiscriminatedUnion('type', [
  Type.Composite(
    [
      Type.Object({ type: Type.Literal('parameters') }),
      Type.Partial(ConnectionParametersBodySchema, {
        minProperties: 1,
        additionalProperties: false
      })
    ],
    { additionalProperties: false }
  ),
  Type.Composite(
    [
      Type.Object({ type: Type.Literal('connection_string') }),
      Type.Partial(ConnectionStringBodySchema, {
        minProperties: 1,
        additionalProperties: false
      })
    ],
    { additionalProperties: false }
  )
])

export const updateConnectionSchema = {
  headers: AuthHeadersSchema,
  body: UpdateBodySchema,
  params: OrganizationConnectionParamsSchema,
  summary: 'Update a database Connection',
  operationId: 'update_connection',
  tags: ['connection'],
  response: {
    200: createMessageSchema(
      'update_connection',
      Type.Object({
        connection: ConnectionResponseSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const update = async (
  request: FastifyRequestTypebox<typeof updateConnectionSchema>,
  reply: FastifyReplyTypebox<typeof updateConnectionSchema>
) => {
  const params = request.params
  const body = request.body

  const isOwner = await OrganizationService.isOwnerBySlug({
    userId: request.sort.user.id,
    slug: params.org_slug
  })

  request.log.info({ isOwner })

  if (!isOwner) {
    return reply.sendNotFound('organization')
  }

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const conn = await ConnectionService.getById(params.connection_id)
  if (!conn || conn.organization_id !== org.id) {
    return reply.sendNotFound('connection')
  }

  const submittedConnectionString =
    body.type === 'connection_string' && body.connection_string
      ? body.connection_string
      : body.type === 'parameters' && body.parameters
        ? SharedUtils.buildConnectionString({
            data_provider: conn.data_provider,
            database: body.parameters.database,
            host: body.parameters.host,
            password: body.parameters.password,
            port: body.parameters.port,
            user: body.parameters.user
          })
        : undefined

  if (submittedConnectionString) {
    try {
      const dataProvider = body.data_provider ?? conn.data_provider
      if (dataProvider === 'snowflake') {
        const invalidWarehouse = validateSnowflakeWarehouse(body)
        if (invalidWarehouse) {
          return reply.status(400).send(invalidWarehouse)
        }
      }

      const warehouse =
        dataProvider === 'postgres'
          ? null
          : (body.type === 'connection_string' && body.warehouse) ||
            (body.type === 'parameters' && body.parameters?.warehouse) ||
            conn.warehouse

      await retrieveWorkingConnection({
        ...conn,
        name: body.name ?? conn.name,
        connection_string: submittedConnectionString,
        data_provider: dataProvider,
        warehouse
      })
    } catch (err) {
      return reply.status(400).send({
        type: 'validation_error',
        payload: {
          validation_error: {
            message:
              err instanceof PublicFacingError
                ? err.message
                : 'Connection failed.',
            context: 'body',
            errors: {
              body: {
                connection_string: 'must be a valid, working connection string'
              }
            }
          }
        }
      })
    }
  }

  const updates: Record<string, unknown> = {}
  if (body.name) updates.name = body.name
  if (body.data_provider) updates.data_provider = body.data_provider
  if (body.visibility) updates.visibility = body.visibility
  if (submittedConnectionString) {
    updates.connection_string = SharedUtils.EncryptedField.fromDecryptedValue(
      submittedConnectionString
    )
  }
  if (body.type === 'connection_string' && body.warehouse) {
    updates.warehouse = body.warehouse
  } else if (body.type === 'parameters' && body.parameters?.warehouse) {
    updates.warehouse = body.parameters.warehouse
  }

  const found = await ConnectionService.updateById(
    params.connection_id,
    updates
  )

  if (!found) {
    return reply.sendNotFound('connection')
  }

  await createSchemaImportJob({
    connection_id: found.id,
    user_id: request.sort.user.id
  })

  return reply.status(200).send({
    type: 'update_connection',
    payload: {
      connection: SharedUtils.sanitizeConnectionForResponse(found)
    }
  })
}

export const deleteConnectionSchema = {
  headers: AuthHeadersSchema,
  params: OrganizationConnectionParamsSchema,
  summary: 'Delete a database Connection',
  operationId: 'delete_connection',
  tags: ['connection'],
  response: {
    200: GeneralSuccessSchema,
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const deleteConnection = async (
  request: FastifyRequestTypebox<typeof deleteConnectionSchema>,
  reply: FastifyReplyTypebox<typeof deleteConnectionSchema>
) => {
  const params = request.params

  const isOwner = await OrganizationService.isOwnerBySlug({
    userId: request.sort.user.id,
    slug: params.org_slug
  })

  request.log.info({ isOwner })

  if (!isOwner) {
    return reply.sendNotFound('connection')
  }

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.user.id
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const conn = await ConnectionService.getById(params.connection_id)

  if (!conn || conn.organization_id !== org.id) {
    return reply.sendNotFound('connection')
  }

  await ConnectionService.removeConnection(params.connection_id)

  return reply.send({
    type: 'success',
    payload: {
      success: {
        message: `Connection ${params.connection_id} deleted successfully.`
      }
    }
  })
}

const OrganizationTestConnectionParamsSchema = Type.Object({
  org_slug: OrganizationSlugSchema
})

const OrganizationTestConnectionBodySchema = DiscriminatedUnion('type', [
  Type.Object({
    type: Type.Literal('persisted'),
    id: UuidSchema
  }),
  Type.Composite([
    Type.Object({ type: Type.Literal('connection_string') }),
    Type.Pick(ConnectionSchema, ['connection_string', 'data_provider']),
    Type.Partial(Type.Pick(ConnectionSchema, ['warehouse']))
  ]),
  Type.Object({
    type: Type.Literal('parameters'),
    parameters: Type.Object({
      host: Type.String({ minLength: 1 }),
      port: Type.Number(),
      database: Type.String({ minLength: 1 }),
      user: Type.String({ minLength: 1 }),
      password: Type.String({ minLength: 1 }),
      warehouse: Type.Optional(Type.String())
    }),
    data_provider: ConnectionDataProviderSchema
  })
])

export const testConnectionSchema = {
  headers: AuthHeadersSchema,
  summary: 'Test a database Connection',
  operationId: 'test_connection',
  tags: ['connection'],
  params: OrganizationTestConnectionParamsSchema,
  body: OrganizationTestConnectionBodySchema,
  response: {
    200: createMessageSchema(
      'test_connection',
      Type.Object({
        connection_test: ConnectionTestSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const test = async (
  request: FastifyRequestTypebox<typeof testConnectionSchema>,
  reply: FastifyReplyTypebox<typeof testConnectionSchema>
) => {
  const params = request.params
  const body = request.body

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

  let connection: ConnectionType.ConnectionInsert | undefined

  switch (body.type) {
    case 'persisted': {
      const conn = await ConnectionService.getById(body.id)
      if (!conn) {
        return reply.sendNotFound('connection')
      }

      if (conn.organization_id !== org.id) {
        return reply.sendNotFound('connection')
      }

      connection = {
        ...conn,
        connection_string: await conn.connection_string.decrypt()
      } satisfies ConnectionType.ConnectionInsert

      break
    }
    case 'connection_string': {
      connection = {
        organization_id: org.id,
        name: 'ephemeral',
        data_provider: body.data_provider,
        connection_string: body.connection_string,
        created_at: new Date(),
        created_by: request.sort.user.id,
        with_ssl: false,
        visibility: 'private',
        warehouse: body.warehouse
      } satisfies ConnectionType.ConnectionInsert
      break
    }
    case 'parameters': {
      connection = {
        organization_id: org.id,
        name: 'ephemeral',
        data_provider: body.data_provider,
        connection_string: SharedUtils.buildConnectionString({
          data_provider: body.data_provider,
          database: body.parameters.database,
          host: body.parameters.host,
          password: body.parameters.password,
          port: body.parameters.port,
          user: body.parameters.user
        }),
        created_at: new Date(),
        created_by: request.sort.user.id,
        with_ssl: false,
        visibility: 'private',
        warehouse: body.parameters.warehouse
      } satisfies ConnectionType.ConnectionInsert

      break
    }
  }

  if (connection.data_provider === 'snowflake' && !connection.warehouse) {
    return reply.status(400).send({
      type: 'validation_error',
      payload: {
        validation_error: {
          context: 'body',
          message: 'A validation error occurred when validating the body.',
          errors: {
            body: {
              warehouse: 'is required'
            }
          }
        }
      }
    })
  }

  const connectionTimeout = new Promise<boolean>((_, reject) =>
    setTimeout(() => {
      reject(
        new PublicFacingError(`Connection "${connection.name}" timed out.`)
      )
    }, config.USER_FACING_EXTERNAL_DB_CONNECTION_TIMEOUT_MS)
  )
  const connectionPromise = retrieveWorkingConnection(connection)

  try {
    await Promise.race([connectionPromise, connectionTimeout])
  } catch (err) {
    return reply.status(200).send({
      type: 'test_connection',
      payload: {
        connection_test: {
          success: false,
          message:
            err instanceof PublicFacingError
              ? err.message
              : `Connection "${connection.name}" failed to connect.`
        }
      }
    })
  }

  return reply.status(200).send({
    type: 'test_connection',
    payload: {
      connection_test: {
        success: true,
        message: `Connection "${connection.name}" connected successfully.`
      }
    }
  })
}

export const schemas = [
  RequestCreateConnectionWithConnectionStringSchema,
  RequestCreateConnectionWithParametersSchema
]
