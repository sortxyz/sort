import { Type } from '@sinclair/typebox'
import { UuidSchema } from '@sort/shared/schemas/api.schema'
import { OrganizationSlugSchema } from '@sort/shared/schemas/org.schema'
import * as ConnectionService from '@sort/shared/services/connection.service'
import { getDatabasesWithSchemas } from '@sort/shared/services/kysely/snapshot/database.service'
import { getCurrentSnapshot } from '@sort/shared/services/kysely/snapshot/snapshot.service'
import { VisibilitySchema } from '@sort/shared/types/kysely.type'

import type { Static } from '@sinclair/typebox'

export const GetDatabasesForOrganizationSchema = Type.Array(
  Type.Object({
    name: Type.String(),
    is_starred: Type.Boolean(),
    data_provider: Type.String(),
    visibility: VisibilitySchema,
    connection: Type.String(),
    connection_id: UuidSchema,
    schemas: Type.Array(Type.String()),
    display_name: Type.String(),
    slug: Type.String(),
    summary: Type.String(),
    link: Type.String(),
    organization_id: UuidSchema,
    organization_slug: OrganizationSlugSchema
  })
)

export const getDatabasesForOrganization = async (
  orgSlug: string,
  { isMember }: { isMember: boolean } = { isMember: false }
) => {
  const ret: Static<typeof GetDatabasesForOrganizationSchema> = []
  const connections = await ConnectionService.getAll({ orgSlug })

  for (const connection of connections) {
    if (!isMember && connection.visibility === 'private') {
      continue
    }

    const snapshot = await getCurrentSnapshot(connection.id)

    if (!snapshot) {
      continue
    }

    if (snapshot.status !== 'COMPLETED') {
      continue
    }

    const rawDbs = await getDatabasesWithSchemas(snapshot.id)

    rawDbs
      .filter(db => {
        return !(
          connection.data_provider === 'postgres' && db.name === 'postgres'
        )
      })
      .map(db =>
        ret.push({
          connection: connection.name,
          connection_id: connection.id,
          data_provider: connection.data_provider,
          display_name: db.display_name ?? '',
          is_starred: false,
          link: db.link ?? '',
          name: db.name ?? '',
          organization_id: db.organization_id,
          organization_slug: orgSlug,
          schemas: db.schemaNames ?? [],
          slug: db.slug,
          summary: db.summary ?? '',
          visibility: connection.visibility
        } satisfies Static<typeof GetDatabasesForOrganizationSchema>[number])
      )
  }

  return ret
}
