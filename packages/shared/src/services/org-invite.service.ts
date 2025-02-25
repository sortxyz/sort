import { sql } from 'kysely'

import { getDb } from '../'
import { DatabaseUniquenessError } from '../errors'

import type { OrganizationInvite } from '../schemas/org-invite.schema'

export const create = async (organizationInvite: OrganizationInvite) => {
  try {
    organizationInvite.email = organizationInvite.email.toLowerCase()

    return await getDb()
      .insertInto('organization_invite')
      .values(organizationInvite)
      .returningAll()
      .executeTakeFirstOrThrow()
  } catch (error) {
    if (DatabaseUniquenessError.isViolationError(error)) {
      throw new DatabaseUniquenessError('Organization invite already exists', {
        cause: error
      })
    }

    throw new Error('Error creating organization invite', { cause: error })
  }
}

export const updateStatus = async (
  check: Pick<OrganizationInvite, 'email' | 'id'>,
  user_id: string,
  patch: Pick<OrganizationInvite, 'status'>
) => {
  try {
    await getDb()
      .transaction()
      .execute(async trx => {
        if (patch.status === 'accepted') {
          const insert = sql`INSERT INTO "organization_user" ("user_id", "organization_id", "role_id")
          SELECT ${user_id}, "organization_id", "role_id"
          FROM "organization_invite"
          WHERE "email" = ${check.email}
            AND "id" = ${check.id}
            AND "status" = 'pending'
          RETURNING *;`

          const result = await insert.execute(trx)
          if (!result.rows.length) {
            throw new Error('Error adding user to organization')
          }
        }

        // NOTE:
        // at the time of writing this code, all `status` values are final except `pending`
        // so we can safely assume that if the status is not `pending`
        // then the invite has been accepted, rejected or rescinded
        await trx
          .deleteFrom('organization_invite')
          .where('email', '=', check.email)
          .where('id', '=', check.id)
          .where('status', '=', 'pending')
          .execute()
      })
  } catch (error) {
    throw new Error('Error updating organization invite', { cause: error })
  }
}

// FIXME: use an object argument to prevent arg order errors
export const getById = async (id: string, organizationSlug: string) => {
  return await getDb()
    .selectFrom('organization_invite')
    .leftJoin(
      'organization',
      'organization.id',
      'organization_invite.organization_id'
    )
    .selectAll('organization_invite')
    .where('organization.slug', '=', organizationSlug)
    .where('organization_invite.id', '=', id)
    .where('organization_invite.status', '=', 'pending')
    .executeTakeFirst()
}

export const removeById = async (id: string) => {
  try {
    return await getDb()
      .deleteFrom('organization_invite')
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirstOrThrow()
  } catch (error) {
    throw new Error('Error removing organization invite', { cause: error })
  }
}

export const getAllByOrganizationId = async (organizationId: string) => {
  return await getDb()
    .selectFrom('organization_invite')
    .where('organization_id', '=', organizationId)
    .selectAll()
    .execute()
}
