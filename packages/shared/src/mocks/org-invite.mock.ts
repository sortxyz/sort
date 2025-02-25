import { randomUUID } from 'node:crypto'

import { getDb } from '../'

import type { OrganizationInvite } from '../schemas/org-invite.schema'

export class OrganizationInviteMock {
  mocks: OrganizationInvite[] = []

  create(values: Partial<OrganizationInvite> = {}) {
    const id = randomUUID()

    const mock = {
      id,
      organization_id: randomUUID(),
      created_at: new Date(),
      created_by: 'auth0|62e4b12143e9885859dcf15d',
      email: `org-invite-${id}@example.com`,
      name: `Organization invite ${id}`,
      role_id: 1,
      status: 'pending',
      ...values
    } as const

    this.mocks.push(mock)

    return mock
  }

  async removeAll(): Promise<void> {
    if (!this.mocks.length) return
    const ids = this.mocks.map(m => m.id)
    await getDb()
      .deleteFrom('organization_invite')
      .where('id', 'in', ids)
      .execute()
  }
}
