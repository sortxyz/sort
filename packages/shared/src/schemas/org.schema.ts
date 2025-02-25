import { Type } from '@sinclair/typebox'

import { TNullable } from '../types/nullable.type'

import {
  UuidSchema,
  DateSchema,
  MarkdownColumnSchema,
  UriSchema,
  createSlugSchema
} from './api.schema'
import { PermissionSchema } from './permissions.schema'

import type { Static } from '@sinclair/typebox'

export const OrganizationNameSchema = Type.String({
  minLength: 2,
  maxLength: 128
})

export const OrganizationSlugSchema = createSlugSchema('The organization slug')

export const OrganizationDescriptionSchema = MarkdownColumnSchema

export const OrganizationLinkSchema = UriSchema

export const SlackRegexpSchema = TNullable(
  Type.String({
    pattern: '^https:\\/\\/hooks\\.slack\\.com\\/services\\/.*$',
    description: 'Slack webhook URL',
    examples: ['https://hooks.slack.com/services/T0000/B000/XXXX']
  })
)

export const DiscordRegexpSchema = TNullable(
  Type.String({
    pattern: '^https:\\/\\/discord\\.com\\/api\\/webhooks\\/.*$',
    description: 'Discord webhook URL',
    examples: ['https://discord.com/api/webhooks/12345/ABCDE']
  })
)

export const OrganizationBannerSchema = TNullable(
  Type.String({
    maxLength: 10_000,
    description:
      'A message to display to all users in the organization. Markdown is supported.'
  })
)

export const OrganizationSchema = Type.Object({
  id: UuidSchema,
  name: OrganizationNameSchema,
  slug: OrganizationSlugSchema,
  description: OrganizationDescriptionSchema,
  link: OrganizationLinkSchema,
  created_at: DateSchema,
  created_by: UuidSchema,
  slack_webhook_url: Type.Optional(TNullable(SlackRegexpSchema)),
  discord_webhook_url: Type.Optional(TNullable(DiscordRegexpSchema)),
  banner: Type.Optional(OrganizationBannerSchema),
  permissions: Type.Optional(
    Type.Object({
      edit_queries: PermissionSchema,
      is_member: PermissionSchema,
      is_owner: PermissionSchema,
      manage_roles: PermissionSchema,
      save_queries: PermissionSchema,
      view_database_settings: PermissionSchema,
      view_invites: PermissionSchema,
      view_settings: PermissionSchema
    })
  )
})

export type Organization = Static<typeof OrganizationSchema>
