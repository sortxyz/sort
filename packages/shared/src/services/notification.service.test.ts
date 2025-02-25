import { randomUUID } from 'node:crypto'

import { createKysely, getDb, disconnectKysely } from '..'
import { ConnectionMock } from '../mocks/connection.mock'
import { MetadataDatabaseMock } from '../mocks/metadata.mock'
import { OrganizationMock } from '../mocks/org.mock'
import { UserMock } from '../mocks/user.mock'

import * as ConnectionService from './connection.service'
import * as DiscordService from './discord.service'
import * as MetadataDatabaseService from './kysely/metadata/database.service'
import * as NotificationService from './notification.service'
import * as OrganizationService from './org.service'
import * as SlackService from './slack.service'
import * as UserService from './user.service'

import type { MetadataDatabase } from '../types/__generated/kysely.type'
import type { Selectable } from 'kysely'

describe('NotificationService', () => {
  const userMock = new UserMock()
  const dbMock = new MetadataDatabaseMock()
  const connMock = new ConnectionMock()
  const orgMock = new OrganizationMock()

  const user1 = userMock.create({
    name: 'bob',
    email_verified: true
  })
  const user2 = userMock.create({
    name: 'alice',
    email_verified: true
  })
  const user3 = userMock.create({
    name: 'bob-not-verified',
    email_verified: false
  })
  const user4 = userMock.create({
    name: 'alice-not-verified',
    email_verified: false
  })
  const org = orgMock.create({
    created_by: user1.id
  })
  const publicConnMock = connMock.create({
    id: randomUUID(),
    created_by: user1.id,
    organization_id: org.id,
    data_provider: 'postgres',
    visibility: 'public'
  })
  const privateConnMock = connMock.create({
    id: randomUUID(),
    created_by: user1.id,
    organization_id: org.id,
    data_provider: 'postgres',
    visibility: 'private'
  })
  const privateDb = dbMock.create({
    organization_id: org.id,
    connection_id: privateConnMock.id
  })
  const publicDb = dbMock.create({
    organization_id: org.id,
    connection_id: publicConnMock.id
  })

  beforeAll(async () => {
    createKysely()

    await UserService.createUser(user1)
    await UserService.createUser(user2)
    await UserService.createUser(user3)
    await UserService.createUser(user4)
    await OrganizationService.create({
      ...org,
      created_by: user1.id
    })
    await OrganizationService.addMember(org.slug, user3.id, 'member')
    await OrganizationService.addMember(org.slug, user4.id, 'member')
    await ConnectionService.create(publicConnMock)
    await ConnectionService.create(privateConnMock)
    await MetadataDatabaseService.insertMetadataDb(getDb(), publicDb)
    await MetadataDatabaseService.insertMetadataDb(getDb(), privateDb)
  })

  const createMockLogger = () => {
    return {
      info: jest.fn(),
      error: jest.fn()
    }
  }

  afterAll(async () => {
    await connMock.removeAll()
    await getDb()
      .deleteFrom('organization_user')
      .where(
        'user_id',
        'in',
        userMock.mocks.map(u => u.id)
      )
      .execute()

    await dbMock.removeAll()
    await orgMock.removeAll()
    await userMock.removeAll()

    await disconnectKysely()
  })

  describe('getRecipients', () => {
    describe('when connection is public', () => {
      it('includes non-org members', async () => {
        const additionalRecipient = {
          name: 'tester',
          email: 'test-user@sort.xyz'
        }
        const { to, recipientVariables } =
          await NotificationService.getRecipients({
            dbSlug: publicDb.slug,
            orgSlug: org.slug,
            createdBy: user2.id,
            additionalRecipients: [additionalRecipient]
          })

        expect(to.sort()).toEqual([
          `${user2.name} <${user2.email}>`,
          `${user1.name} <${user1.email}>`,
          `${additionalRecipient.name} <${additionalRecipient.email}>`
        ])

        expect(recipientVariables).toEqual({
          [user2.email!]: { id: user2.email },
          [user1.email!]: { id: user1.email },
          [additionalRecipient.email]: { id: additionalRecipient.email }
        })
      })
    })

    describe('when connection is private', () => {
      it('does not include non-org members', async () => {
        const additionalRecipient = {
          name: 'tester',
          email: 'test-user@sort.xyz'
        }
        const { to, recipientVariables } =
          await NotificationService.getRecipients({
            dbSlug: privateDb.slug,
            orgSlug: org.slug,
            createdBy: user2.id,
            additionalRecipients: [additionalRecipient]
          })

        expect(to.sort()).toEqual([`${user1.name} <${user1.email}>`])

        expect(recipientVariables).toEqual({
          [user1.email!]: { id: user1.email }
        })
      })
    })
  })

  describe('sanitize', () => {
    it('escapes data', () => {
      const str = 'Sort&https://sort.xyz \'\'<script>alert("xss")</script>'
      const expected =
        'Sort&amp;sort-xyz &#39;&#39;&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      expect(NotificationService.sanitize(str)).toBe(expected)
    })
  })

  describe('isIgnoredMailgunError', () => {
    it('returns true for ignored errors', () => {
      const error = {
        message: 'Forbidden',
        details:
          'Domain sandbox7e4efdd6b47e4c2e934d48a4930dbffe.mailgun.org is not allowed to send: Sandbox subdomains are for test purposes only. Please add your own domain or add the address to authorized recipients in Account Settings.',
        status: 403
      } as Error & { status: number; details: string }

      expect(NotificationService.isIgnoredMailgunError(error)).toBe(true)
    })
  })

  describe('sendIssueNotification', () => {
    it('sends a user slack, analytics slack and discord notification', async () => {
      const logger = createMockLogger()

      const analyticsSlack = jest
        .spyOn(SlackService, 'sendAnalyticsSlackNotification')
        .mockResolvedValue(void 0)

      const userSlack = jest
        .spyOn(SlackService, 'sendSlackNotification')
        .mockResolvedValue(void 0)
      const discord = jest
        .spyOn(DiscordService, 'sendDiscordNotification')
        .mockResolvedValue(void 0)

      jest.spyOn(NotificationService, 'getRecipients').mockResolvedValue({
        to: [],
        recipientVariables: {}
      })

      jest
        .spyOn(NotificationService, 'sendEmailNotification')
        // @ts-expect-error we dont use this
        .mockResolvedValue({} as unknown)

      await NotificationService.sendIssueNotification({
        org,
        database: {} as unknown as Selectable<MetadataDatabase>,
        issue: { issue_number: 0, title: '', created_by: '' },
        htmlMessage: '',
        mdMessage: '',
        logger,
        additionalRecipients: [],
        initiatingUserEmail: '',
        source: ''
      })

      expect(analyticsSlack).toHaveBeenCalled()
      expect(userSlack).toHaveBeenCalled()
      expect(discord).toHaveBeenCalled()
    })
  })
})
