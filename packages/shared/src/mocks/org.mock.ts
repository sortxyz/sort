import { randomUUID } from 'node:crypto'

import { getDb } from '../'
import { createOrgPermissions } from '../services/org.service'

import type { Organization } from '../schemas/org.schema'

export class OrganizationMock {
  mocks: Organization[] = []

  create(values: Partial<Organization> = {}) {
    const id = randomUUID()

    const mock = {
      id,
      name: `Organization ${id}`,
      slug: `organization-${id}`,
      description: `Organization ${id} description`,
      link: `https://example.com/organization-${id}`,
      created_at: new Date(),
      created_by: 'auth0|62e4b12143e9885859dcf15d',
      slack_webhook_url: null,
      discord_webhook_url: null,
      banner: null,
      ...values
    } satisfies Organization

    this.mocks.push(mock)

    return mock
  }

  async removeAll(withOrgUsers?: boolean): Promise<void> {
    const ids = this.mocks.map(m => m.id)

    if (withOrgUsers) {
      await getDb()
        .deleteFrom('organization_user')
        .where('organization_id', 'in', ids)
        .execute()
    }

    if (!ids.length) return
    await getDb().deleteFrom('organization').where('id', 'in', ids).execute()
  }
}

/**
 * @deprecated Please import `OrganizationMock` instead.
 */
export const organizationMock = {
  id: '55555555-cd3f-4f6f-a343-fbbf2d1c44ee',
  name: 'Organization 1',
  slug: 'organization-1',
  description: 'Organization 1 description',
  link: 'https://example.com/organization-1',
  created_at: new Date(),
  created_by: 'auth0|62e4b12143e9885859dcf15d'
} satisfies Organization

export const ownerPermissionsMock = createOrgPermissions('owner')
export const memberPermissionsMock = createOrgPermissions('member')
export const nonMemberPermissionsMock = createOrgPermissions(null)
