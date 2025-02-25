import { Type } from '@sinclair/typebox'
import * as Errors from '@sort/shared/errors/index'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  GeneralSuccessSchema,
  ValidationErrorSchema,
  createMessageSchema
} from '@sort/shared/schemas/api.schema'
import { ProfileSchema } from '@sort/shared/schemas/user.schema'
import { sendVerificationEmail } from '@sort/shared/services/notification.service'
import * as UserService from '@sort/shared/services/user.service'
import { TNullable } from '@sort/shared/types/nullable.type'

import { EmailVerificationJwt } from '../utils/jwt.util'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { FastifySchema } from 'fastify'

export const schemas = [ProfileSchema]

export const GetUserProfileSchema = {
  headers: AuthHeadersSchema,
  operationId: 'get_my_profile',
  tags: ['profile'],
  summary: 'Get your Sort Profile',
  response: {
    200: createMessageSchema(
      'get_my_profile',
      Type.Object({
        profile: Type.Ref<typeof ProfileSchema>(ProfileSchema)
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getUserProfile = async (
  request: FastifyRequestTypebox<typeof GetUserProfileSchema>,
  reply: FastifyReplyTypebox<typeof GetUserProfileSchema>
) => {
  const userId = request.sort.user.id

  const user = await UserService.getUserById(userId)
  if (!user) {
    return reply.sendNotFound('user')
  }

  return reply.status(200).send({
    type: 'get_my_profile',
    payload: {
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        email_verified: user.email_verified,
        picture: user.picture,
        username: user.username
      }
    }
  })
}

const UpdateBodySchema = Type.Partial(
  Type.Pick(ProfileSchema, ['name', 'picture', 'username', 'email']),
  {
    minProperties: 1,
    additionalProperties: false
  }
)

export const UpdateUserProfileSchema = {
  headers: AuthHeadersSchema,
  body: UpdateBodySchema,
  summary: 'Update your Sort Profile',
  operationId: 'update_my_profile',
  tags: ['profile'],
  response: {
    200: createMessageSchema(
      'update_my_profile',
      Type.Object({
        profile: Type.Ref<typeof ProfileSchema>(ProfileSchema)
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const updateUserProfile = async (
  request: FastifyRequestTypebox<typeof UpdateUserProfileSchema>,
  reply: FastifyReplyTypebox<typeof UpdateUserProfileSchema>
) => {
  const userId = request.sort.user.id
  const body = request.body
  const emailChanged = body.email && body.email !== request.sort.user.email

  try {
    const update = emailChanged
      ? {
          ...body,
          email_verified: false
        }
      : body
    const user = await UserService.updateUserById(userId, update)
    if (!user) {
      return reply.sendNotFound('user')
    }

    if (body.email && emailChanged) {
      const key = EmailVerificationJwt.create({
        user: { id: userId, email: body.email }
      })
      void sendVerificationEmail({
        email: body.email,
        name: user.name,
        key,
        logger: request.log
      })
    }

    return reply.status(200).send({
      type: 'update_my_profile',
      payload: {
        profile: {
          id: user.id,
          name: user.name,
          email: user.email,
          email_verified: user.email_verified,
          picture: user.picture,
          username: user.username
        }
      }
    })
  } catch (error) {
    if (!(error instanceof Errors.DatabaseUniquenessError)) {
      throw error
    }

    return reply.status(409).send({
      type: 'error',
      payload: {
        error: { message: `That ${error.column} already exists.` }
      }
    })
  }
}

export const SendVerificationEmailSchema = {
  headers: AuthHeadersSchema,
  body: Type.Object({ email: TNullable(Type.String({ format: 'email' })) }),
  summary: 'Send verification email',
  operationId: 'send_verification_email',
  tags: ['profile'],
  response: {
    200: GeneralSuccessSchema,
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const sendVerificationEmailToUser = async (
  request: FastifyRequestTypebox<typeof SendVerificationEmailSchema>,
  reply: FastifyReplyTypebox<typeof SendVerificationEmailSchema>
) => {
  const userId = request.sort.user.id
  const user = await UserService.getUserById(userId)
  if (!user) {
    return reply.sendNotFound('user')
  }

  if (!user.email) {
    return reply.status(409).send({
      type: 'error',
      payload: {
        error: {
          message: 'User does not have an email address.'
        }
      }
    })
  }

  const key = EmailVerificationJwt.create({
    user: { id: userId, email: user.email }
  })
  await sendVerificationEmail({
    email: user.email,
    name: user.name,
    key,
    logger: request.log
  })

  return reply.status(200).send({
    type: 'success',
    payload: {
      success: {
        message: 'Verification email sent.'
      }
    }
  })
}

export const RemoveUserProfileSchema = {
  headers: AuthHeadersSchema,
  summary: 'Delete your Sort Profile',
  operationId: 'delete_my_profile',
  tags: ['profile'],
  response: {
    200: GeneralSuccessSchema,
    501: GeneralErrorSchema,
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const removeUserProfile = async (
  request: FastifyRequestTypebox<typeof RemoveUserProfileSchema>,
  reply: FastifyReplyTypebox<typeof RemoveUserProfileSchema>
) => {
  // TODO: Removing a user profile was never implemented properly and needs to be
  return reply.status(501).send({
    type: 'error',
    payload: {
      error: {
        message: 'Not implemented.'
      }
    }
  })
}
