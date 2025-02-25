import { randomUUID } from 'node:crypto'

import { Type } from '@sinclair/typebox'
import * as Errors from '@sort/shared/errors/index'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  ValidationErrorSchema,
  createMessageSchema,
  EmailSchema,
  UuidSchema,
  GeneralSuccessSchema
} from '@sort/shared/schemas/api.schema'
import {
  OrganizationInviteSchema,
  OrganizationInviteNameSchema,
  OrganizationInviteStatusSchema
} from '@sort/shared/schemas/org-invite.schema'
import {
  OrganizationSchema,
  OrganizationSlugSchema
} from '@sort/shared/schemas/org.schema'
import * as NotificationService from '@sort/shared/services/notification.service'
import * as OrganizationInviteService from '@sort/shared/services/org-invite.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import { sendAnalyticsSlackNotification } from '@sort/shared/services/slack.service'

import { config } from '../../config/bootstrap'
import * as RoleService from '../services/role.service'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { FastifySchema } from 'fastify'

const { IS_PROD_ENV } = config

export const createSchema = {
  headers: AuthHeadersSchema,
  body: Type.Object({
    email: EmailSchema,
    name: OrganizationInviteNameSchema,
    role_id: Type.Integer()
  }),
  params: Type.Object({
    org_slug: OrganizationSlugSchema
  }),
  summary: 'Create a Sort Organization Invite',
  operationId: 'create_organization_invite',
  tags: ['invite'],
  response: {
    201: createMessageSchema(
      'create_organization_invite',
      Type.Object({
        organization_invite: OrganizationInviteSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export async function create(
  request: FastifyRequestTypebox<typeof createSchema>,
  reply: FastifyReplyTypebox<typeof createSchema>
) {
  const organization = await OrganizationService.getBySlug(
    request.params.org_slug,
    request.sort.user.id
  )

  if (!organization) {
    return reply.sendNotFound('organization')
  }

  const role = await RoleService.getById(request.body.role_id)

  if (!role) {
    return reply.status(400).send({
      type: 'validation_error',
      payload: {
        validation_error: {
          message: 'Role does not exist.',
          context: 'body',
          errors: {
            body: {
              role_id: 'Role does not exist.'
            }
          }
        }
      }
    })
  }

  const isOwner = await OrganizationService.isOwnerBySlug({
    userId: request.sort.user.id,
    slug: organization.slug
  })

  if (!isOwner) {
    return reply.status(403).send({
      type: 'error',
      payload: {
        error: {
          message: 'Only organization owners can invite new members.'
        }
      }
    })
  }

  if (request.body.email === request.sort.user.email) {
    return reply.status(400).send({
      type: 'validation_error',
      payload: {
        validation_error: {
          message: 'Cannot invite yourself.',
          context: 'body',
          errors: {
            body: { email: 'Cannot invite yourself.' }
          }
        }
      }
    })
  }

  try {
    const user = request.sort.user

    const organizationInvite = await OrganizationInviteService.create({
      created_at: new Date(),
      created_by: user.id,
      id: randomUUID(),
      email: request.body.email,
      name: request.body.name,
      role_id: role.id,
      organization_id: organization.id,
      status: 'pending'
    })

    try {
      await NotificationService.sendOrgInviteEmail({
        fromName: user.name ?? user.username,
        fromEmail: user.email ?? user.username,
        toName: request.body.name,
        toEmail: request.body.email,
        org: organization,
        inviteId: organizationInvite.id,
        logger: request.log
      })
    } catch (error) {
      await OrganizationInviteService.removeById(organizationInvite.id)
      const err = new Error('Mailgun error', { cause: error })
      throw err
    }

    if (IS_PROD_ENV) {
      void sendAnalyticsSlackNotification({
        message: `New organization invite created: ${organizationInvite.email} by ${request.sort.user.email} for ${request.body.email}`,
        logger: request.log,
        initiatingUserEmail: request.sort.user?.email
      })
    }

    return reply.status(201).send({
      type: 'create_organization_invite',
      payload: { organization_invite: organizationInvite }
    })
  } catch (error) {
    if (!(error instanceof Errors.DatabaseUniquenessError)) {
      throw error
    }

    if (
      error.column !== 'email, organization_id' ||
      error.table !== 'organization_invite'
    ) {
      throw error
    }

    return reply.status(409).send({
      type: 'error',
      payload: {
        error: { message: 'Organization invite already exists.' }
      }
    })
  }
}

export const indexSchema = {
  headers: AuthHeadersSchema,
  params: Type.Object({
    org_slug: OrganizationSlugSchema
  }),
  summary: 'Get all member invites for a Sort Organization',
  operationId: 'list_organization_invites',
  tags: ['invite'],
  response: {
    200: createMessageSchema(
      'list_organization_invites',
      Type.Object({
        organization_invites: Type.Array(OrganizationInviteSchema)
      })
    ),
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export async function index(
  request: FastifyRequestTypebox<typeof indexSchema>,
  reply: FastifyReplyTypebox<typeof indexSchema>
) {
  const organization = await OrganizationService.getBySlug(
    request.params.org_slug,
    request.sort.user.id
  )

  if (!organization) {
    return reply.sendNotFound('organization')
  }

  const isOwner = await OrganizationService.isOwnerBySlug({
    userId: request.sort.user.id,
    slug: organization.slug
  })

  if (!isOwner) {
    return reply.status(403).send({
      type: 'error',
      payload: {
        error: {
          message: 'Only organization owners can view invites.'
        }
      }
    })
  }

  const organizationInvites =
    await OrganizationInviteService.getAllByOrganizationId(organization.id)

  return reply.send({
    type: 'list_organization_invites',
    payload: { organization_invites: organizationInvites }
  })
}

export const showSchema = {
  headers: AuthHeadersSchema,
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    invite_id: UuidSchema
  }),
  querystring: Type.Object({
    email: EmailSchema
  }),
  summary: 'Get a Sort Organization Invite',
  operationId: 'get_organization_invite',
  tags: ['invite'],
  response: {
    200: createMessageSchema(
      'get_organization_invite',
      Type.Object({
        organization: OrganizationSchema,
        organization_invite: OrganizationInviteSchema
      })
    ),
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export async function show(
  request: FastifyRequestTypebox<typeof showSchema>,
  reply: FastifyReplyTypebox<typeof showSchema>
) {
  const organizationInvite = await OrganizationInviteService.getById(
    request.params.invite_id,
    request.params.org_slug
  )

  const organization = await OrganizationService.getBySlugForInvite(
    request.params.org_slug,
    request.params.invite_id
  )

  if (
    !organization ||
    !organizationInvite ||
    organizationInvite.email.toLowerCase() !== request.query.email.toLowerCase()
  ) {
    return reply.sendNotFound('organization invite')
  }

  return reply.status(200).send({
    type: 'get_organization_invite',
    payload: {
      organization,
      organization_invite: organizationInvite
    }
  })
}

export const updateSchema = {
  headers: AuthHeadersSchema,
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    invite_id: UuidSchema
  }),
  body: Type.Object({
    status: OrganizationInviteStatusSchema,
    email: EmailSchema
  }),
  summary: 'Update a Sort Organization Invite',
  operationId: 'update_organization_invite',
  tags: ['invite'],
  response: {
    200: GeneralSuccessSchema,
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    403: GeneralErrorSchema,
    404: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
}

export async function update(
  request: FastifyRequestTypebox<typeof updateSchema>,
  reply: FastifyReplyTypebox<typeof updateSchema>
) {
  const isOwner = await OrganizationService.isOwnerBySlug({
    userId: request.sort.user.id,
    slug: request.params.org_slug
  })

  // only owners can recind invites
  if (!isOwner && request.body.status === 'rescinded') {
    return reply.status(403).send({
      type: 'error',
      payload: {
        error: {
          message: 'Only organization owners can rescind invites.'
        }
      }
    })
  }

  const organizationInvite = await OrganizationInviteService.getById(
    request.params.invite_id,
    request.params.org_slug
  )

  if (!organizationInvite) {
    return reply.sendNotFound('organization invite')
  }

  if (organizationInvite.status !== 'pending') {
    return reply.status(409).send({
      type: 'error',
      payload: {
        error: {
          message:
            'Organization invite has already been accepted, declined or rescinded.'
        }
      }
    })
  }

  await OrganizationInviteService.updateStatus(
    {
      id: request.params.invite_id,
      email: request.body.email
    },
    request.sort.user.id,
    {
      status: request.body.status
    }
  )

  return reply.status(200).send({
    type: 'success',
    payload: {
      success: {
        message: 'Successfully updated organization invite.'
      }
    }
  })
}
