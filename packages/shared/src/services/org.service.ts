import { sql } from 'kysely'

import { getDb } from '../'
import { pg7ErrorConditionCodes } from '../constants/database.constant'
import { DEFAULT_ORG_DESCRIPTION } from '../constants/metadata.constant'
import { DatabaseUniquenessError } from '../errors'
import { isErrnoException } from '../utils'

import type { OrganizationMember } from '../schemas/org-member.schema'
import type { Organization } from '../schemas/org.schema'
import type { RoleName } from '../schemas/role.schema'
import type { SortDB } from '../types/kysely.type'
import type { Insertable, Kysely, Transaction } from 'kysely'

type OrganizationMemberRow = {
  role_id: number
  role_name: RoleName
  user_name: string | null
  user_id: string
  user_username: string
  user_picture: string | null
}

export const rowToOrganizationMember = (
  row: OrganizationMemberRow
): OrganizationMember => ({
  user: {
    id: row.user_id,
    name: row.user_name,
    username: row.user_username,
    picture: row.user_picture
  },
  role: { id: row.role_id, name: row.role_name }
})

/**
 * Ensures an organization and it's associated role exist. This is operation is
 * idempotent.
 **/
export const create = async (org: Insertable<SortDB['organization']>) => {
  try {
    return await getDb()
      .transaction()
      .execute(async trx => {
        const insertedOrg = await trx
          .insertInto('organization')
          .values({
            ...org,
            link: org.link || null,
            description: org.description || DEFAULT_ORG_DESCRIPTION
          })
          .returningAll()
          .executeTakeFirstOrThrow()

        await trx
          .insertInto('organization_user')
          .columns(['organization_id', 'user_id', 'role_id'])
          .expression(eb =>
            eb
              .selectFrom('role')
              .select(eb => [
                eb.val(org.id).as('organization_id'),
                eb.val(org.created_by).as('user_id'),
                'role.id'
              ])
              .where('role.name', '=', 'owner')
          )
          .execute()

        return insertedOrg
      })
  } catch (error) {
    if (
      isErrnoException(error) &&
      error.code === pg7ErrorConditionCodes.UNIQUE_VIOLATION
    ) {
      throw new DatabaseUniquenessError('Organization already exists', {
        cause: error
      })
    }

    throw new Error('Error creating organization', { cause: error })
  }
}

const rowToOrganization = (row: OrganizationRow) => {
  const org: Organization = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    link: row.link,
    created_at: row.created_at,
    created_by: row.created_by,
    permissions: createOrgPermissions(row.role_name),
    slack_webhook_url: row.slack_webhook_url,
    discord_webhook_url: row.discord_webhook_url,
    banner: row.banner
  }

  return org
}

export const createOrgPermissions = (role: string | null) => {
  const hasMembership = /^(owner|member)$/.test(role ?? '')
  const isOwner = role === 'owner'

  return {
    view_settings: {
      value: isOwner,
      message:
        'You must be an organization owner to view organization settings.'
    },
    view_database_settings: {
      value: hasMembership,
      message: 'You must be an organization member to view database settings.'
    },
    view_invites: {
      value: isOwner,
      message: 'You must be an organization owner to view organization invites.'
    },
    save_queries: {
      value: hasMembership,
      message: 'You must be an organization member to save queries.'
    },
    edit_queries: {
      value: hasMembership,
      message: 'You must be an organization member to edit queries.'
    },
    manage_roles: {
      value: isOwner,
      message: 'You must be an organization owner to manage organization roles.'
    },
    is_owner: {
      value: isOwner
    },
    is_member: {
      value: hasMembership
    }
  }
}

type OrganizationRow = Organization & { role_name: RoleName | null }

export const getMyOrganizations = async (
  userId: string
): Promise<Organization[]> => {
  if (userId === '') return []

  try {
    const rows = await getDb()
      .selectFrom('organization as o')
      .innerJoin('organization_user as ou', 'o.id', 'ou.organization_id')
      .innerJoin('role as r', 'r.id', 'ou.role_id')
      .where('ou.user_id', '=', userId)
      .orderBy('o.name', 'asc')
      .selectAll('o')
      .select('r.name as role_name')
      .execute()
    return rows.map(rowToOrganization)
  } catch (error) {
    throw new Error('Error querying organization', { cause: error })
  }
}

export const getById = async (id: string) => {
  if (id.trim() === '') return undefined

  try {
    return getDb()
      .selectFrom('organization')
      .where('id', '=', id)
      .selectAll()
      .executeTakeFirst()
  } catch (error) {
    throw new Error('Error getting organization by id', { cause: error })
  }
}

/**
 * Retrieves the org with the given `slug`.
 **/
export const getBySlug = async (slug: string, userId: string | null) => {
  if (slug.trim() === '') return undefined

  try {
    const result = await getDb()
      .selectFrom('organization as o')
      .leftJoin('organization_user as ou', join => {
        return join
          .onRef('o.id', '=', 'ou.organization_id')
          .on('ou.user_id', '=', userId)
      })
      .leftJoin('role as r', 'r.id', 'ou.role_id')
      .where('o.slug', '=', slug.trim())
      .selectAll('o')
      .select('r.name as role_name')
      .orderBy('o.name', 'asc')
      .executeTakeFirst()
    return result ? rowToOrganization(result) : undefined
  } catch (error) {
    throw new Error('Error getting organization by slug', { cause: error })
  }
}

/**
 * Retrieves the org with the given `slug`. If `userId` is not a member or the
 * org does not exist, `null` is returned.
 **/
export const getBySlugForInvite = async (slug: string, inviteId: string) => {
  if (slug.trim() === '') return undefined
  if (inviteId.trim() === '') return undefined

  try {
    const result = await getDb()
      .selectFrom('organization as o')
      .innerJoin('organization_invite as oi', 'o.id', 'oi.organization_id')
      .where('oi.id', '=', inviteId)
      .where('o.slug', '=', slug.trim())
      .selectAll('o')
      .executeTakeFirst()
    return result
  } catch (error) {
    throw new Error('Error getting organization by slug and invite', {
      cause: error
    })
  }
}

/**
 * Updates an organization in the database.
 * @param slug An organization entity's slug.
 * @param org The key / values to update.
 */
export const updateBySlug = async (
  slug: string,
  org: Partial<
    Pick<
      Organization,
      | 'name'
      | 'description'
      | 'link'
      | 'slug'
      | 'slack_webhook_url'
      | 'discord_webhook_url'
      | 'banner'
    >
  >
) => {
  if (slug.trim() === '') {
    throw new Error('slug cannot be empty.')
  }

  const updates: Record<string, unknown> = {}

  if (org.name?.trim()) {
    updates['name'] = org.name?.trim()
  }

  if (org.description?.trim()) {
    updates['description'] = org.description?.trim()
  } else if (org.description === null) {
    updates['description'] = null
  }

  if (org.link?.trim()) {
    updates['link'] = org.link?.trim()
  } else if (org.link === null) {
    updates['link'] = null
  }

  if (org.slug?.trim()) {
    updates['slug'] = org.slug?.trim()
  }

  if (org.slack_webhook_url?.trim()) {
    updates['slack_webhook_url'] = org.slack_webhook_url?.trim()
  } else if (org.slack_webhook_url === null) {
    updates['slack_webhook_url'] = null
  }

  if (org.discord_webhook_url?.trim()) {
    updates['discord_webhook_url'] = org.discord_webhook_url?.trim()
  } else if (org.discord_webhook_url === null) {
    updates['discord_webhook_url'] = null
  }

  if (org.banner?.trim()) {
    updates['banner'] = org.banner?.trim()
  } else if (org.banner === null) {
    updates['banner'] = null
  }

  if (Object.keys(updates).length === 0) {
    throw new Error('At least one field is required to update an organization.')
  }

  try {
    const result = await getDb()
      .updateTable('organization')
      .set(updates)
      .where('slug', '=', slug.trim())
      .returningAll()
      .executeTakeFirst()

    if (!result) {
      throw new Error(`No organization found with slug: ${slug}`)
    }

    return result
  } catch (error) {
    if (
      isErrnoException(error) &&
      error.code === pg7ErrorConditionCodes.UNIQUE_VIOLATION
    ) {
      throw new DatabaseUniquenessError('slug already exists.', {
        cause: error
      })
    }

    throw new Error(`Error updating organization with slug: ${slug}`, {
      cause: error
    })
  }
}

/**
 * Removes an organization from the database.
 * @param slug An organization entity's slug.
 */
export const removeBySlug = async (slug: string) => {
  const trimmedSlug = slug.trim()

  if (trimmedSlug === '') {
    throw new Error('slug cannot be empty')
  }

  try {
    await getDb()
      .transaction()
      .execute(async tx => {
        await tx
          .deleteFrom('organization_user')
          .where('organization_id', '=', qb => {
            return qb
              .selectFrom('organization')
              .where('slug', '=', trimmedSlug)
              .select('id')
          })
          .execute()

        await tx
          .deleteFrom('organization')
          .where('slug', '=', trimmedSlug)
          .execute()
      })
  } catch (error) {
    throw new Error(`Error deleting organization with slug: ${slug}`, {
      cause: error
    })
  }
}

/**
 * Gets the role of a user in an organization.
 * @param userId
 * @param slug An organization slug.
 */
export const getUserRoleName = async ({
  userId,
  slug
}: {
  userId: string
  slug: string
}) => {
  if (userId.trim() === '') {
    throw new Error('userId cannot be empty')
  }

  if (slug.trim() === '') {
    throw new Error('slug cannot be empty')
  }

  try {
    const result = await getDb()
      .selectFrom('organization as o')
      .innerJoin('organization_user as ou', 'o.id', 'ou.organization_id')
      .innerJoin('role as r', 'r.id', 'ou.role_id')
      .where('ou.user_id', '=', userId)
      .where('o.slug', '=', slug.trim())
      .select('r.name')
      .executeTakeFirst()
    return result?.name
  } catch (error) {
    throw new Error('Error getting user organization role.', { cause: error })
  }
}

/** Checks to see if the given userId is an owner of the organization with the given slug. */
export const isOwnerBySlug = async ({
  userId,
  slug
}: {
  userId: string
  slug: string
}) => {
  const role = await getUserRoleName({ userId, slug })
  return role === 'owner'
}

/** Returns a kysely query builder preset to retrieve an organization's members which can be extended and subsequently executed */
export const createGetMembersBaseQueryBuilder = (
  slug: string,
  trx?: Kysely<SortDB>
) => {
  const kyselyDb = trx || getDb()
  return kyselyDb
    .selectFrom('organization')
    .innerJoin(
      'organization_user',
      'organization.id',
      'organization_user.organization_id'
    )
    .innerJoin('user', 'user.id', 'organization_user.user_id')
    .innerJoin('role', 'role.id', 'organization_user.role_id')
    .where('organization.slug', '=', slug.trim())
    .select([
      'user.id as user_id',
      'user.name as user_name',
      'user.username as user_username',
      'user.picture as user_picture',
      'role.id as role_id',
      'role.name as role_name'
    ])
}

export const getMembers = async (slug: string) => {
  if (slug.trim() === '') {
    throw new Error('slug cannot be empty')
  }

  const memberRows = await createGetMembersBaseQueryBuilder(slug).execute()
  return memberRows.map(rowToOrganizationMember)
}

export const getMembersByIds = async (slug: string, ids: string[]) => {
  if (slug.trim() === '') {
    throw new Error('slug cannot be empty')
  }

  if (ids.length === 0) {
    return []
  }

  const memberRows = await createGetMembersBaseQueryBuilder(slug)
    .where('user.id', 'in', ids)
    .execute()

  return memberRows.map(rowToOrganizationMember)
}

/**
 * Adds a member an Organization.
 * @param slug The organization's slug.
 * @param userId The member id.
 */
export const addMember = async (
  slug: string,
  userId: string,
  roleName: RoleName
) => {
  if (slug.trim() === '') {
    throw new Error('slug cannot be empty')
  }

  if (userId.trim() === '') {
    throw new Error('userId cannot be empty')
  }

  if (roleName.trim() === '') {
    throw new Error('roleName cannot be empty')
  }

  try {
    const { id: roleId } = await getDb()
      .selectFrom('role')
      .select('id')
      .where('name', '=', roleName)
      .executeTakeFirstOrThrow()

    await getDb()
      .insertInto('organization_user')
      .columns(['organization_id', 'user_id', 'role_id'])
      .expression(eb =>
        eb
          .selectFrom('organization as o')
          .select(eb => [
            'o.id',
            eb.val(userId).as('user_id'),
            eb.val(roleId).as('role_id')
          ])
          .where('o.slug', '=', slug.trim())
          .where(filter => {
            return filter.not(
              filter.exists(
                filter
                  .selectFrom('organization_user')
                  .where('user_id', '=', userId)
                  .whereRef('organization_id', '=', 'o.id')
              )
            )
          })
      )
      .execute()
  } catch (error) {
    throw new Error('Error adding user to organization.', { cause: error })
  }
}

export class OrgOwnerRequiredError extends Error {
  slug: string
  username: string

  constructor(username: string, slug: string) {
    super('Cannot remove the last owner of an organization.')

    this.username = username
    this.slug = slug
  }
}

export async function updateMemberRole(
  slug: string,
  username: string,
  role_id: number
) {
  if (slug.trim() === '') {
    throw new Error('slug cannot be empty')
  }

  if (username.trim() === '') {
    throw new Error('username cannot be empty')
  }

  try {
    return await getDb()
      .transaction()
      .execute(async tx => {
        const isChangingToNonOwnerRole = role_id !== 0

        if (isChangingToNonOwnerRole) {
          if (await isLastOrgOwner(tx, slug, username)) {
            throw new OrgOwnerRequiredError(username, slug)
          }
        }

        const qb = sql<OrganizationMemberRow>`WITH updated AS
        (
          UPDATE ${sql.table('organization_user')} ou
          SET role_id = ${role_id}
          WHERE ou.user_id = (
            SELECT id FROM ${sql.table('user')}
            WHERE username = ${username.trim()}
          )
          AND ou.organization_id = (
            SELECT o.id FROM ${sql.table('organization')} o
            WHERE o.slug = ${slug.trim()}
          )
          RETURNING ou.user_id, ou.role_id
        )

        SELECT
          u.id AS user_id,
          u.name AS user_name,
          u.username AS user_username,
          u.picture as user_picture,
          r.id AS role_id,
          r.name AS role_name
        FROM updated
        JOIN ${sql.table('user')} u ON updated.user_id = u.id
        JOIN ${sql.table('role')} r ON updated.role_id = r.id`

        const result = await qb.execute(tx)

        if (!result.rows.length) {
          throw new Error('Error updating user role.')
        }

        return rowToOrganizationMember(result.rows[0])
      })
  } catch (error) {
    throw new Error('Error updating user role.', { cause: error })
  }
}

const isLastOrgOwner = async (
  tx: Transaction<SortDB>,
  slug: string,
  username: string
) => {
  const lastOwnerResult = await sql<{
    total_owner_count: number
    is_owner: boolean
  }>`SELECT
      COUNT(*)::int AS total_owner_count,
      COUNT(CASE WHEN u.username = ${username.trim()} THEN 1 END)::int::boolean AS is_owner
    FROM ${sql.table('organization_user')} ou
    JOIN ${sql.table('role')} r ON ou.role_id = r.id
    JOIN ${sql.table('user')} u ON ou.user_id = u.id
    WHERE ou.organization_id = (
      SELECT o.id FROM ${sql.table('organization')} o
      WHERE o.slug = ${slug.trim()}
    )
    AND r.name = 'owner'
  `.execute(tx)

  const result = lastOwnerResult.rows[0]
  return result?.is_owner && result?.total_owner_count === 1
}

/**
 * Removes a member from an Organization.
 * @param slug The organization's slug.
 * @param username The member's username.
 */
export const removeMember = async (slug: string, username: string) => {
  if (slug.trim() === '') {
    throw new Error('slug cannot be empty')
  }

  if (username.trim() === '') {
    throw new Error('username cannot be empty')
  }

  try {
    return await getDb()
      .transaction()
      .execute(async tx => {
        if (await isLastOrgOwner(tx, slug, username)) {
          throw new OrgOwnerRequiredError(username, slug)
        }

        await sql`DELETE FROM ${sql.table('organization_user')} ou
        WHERE ou.user_id = (
          SELECT u.id FROM ${sql.table('user')} u
          WHERE u.username = ${username.trim()}
        )
        AND ou.organization_id = (
          SELECT o.id FROM ${sql.table('organization')} o
          WHERE o.slug = ${slug.trim()}
        )
      `.execute(tx)
      })
  } catch (error) {
    throw new Error('Error removing user from organization.', {
      cause: error
    })
  }
}
