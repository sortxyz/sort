import { randomUUID } from 'node:crypto'

import { Type } from '@sinclair/typebox'
import * as Errors from '@sort/shared/errors/index'
import {
  AuthHeadersSchema,
  GeneralErrorSchema,
  GeneralSuccessSchema,
  StringEnum,
  ValidationErrorSchema,
  createMessageSchema
} from '@sort/shared/schemas/api.schema'
import { HydratedDashboardItemSchema } from '@sort/shared/schemas/dashboard.schema'
import { OrganizationMemberSchema } from '@sort/shared/schemas/org-member.schema'
import {
  OrganizationSchema,
  OrganizationSlugSchema,
  OrganizationNameSchema,
  OrganizationDescriptionSchema,
  OrganizationBannerSchema,
  OrganizationLinkSchema,
  DiscordRegexpSchema,
  SlackRegexpSchema
} from '@sort/shared/schemas/org.schema'
import { getDashboard } from '@sort/shared/services/dashboard.search.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import { sendAnalyticsSlackNotification } from '@sort/shared/services/slack.service'

import { config } from '../../config/bootstrap'

import type {
  FastifyReplyTypebox,
  FastifyRequestTypebox
} from '../types/fastify.type'
import type { Organization } from '@sort/shared/schemas/org.schema'
import type { FastifySchema } from 'fastify'

const { IS_PROD_ENV } = config

const ParamsSchema = Type.Object({
  org_slug: OrganizationSlugSchema
})

const CreateBodySchema = Type.Object({
  name: OrganizationNameSchema,
  slug: OrganizationSlugSchema,
  description: Type.Optional(OrganizationDescriptionSchema),
  link: Type.Optional(OrganizationLinkSchema)
})

const UpdateBySlugBodySchema = Type.Partial(
  Type.Composite([
    CreateBodySchema,
    Type.Object({
      slack_webhook_url: SlackRegexpSchema,
      discord_webhook_url: DiscordRegexpSchema,
      banner: OrganizationBannerSchema
    })
  ]),
  {
    minProperties: 1,
    additionalProperties: false
  }
)

export const getMyOrganizationsSchema = {
  headers: AuthHeadersSchema,
  summary: 'Get your Sort Organizations',
  operationId: 'list_my_organizations',
  tags: ['organization'],
  response: {
    200: createMessageSchema(
      'list_my_organizations',
      Type.Object({
        organizations: Type.Array(OrganizationSchema)
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getMyOrganizations = async (
  request: FastifyRequestTypebox<typeof getMyOrganizationsSchema>,
  reply: FastifyReplyTypebox<typeof getMyOrganizationsSchema>
) => {
  const organizations = await OrganizationService.getMyOrganizations(
    request.sort.user.id
  )

  return reply.status(200).send({
    type: 'list_my_organizations',
    payload: {
      organizations
    }
  })
}

export const getOrganizationBySlugSchema = {
  headers: AuthHeadersSchema,
  params: ParamsSchema,
  summary: 'Get a Sort Organization',
  operationId: 'get_organization',
  tags: ['organization'],
  response: {
    200: createMessageSchema(
      'get_organization',
      Type.Object({
        organization: OrganizationSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getOrganizationBySlug = async (
  request: FastifyRequestTypebox<typeof getOrganizationBySlugSchema>,
  reply: FastifyReplyTypebox<typeof getOrganizationBySlugSchema>
) => {
  const params = request.params

  const organization = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.isCustomerAccount ? request.sort.user.id : null
  )

  if (!organization) {
    return reply.sendNotFound('organization')
  }

  return reply.status(200).send({
    type: 'get_organization',
    payload: {
      organization
    }
  })
}

export const GetOrganizationDashboardSchema = {
  headers: AuthHeadersSchema,
  params: ParamsSchema,
  summary: 'Get a Sort Organization Dashboard',
  operationId: 'get_organization_dashboard',
  tags: ['organization'],
  querystring: Type.Object({
    items: Type.Optional(StringEnum(['issues', 'change_requests'])),
    status: Type.Optional(StringEnum(['open', 'closed'])),
    limit: Type.Optional(
      Type.Integer({ minimum: 1, maximum: 100, default: 20 })
    )
  }),
  response: {
    200: createMessageSchema(
      'get_organization_dashboard',
      Type.Object({
        dashboard: Type.Array(HydratedDashboardItemSchema)
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getOrganizationDashboard = async (
  request: FastifyRequestTypebox<typeof GetOrganizationDashboardSchema>,
  reply: FastifyReplyTypebox<typeof GetOrganizationDashboardSchema>
) => {
  const params = request.params
  const queryString = request.query

  const org = await OrganizationService.getBySlug(
    params.org_slug,
    request.sort.isCustomerAccount ? request.sort.user.id : null
  )

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const orgMembers = await OrganizationService.getMembersByIds(
    params.org_slug,
    request.sort.isCustomerAccount ? [request.sort.user.id] : []
  )
  if (!orgMembers) {
    return reply.sendNotFound('organization')
  }

  const dashboard = await getDashboard({
    org,
    status: queryString.status,
    itemType: queryString.items,
    limit: queryString.limit,
    context: request.sort
  })

  return reply.status(200).send({
    type: 'get_organization_dashboard',
    payload: {
      dashboard
    }
  })
}

export const createSchema = {
  headers: AuthHeadersSchema,
  body: CreateBodySchema,
  summary: 'Create a Sort Organization',
  operationId: 'create_organization',
  tags: ['organization'],
  response: {
    201: createMessageSchema(
      'create_organization',
      Type.Object({
        organization: OrganizationSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
}

export const create = async (
  request: FastifyRequestTypebox<typeof createSchema>,
  reply: FastifyReplyTypebox<typeof createSchema>
) => {
  const body = request.body

  const pendingOrganization = {
    id: randomUUID(),
    name: body.name,
    slug: body.slug,
    description: body.description ?? null,
    link: body.link ?? null,
    created_by: request.sort.user.id,
    created_at: new Date()
  } satisfies Organization

  try {
    const organization = await OrganizationService.create(pendingOrganization)

    if (IS_PROD_ENV) {
      void sendAnalyticsSlackNotification({
        message: `New organization created: ${organization.name} by ${request.sort.user.email}`,
        logger: request.log,
        initiatingUserEmail: request.sort.user.email
      })
    }

    return reply.status(201).send({
      type: 'create_organization',
      payload: {
        organization
      }
    })
  } catch (error) {
    if (!(error instanceof Errors.DatabaseUniquenessError)) {
      throw error
    }

    if (error.column !== 'slug' || error.table !== 'organization') {
      throw error
    }

    return reply.status(409).send({
      type: 'error',
      payload: {
        error: { message: 'Organization slug already exists.' }
      }
    })
  }
}

export const updateBySlugSchema = {
  headers: AuthHeadersSchema,
  body: UpdateBySlugBodySchema,
  params: ParamsSchema,
  summary: 'Update a Sort Organization',
  operationId: 'update_organization',
  tags: ['organization'],
  response: {
    200: createMessageSchema(
      'update_organization',
      Type.Object({
        organization: OrganizationSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const updateBySlug = async (
  request: FastifyRequestTypebox<typeof updateBySlugSchema>,
  reply: FastifyReplyTypebox<typeof updateBySlugSchema>
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

  try {
    const organization = await OrganizationService.updateBySlug(
      params.org_slug,
      body
    )

    return reply.status(200).send({
      type: 'update_organization',
      payload: {
        organization
      }
    })
  } catch (error) {
    if (!(error instanceof Errors.DatabaseUniquenessError)) {
      throw error
    }

    if (error.column !== 'slug' || error.table !== 'organization') {
      throw error
    }

    return reply.status(409).send({
      type: 'error',
      payload: {
        error: { message: 'Organization slug already taken.' }
      }
    })
  }
}

export const removeBySlugSchema = {
  headers: AuthHeadersSchema,
  params: ParamsSchema,
  summary: 'Remove a Sort Organization',
  operationId: 'remove_organization',
  tags: ['organization'],
  response: {
    200: GeneralSuccessSchema,
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    409: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const removeBySlug = async (
  request: FastifyRequestTypebox<typeof removeBySlugSchema>,
  reply: FastifyReplyTypebox<typeof removeBySlugSchema>
) => {
  const params = request.params

  const isOwner = await OrganizationService.isOwnerBySlug({
    userId: request.sort.user.id,
    slug: params.org_slug
  })

  request.log.info({ isOwner })

  if (!isOwner) {
    return reply.sendNotFound('organization')
  }

  await OrganizationService.removeBySlug(params.org_slug)

  return reply.send({
    type: 'success',
    payload: {
      success: {
        message: `Organization ${params.org_slug} deleted successfully.`
      }
    }
  })
}

export const getMembersSchema = {
  headers: AuthHeadersSchema,
  params: Type.Object({ org_slug: OrganizationSlugSchema }),
  summary: 'Get the members of a Sort Organization',
  operationId: 'list_organization_members',
  tags: ['organization'],
  response: {
    200: createMessageSchema(
      'list_organization_members',
      Type.Object({
        members: Type.Array(OrganizationMemberSchema)
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const getMembers = async (
  request: FastifyRequestTypebox<typeof getMembersSchema>,
  reply: FastifyReplyTypebox<typeof getMembersSchema>
) => {
  const slug = request.params.org_slug

  const organization = await OrganizationService.getBySlug(
    slug,
    request.sort.user.id
  )

  if (!organization) {
    return reply.sendNotFound('organization')
  }

  const members = await OrganizationService.getMembers(slug)

  return reply.status(200).send({
    type: 'list_organization_members',
    payload: {
      members
    }
  })
}

export const updateMemberSchema = {
  headers: AuthHeadersSchema,
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    username: Type.String()
  }),
  body: Type.Object({
    role_id: Type.Integer()
  }),
  summary: 'Update a member of a Sort Organization',
  operationId: 'update_organization_member',
  tags: ['organization'],
  response: {
    200: createMessageSchema(
      'update_organization_member',
      Type.Object({
        member: OrganizationMemberSchema
      })
    ),
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    403: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const updateMember = async (
  request: FastifyRequestTypebox<typeof updateMemberSchema>,
  reply: FastifyReplyTypebox<typeof updateMemberSchema>
) => {
  const { org_slug: slug, username } = request.params

  const org = await OrganizationService.getBySlug(slug, request.sort.user.id)

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const isOwner = await OrganizationService.isOwnerBySlug({
    userId: request.sort.user.id,
    slug
  })

  const isPermittedToUpdate = isOwner

  if (!isPermittedToUpdate) {
    return reply.status(403).send({
      type: 'error',
      payload: {
        error: {
          message: 'You must be an organization owner to perform this action.'
        }
      }
    })
  }

  try {
    const member = await OrganizationService.updateMemberRole(
      slug,
      username,
      request.body.role_id
    )

    return reply.send({
      type: 'update_organization_member',
      payload: {
        member
      }
    })
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }

    if (error.cause instanceof OrganizationService.OrgOwnerRequiredError) {
      return reply.status(409).send({
        type: 'error',
        payload: {
          error: {
            message: error.cause.message
          }
        }
      })
    }

    throw error
  }
}

export const removeMemberSchema = {
  headers: AuthHeadersSchema,
  params: Type.Object({
    org_slug: OrganizationSlugSchema,
    username: Type.String()
  }),
  summary: 'Remove a member from a Sort Organization',
  operationId: 'remove_organization_member',
  tags: ['organization'],
  response: {
    200: GeneralSuccessSchema,
    400: ValidationErrorSchema,
    401: GeneralErrorSchema,
    404: GeneralErrorSchema,
    403: GeneralErrorSchema,
    500: GeneralErrorSchema
  }
} satisfies FastifySchema

export const removeMember = async (
  request: FastifyRequestTypebox<typeof removeMemberSchema>,
  reply: FastifyReplyTypebox<typeof removeMemberSchema>
) => {
  const { org_slug: slug, username } = request.params

  const org = await OrganizationService.getBySlug(slug, request.sort.user.id)

  if (!org) {
    return reply.sendNotFound('organization')
  }

  const isOwner = await OrganizationService.isOwnerBySlug({
    userId: request.sort.user.id,
    slug
  })

  const isRemovingThemselves = request.sort.user.username === username
  const isPermittedToRemove = isOwner || isRemovingThemselves

  if (!isPermittedToRemove) {
    return reply.status(403).send({
      type: 'error',
      payload: {
        error: {
          message: 'You must be an organization owner to perform this action.'
        }
      }
    })
  }

  try {
    await OrganizationService.removeMember(slug, username)
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }

    if (error.cause instanceof OrganizationService.OrgOwnerRequiredError) {
      return reply.status(409).send({
        type: 'error',
        payload: {
          error: { message: error.cause.message }
        }
      })
    }

    throw error
  }

  return reply.send({
    type: 'success',
    payload: {
      success: {
        message: `Member ${request.params.username} removed from organization ${request.params.org_slug} successfully.`
      }
    }
  })
}
