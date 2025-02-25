import { Type } from '@sinclair/typebox'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  GeneralSuccessSchema,
  ValidationErrorSchema,
  DateSchema,
  createMessageSchema
} from '@sort/shared/schemas/api.schema'
import * as APIKeyService from '@sort/shared/services/apikey.service'
import { TNullable } from '@sort/shared/types/nullable.type'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { FastifySchema } from 'fastify'

const ApiKeyIdSchema = Type.String({
  format: 'uuid',
  description: 'API key ID. UUID v4'
})
const ApiKeySummarySchema = Type.String({
  maxLength: 256,
  description: 'A summarization of how this API key is being used'
})

export const CreateAPIKeySchema = {
  headers: AuthHeadersSchema,
  summary: 'Create an API key',
  operationId: 'create_api_key',
  tags: ['api_key'],
  body: Type.Object({
    summary: Type.Optional(ApiKeySummarySchema)
  }),
  response: {
    201: createMessageSchema(
      'create_api_key',
      Type.Object({
        api_key: Type.Object({
          id: ApiKeyIdSchema,
          api_key: Type.String({ description: 'Your API key. Save this!' }),
          summary: TNullable(ApiKeySummarySchema),
          created_at: DateSchema,
          updated_at: DateSchema
        })
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const createAPIKey = async (
  request: FastifyRequestTypebox<typeof CreateAPIKeySchema>,
  reply: FastifyReplyTypebox<typeof CreateAPIKeySchema>
) => {
  const key = await APIKeyService.createAPIKey({
    userId: request.sort.user.id,
    summary: request.body.summary
  })

  return reply.status(201).send({
    type: 'create_api_key',
    payload: {
      api_key: key
    }
  })
}

export const DeleteAPIKeySchema = {
  headers: AuthHeadersSchema,
  summary: 'Delete an API key',
  operationId: 'delete_api_key',
  tags: ['api_key'],
  params: Type.Object({
    api_key_id: ApiKeyIdSchema
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

export const deleteAPIKey = async (
  request: FastifyRequestTypebox<typeof DeleteAPIKeySchema>,
  reply: FastifyReplyTypebox<typeof DeleteAPIKeySchema>
) => {
  await APIKeyService.deleteAPIKey({
    id: request.params.api_key_id,
    userId: request.sort.user.id
  })

  return reply.status(200).send({
    type: 'success',
    payload: {
      success: { message: 'API key deleted successfully' }
    }
  })
}

export const ListAPIKeysSchema = {
  headers: AuthHeadersSchema,
  summary: 'List your API keys',
  operationId: 'list_api_keys',
  tags: ['api_key'],
  response: {
    200: createMessageSchema(
      'list_api_keys',
      Type.Object({
        api_keys: Type.Array(
          Type.Object({
            id: ApiKeyIdSchema,
            summary: TNullable(ApiKeySummarySchema),
            created_at: DateSchema,
            updated_at: DateSchema
          })
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

export const listAPIKeys = async (
  request: FastifyRequestTypebox<typeof ListAPIKeysSchema>,
  reply: FastifyReplyTypebox<typeof ListAPIKeysSchema>
) => {
  const keys = await APIKeyService.listAPIKeys({
    userId: request.sort.user.id
  })

  return reply.status(200).send({
    type: 'list_api_keys',
    payload: {
      api_keys: keys
    }
  })
}

export const UpdateAPIKeySchema = {
  headers: AuthHeadersSchema,
  summary: 'Update an API key',
  operationId: 'update_api_key',
  tags: ['api_key'],
  params: Type.Object({
    api_key_id: ApiKeyIdSchema
  }),
  body: Type.Object({
    summary: TNullable(ApiKeySummarySchema)
  }),
  response: {
    200: createMessageSchema(
      'update_api_key',
      Type.Object({
        api_key: Type.Object({
          id: ApiKeyIdSchema,
          summary: TNullable(ApiKeySummarySchema),
          created_at: DateSchema,
          updated_at: DateSchema
        })
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const updateAPIKey = async (
  request: FastifyRequestTypebox<typeof UpdateAPIKeySchema>,
  reply: FastifyReplyTypebox<typeof UpdateAPIKeySchema>
) => {
  const key = await APIKeyService.updateAPIKey({
    id: request.params.api_key_id,
    userId: request.sort.user.id,
    summary: request.body.summary
  })

  return reply.status(200).send({
    type: 'update_api_key',
    payload: {
      api_key: key
    }
  })
}
