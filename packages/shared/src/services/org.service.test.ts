/* eslint-disable @typescript-eslint/no-explicit-any */

import * as crypto from 'node:crypto'

import { getDb, createKysely, disconnectKysely } from '../'
import { DEFAULT_ORG_DESCRIPTION } from '../constants/metadata.constant'
import { ConnectionMock } from '../mocks/connection.mock'
import { IssueMock } from '../mocks/issue.mock'
import { MetadataDatabaseMock } from '../mocks/metadata.mock'
import { OrganizationInviteMock } from '../mocks/org-invite.mock'
import {
  OrganizationMock,
  ownerPermissionsMock,
  memberPermissionsMock,
  nonMemberPermissionsMock
} from '../mocks/org.mock'
import { UserMock } from '../mocks/user.mock'
import { isErrnoException } from '../utils'

import * as ConnectionService from './connection.service'
import * as IssueService from './issue.service'
import * as MetadataDatabaseService from './kysely/metadata/database.service'
import * as OrganizationInviteService from './org-invite.service'
import * as OrganizationService from './org.service'
import * as UserService from './user.service'

import type { DatabaseUniquenessError } from '../errors/database-uniqueness.error'

const causeKyselyToFail = (
  methodName: 'insertInto' | 'selectFrom' | 'updateTable' | 'transaction'
) => {
  // Can't use jest.spyOn + mockImplementationOnce() b/c we receive
  // "Type instantiation is excessively deep and possibly infinite."
  const original = getDb()[methodName]
  getDb()[methodName] = () => {
    // @ts-expect-error intentional override
    getDb()[methodName] = original
    throw new Error('fake error')
  }
}

describe('v2/services/organization.service', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const connMock = new ConnectionMock()
  const issueMock = new IssueMock()
  const orgInviteMock = new OrganizationInviteMock()

  beforeAll(async () => {
    createKysely()
  })

  afterAll(async () => {
    await orgInviteMock.removeAll()
    await getDb()
      .deleteFrom('organization_user')
      .where(
        'organization_id',
        'in',
        orgMock.mocks.map(m => m.id)
      )
      .execute()
    await orgMock.removeAll()
    await userMock.removeAll()
    await connMock.removeAll()
    await dbMock.removeAll()
    await issueMock.removeAll()
    await orgInviteMock.removeAll()
    await disconnectKysely()
  })

  describe('getMyOrganizations', () => {
    it('should retrieve the organizations to which the user belongs', async () => {
      const user = userMock.create()
      await UserService.createUser(user)

      const orgMock1 = orgMock.create({
        name: 'org1',
        created_by: user.id
      })
      await OrganizationService.create(orgMock1)

      const orgMock2 = orgMock.create({
        created_by: user.id
      })
      await OrganizationService.create(orgMock2)

      const user2 = userMock.create()
      await UserService.createUser(user2)
      const orgMock3 = orgMock.create({
        created_by: user2.id
      })
      await OrganizationService.create(orgMock3)
      await OrganizationService.addMember(orgMock3.slug, user.id, 'member')

      const orgs = await OrganizationService.getMyOrganizations(user.id)
      expect(orgs.length).toEqual(3)
      expect(orgs).toContainEqual({
        ...orgMock1,
        permissions: ownerPermissionsMock
      })
      expect(orgs).toContainEqual({
        ...orgMock2,
        permissions: ownerPermissionsMock
      })
      expect(orgs).toContainEqual({
        ...orgMock3,
        permissions: memberPermissionsMock
      })
    })

    it('should respond with an empty array when provided an id which does not exist', async () => {
      const orgs = await OrganizationService.getMyOrganizations(
        crypto.randomUUID()
      )
      expect(orgs).toHaveLength(0)
    })

    it('should respond with an empty array when provided an empty string id', async () => {
      const orgs = await OrganizationService.getMyOrganizations('')
      expect(orgs).toHaveLength(0)
    })
  })

  describe('getBySlug', () => {
    it('should retrieve the organization with the given slug', async () => {
      const user = userMock.create()
      await UserService.createUser(user)

      const orgMock1 = orgMock.create({
        created_by: user.id
      })
      await OrganizationService.create(orgMock1)

      const orgMock2 = orgMock.create({
        created_by: user.id
      })
      await OrganizationService.create(orgMock2)

      const org = await OrganizationService.getBySlug(orgMock1.slug, user.id)
      expect(org).toEqual({
        ...orgMock1,
        permissions: ownerPermissionsMock
      })
    })

    it('should respond with null when provided a slug which does not exist', async () => {
      const user = userMock.create()
      await UserService.createUser(user)

      const org = await OrganizationService.getBySlug(
        crypto.randomUUID(),
        user.id
      )
      expect(org).toBeUndefined()
    })

    it('should respond with null when provided an empty string', async () => {
      const user = userMock.create()
      await UserService.createUser(user)

      const org = await OrganizationService.getBySlug('', user.id)
      expect(org).toBeUndefined()
    })

    it('should respond with restrictive permissions when provided a userId who does not belong', async () => {
      const user = userMock.create()
      await UserService.createUser(user)

      const orgMock1 = orgMock.create({
        name: 'org1',
        created_by: user.id
      })
      await OrganizationService.create(orgMock1)

      const org = await OrganizationService.getBySlug(orgMock1.slug, '')
      expect(org).toEqual({
        ...orgMock1,
        permissions: nonMemberPermissionsMock
      })
    })
  })

  describe('getBySlugForInvite', () => {
    it('should retrieve the organization with the given slug', async () => {
      const user = userMock.create()
      await UserService.createUser(user)

      const orgMock1 = orgMock.create({
        name: 'org1',
        created_by: user.id
      })
      await OrganizationService.create(orgMock1)

      const orgMock2 = orgMock.create({
        created_by: user.id
      })

      const inviteMock = orgInviteMock.create({
        created_by: user.id,
        email: 'test-user@sort.xyz',
        name: 'Test User',
        organization_id: orgMock1.id,
        role_id: 0,
        status: 'pending'
      })
      await OrganizationService.create(orgMock2)
      await OrganizationInviteService.create(inviteMock)

      const org = await OrganizationService.getBySlugForInvite(
        orgMock1.slug,
        inviteMock.id
      )
      expect(org).toEqual(orgMock1)
    })
  })

  describe('getById', () => {
    it('should retrieve the organization with the given id', async () => {
      const user = userMock.create()
      await UserService.createUser(user)

      const org1 = orgMock.create({
        name: 'org1',
        created_by: user.id
      })
      await OrganizationService.create(org1)

      const org2 = orgMock.create({
        created_by: user.id
      })
      await OrganizationService.create(org2)

      const org = await OrganizationService.getById(org1.id)
      expect(org).toEqual(org1)
    })

    it('should respond with undefined when provided an id which does not exist', async () => {
      const org = await OrganizationService.getById(crypto.randomUUID())
      expect(org).toBeUndefined()
    })

    it('should respond with null when provided an empty string', async () => {
      const org = await OrganizationService.getById('')
      expect(org).toBeUndefined()
    })
  })

  describe('create', () => {
    it('should create and return the new organization', async () => {
      const user = userMock.create()
      await UserService.createUser(user)

      const orgMock1 = orgMock.create({
        name: 'org1',
        created_by: user.id
      })
      const result = await OrganizationService.create(orgMock1)

      expect(result).toEqual(orgMock1)
    })

    describe('when description or link are empty strings', () => {
      it('should create the new organization w/ link set to null and description set to the default', async () => {
        const user = userMock.create()
        await UserService.createUser(user)

        const orgMock1 = orgMock.create({
          description: '',
          link: '',
          name: 'org1',
          created_by: user.id
        })

        const result = await OrganizationService.create(orgMock1)
        expect(result?.description).toBe(DEFAULT_ORG_DESCRIPTION)
        expect(result?.link).toBeNull()
      })
    })

    it('should disallow duplicate slugs in organizations', async () => {
      const user = userMock.create()
      await UserService.createUser(user)

      const orgMock1 = orgMock.create({
        name: 'org1',
        created_by: user.id
      })
      await OrganizationService.create(orgMock1)

      let error = null

      try {
        await OrganizationService.create(
          orgMock.create({ slug: orgMock1.slug })
        )
      } catch (err) {
        error = err as DatabaseUniquenessError
      }

      expect(error).toBeTruthy()
      expect(error?.message).toBe('Organization already exists')
      expect(error?.table).toEqual('organization')
      expect(error?.column).toBe('slug')
    })
  })

  describe('removeBySlug', () => {
    describe('when slug is empty', () => {
      it('throws an error', async () => {
        await expect(OrganizationService.removeBySlug('')).rejects.toThrow(
          'slug cannot be empty'
        )
      })
    })

    describe('when provided a valid slug', () => {
      it('should remove the organization with the given slug and all related organization_user records', async () => {
        const user = userMock.create()
        await UserService.createUser(user)

        const orgMock1 = orgMock.create({
          name: 'org1',
          created_by: user.id
        })
        await OrganizationService.create(orgMock1)

        const orgMock2 = orgMock.create({
          created_by: user.id
        })
        await OrganizationService.create(orgMock2)

        await OrganizationService.removeBySlug(orgMock1.slug)

        const org = await OrganizationService.getBySlug(orgMock1.slug, user.id)
        expect(org).toBe(undefined)

        const org2 = await OrganizationService.getBySlug(orgMock2.slug, user.id)
        expect(org2).not.toBe(undefined)
      })
    })

    describe('when provided a slug which does not exist', () => {
      it('leaves all records intact', async () => {
        const user = userMock.create()
        await UserService.createUser(user)

        const orgMock1 = orgMock.create({
          name: 'org1',
          created_by: user.id
        })
        await OrganizationService.create(orgMock1)

        const orgMock2 = orgMock.create({
          created_by: user.id
        })
        await OrganizationService.create(orgMock2)

        await OrganizationService.removeBySlug(String(Math.random()))

        const org1 = await OrganizationService.getBySlug(orgMock1.slug, user.id)
        expect(org1).not.toBe(null)

        const org2 = await OrganizationService.getBySlug(orgMock2.slug, user.id)
        expect(org2).not.toBe(null)
      })
    })

    describe('when a database error occurs', () => {
      it('rolls back all changes and throws an error', async () => {
        const user = userMock.create()
        await UserService.createUser(user)

        const orgMock1 = orgMock.create({
          name: 'org1',
          created_by: user.id
        })
        await OrganizationService.create(orgMock1)

        const orgMock2 = orgMock.create({
          created_by: user.id
        })
        await OrganizationService.create(orgMock2)

        causeKyselyToFail('transaction')

        await expect(
          OrganizationService.removeBySlug(orgMock2.slug)
        ).rejects.toThrow(
          `Error deleting organization with slug: ${orgMock2.slug}`
        )

        const org1 = await OrganizationService.getBySlug(orgMock1.slug, user.id)
        expect(org1).not.toBe(undefined)

        const org2 = await OrganizationService.getBySlug(orgMock2.slug, user.id)
        expect(org2).not.toBe(undefined)
      })
    })
  })

  describe('updateBySlug', () => {
    describe('when slug is empty', () => {
      it('throws an error', async () => {
        let err: Error | null = null

        try {
          await OrganizationService.updateBySlug('', {
            name: 'new name',
            link: 'https://www.example.com/new-name',
            description: 'new-description',
            slug: 'new-slug'
          })
        } catch (error) {
          err = error as Error
        }

        expect(err?.message).toBe('slug cannot be empty.')
      })
    })

    describe('when no updates are provided', () => {
      it('throws an error', async () => {
        let err: Error | null = null

        try {
          await OrganizationService.updateBySlug('some-slug', {})
        } catch (error) {
          err = error as Error
        }

        expect(err?.message).toBe(
          'At least one field is required to update an organization.'
        )
      })
    })

    describe('when all necessary params are provided', () => {
      describe('when the slug matches an existing organization', () => {
        it('changes the org in the database', async () => {
          const user = userMock.create()
          await UserService.createUser(user)

          const org1 = orgMock.create({
            name: 'org1',
            created_by: user.id
          })
          await OrganizationService.create(org1)

          const newValues = {
            name: 'new name',
            link: 'https://www.example.com/new-name',
            description: 'new-description',
            slug: String(Math.random()),
            banner: '<marquee>hello</marquee>',
            slack_webhook_url: 'https://hooks.slack.com/services/1234567890',
            discord_webhook_url: 'https://discord.com/api/webhooks/1234567890'
          }

          await OrganizationService.updateBySlug(org1.slug, newValues)

          const org = await OrganizationService.getBySlug(org1.slug, user.id)
          expect(org).toBe(undefined)

          const newOrg = await OrganizationService.getBySlug(
            newValues.slug,
            user.id
          )
          expect(newOrg?.description).toBe(newValues.description)
          expect(newOrg?.name).toBe(newValues.name)
          expect(newOrg?.slug).toBe(newValues.slug)
          expect(newOrg?.link).toBe(newValues.link)
          expect(newOrg?.banner).toBe(newValues.banner)
          expect(newOrg?.slack_webhook_url).toBe(newValues.slack_webhook_url)
          expect(newOrg?.discord_webhook_url).toBe(
            newValues.discord_webhook_url
          )
        })
      })

      describe('when the slug does not match an existing organization', () => {
        it('throws an error', async () => {
          const invalidSlug = String(Math.random())

          await expect(() =>
            OrganizationService.updateBySlug(invalidSlug, {
              description: 'new-description'
            })
          ).rejects.toThrowError(
            `Error updating organization with slug: ${invalidSlug}`
          )
        })
      })

      describe('when link, description and banner are set to null', () => {
        it('updates the organization properties to null', async () => {
          const user = userMock.create()
          await UserService.createUser(user)

          const orgMock1 = orgMock.create({
            name: 'org1',
            created_by: user.id,
            link: 'https://sort.xyz',
            description: 'my description',
            banner: '<marquee>hello</marquee>'
          })
          await OrganizationService.create(orgMock1)

          const newValues = {
            link: null,
            description: null,
            banner: null
          }

          await OrganizationService.updateBySlug(orgMock1.slug, newValues)

          const newOrg = await OrganizationService.getBySlug(
            orgMock1.slug,
            user.id
          )
          expect(newOrg?.description).toBeNull()
          expect(newOrg?.link).toBeNull()
          expect(newOrg?.banner).toBeNull()
        })
      })
    })

    describe('when a database error occurs', () => {
      it('rejects with an error', async () => {
        causeKyselyToFail('updateTable')

        try {
          await OrganizationService.updateBySlug('something', { name: 'HMB' })
          fail('Expected error to be thrown')
        } catch (error) {
          if (!isErrnoException(error)) {
            fail('Expected error to be an ErrnoException')
          }
          expect(error.message).toBe(
            'Error updating organization with slug: something'
          )
          if (!(error.cause instanceof Error)) {
            fail('Expected error.cause to be an Error')
          }
          expect(error.cause.message).toBe('fake error')
        }
      })
    })
  })

  describe('getUserRole', () => {
    describe('when userId is set to an empty string', () => {
      it('throws an error', async () => {
        await expect(
          OrganizationService.getUserRoleName({ userId: '', slug: 'slug' })
        ).rejects.toThrow('userId cannot be empty')
      })
    })

    describe('when slug is set to an empty string', () => {
      it('throws an error', async () => {
        await expect(
          OrganizationService.getUserRoleName({ userId: 'my-id', slug: '' })
        ).rejects.toThrow('slug cannot be empty')
      })
    })

    describe('when valid input is passed', () => {
      describe('when the user is in the organization', () => {
        it('returns the role of the user', async () => {
          const user = userMock.create()
          await UserService.createUser(user)

          const orgMock1 = orgMock.create({
            name: 'org1',
            created_by: user.id
          })
          await OrganizationService.create(orgMock1)

          await expect(
            OrganizationService.getUserRoleName({
              userId: user.id,
              slug: orgMock1.slug
            })
          ).resolves.toBe('owner')
        })
      })

      describe('when the user is not in the organization', () => {
        it('returns undefined', async () => {
          const user = userMock.create()
          await UserService.createUser(user)

          const orgMock1 = orgMock.create({
            name: 'org1',
            created_by: user.id
          })
          await OrganizationService.create(orgMock1)

          const user2 = userMock.create()
          await UserService.createUser(user2)

          await expect(
            OrganizationService.getUserRoleName({
              userId: user2.id,
              slug: orgMock1.slug
            })
          ).resolves.toEqual(undefined)
        })
      })

      describe('when a database error occurs', () => {
        it('throws an error', async () => {
          causeKyselyToFail('selectFrom')

          await expect(
            OrganizationService.getUserRoleName({
              userId: 'my-id',
              slug: 'something'
            })
          ).rejects.toThrow('Error getting user organization role.')
        })
      })
    })
  })

  describe('isOwnerBySlug', () => {
    describe('when the user is an owner of the org', () => {
      it('resolves true', async () => {
        const user = userMock.create()
        await UserService.createUser(user)

        const orgMock1 = orgMock.create({
          name: 'org1',
          created_by: user.id
        })
        await OrganizationService.create(orgMock1)

        await expect(
          OrganizationService.isOwnerBySlug({
            userId: user.id,
            slug: orgMock1.slug
          })
        ).resolves.toBe(true)
      })
    })

    describe('when the user is not an owner of the org', () => {
      it('resolves false', async () => {
        const user1 = userMock.create()
        await UserService.createUser(user1)

        const user2 = userMock.create()
        await UserService.createUser(user2)

        const orgMock1 = orgMock.create({
          name: 'org1',
          created_by: user2.id
        })
        await OrganizationService.create(orgMock1)

        await expect(
          OrganizationService.isOwnerBySlug({
            userId: user1.id,
            slug: orgMock1.slug
          })
        ).resolves.toBe(false)
      })
    })
  })

  describe('getMembers', () => {
    describe('when the slug is an empty string', () => {
      it('throws an error', async () => {
        await expect(OrganizationService.getMembers('')).rejects.toThrow(
          'slug cannot be empty'
        )
      })
    })

    describe('when members belong', () => {
      it('returns the members', async () => {
        const user1 = userMock.create({ id: '1' })
        await UserService.createUser(user1)

        const orgMock1 = orgMock.create({
          created_by: user1.id
        })
        await OrganizationService.create(orgMock1)

        const user2 = userMock.create({ id: '0' })
        await UserService.createUser(user2)

        await OrganizationService.addMember(orgMock1.slug, user2.id, 'member')

        const members = await OrganizationService.getMembers(orgMock1.slug)

        expect(members).toHaveLength(2)
        expect(members).toContainEqual({
          user: {
            id: user1.id,
            name: user1.name,
            username: user1.username,
            picture: user1.picture
          },
          role: { id: 0, name: 'owner' }
        })
        expect(members).toContainEqual({
          user: {
            id: user2.id,
            name: user2.name,
            username: user2.username,
            picture: user2.picture
          },
          role: { id: 1, name: 'member' }
        })
      })
    })

    describe('when a database error occurs', () => {
      it('throws an error', async () => {
        causeKyselyToFail('selectFrom')

        await expect(
          OrganizationService.getMembers('banana-slug')
        ).rejects.toThrow('fake error')
      })
    })

    describe('when issue IDs are provided', () => {
      it('returns the members associated with that issue', async () => {
        const user1 = userMock.create()
        const user2 = userMock.create()
        const org = orgMock.create({ created_by: user1.id })
        const conn = connMock.create({
          organization_id: org.id,
          created_by: user1.id
        })
        const dbEntry = dbMock.create({
          organization_id: org.id,
          connection_id: conn.id
        })

        await UserService.createUser(user1)
        await UserService.createUser(user2)
        await OrganizationService.create(org)
        await OrganizationService.addMember(org.slug, user2.id, 'member')
        await ConnectionService.create(conn)
        await MetadataDatabaseService.insertMetadataDb(getDb(), dbEntry)

        const orgMemberRows =
          await OrganizationService.createGetMembersBaseQueryBuilder(org.slug)
            .where('user.id', 'in', [user1.id, user2.id])
            .execute()

        const orgMembers = orgMemberRows.map(
          OrganizationService.rowToOrganizationMember
        )

        const mockIssue1 = issueMock.create({
          connection_id: conn.id,
          database_name: dbEntry.raw_name,
          created_by: user1.id,
          assignees: [orgMembers[0]]
        })

        const mockIssue2 = issueMock.create({
          connection_id: conn.id,
          database_name: dbEntry.raw_name,
          created_by: user1.id,
          assignees: [orgMembers[1]]
        })

        await IssueService.createIssue(mockIssue1)
        await IssueService.createIssue(mockIssue2)

        const issueAssigneeRows =
          await OrganizationService.createGetMembersBaseQueryBuilder(org.slug)
            .innerJoin('issue_assignee', 'issue_assignee.user_id', 'user.id')
            .where('issue_assignee.issue_id', 'in', [
              mockIssue1.id,
              mockIssue2.id
            ])
            .select('issue_assignee.issue_id')
            .execute()

        const issueAssignees = issueAssigneeRows.map(
          OrganizationService.rowToOrganizationMember
        )

        expect(issueAssignees).toHaveLength(2)

        expect(issueAssignees).toEqual(expect.arrayContaining(orgMembers))
      })
    })

    describe('addMember', () => {
      describe('when the slug is an empty string', () => {
        it('throws an error', async () => {
          await expect(
            OrganizationService.addMember('', 'user', 'member')
          ).rejects.toThrow('slug cannot be empty')
        })
      })

      describe('when the userId is an empty string', () => {
        it('throws an error', async () => {
          await expect(
            OrganizationService.addMember('slug', '', 'owner')
          ).rejects.toThrow('userId cannot be empty')
        })
      })

      describe('when the roleName is an empty string', () => {
        it('throws an error', async () => {
          await expect(
            // @ts-expect-error testing runtime error
            OrganizationService.addMember('slug', 'owner', '')
          ).rejects.toThrow('roleName cannot be empty')
        })
      })

      describe('when all arguments are passed', () => {
        describe('when the user is not already a member', () => {
          it('adds the member', async () => {
            const user1 = userMock.create()
            await UserService.createUser(user1)

            const org1 = orgMock.create({
              created_by: user1.id
            })
            await OrganizationService.create(org1)

            const user2 = userMock.create()
            await UserService.createUser(user2)

            await OrganizationService.addMember(org1.slug, user2.id, 'member')

            const members = await OrganizationService.getMembers(org1.slug)

            expect(members.length).toEqual(2)
            expect(members).toContainEqual({
              user: {
                id: user1.id,
                name: user1.name,
                username: user1.username,
                picture: user1.picture
              },
              role: { id: 0, name: 'owner' }
            })

            expect(members).toContainEqual({
              user: {
                id: user2.id,
                name: user2.name,
                username: user2.username,
                picture: user2.picture
              },
              role: { id: 1, name: 'member' }
            })
          })
        })

        describe('when the user is already a member', () => {
          it('makes no changes', async () => {
            const user1 = userMock.create()
            await UserService.createUser(user1)

            const org1 = orgMock.create({
              created_by: user1.id
            })
            await OrganizationService.create(org1)

            const user2 = userMock.create()
            await UserService.createUser(user2)

            await OrganizationService.addMember(org1.slug, user2.id, 'member')

            await OrganizationService.addMember(org1.slug, user2.id, 'member')

            const members = await OrganizationService.getMembers(org1.slug)

            expect(members).toHaveLength(2)
            expect(members).toContainEqual({
              user: {
                id: user1.id,
                name: user1.name,
                username: user1.username,
                picture: user1.picture
              },
              role: { id: 0, name: 'owner' }
            })
            expect(members).toContainEqual({
              user: {
                id: user2.id,
                name: user2.name,
                username: user2.username,
                picture: user2.picture
              },
              role: { id: 1, name: 'member' }
            })
          })
        })
      })

      describe('when a database error occurs', () => {
        it('throws an error', async () => {
          causeKyselyToFail('insertInto')

          await expect(
            OrganizationService.addMember('something', 'my-id', 'member')
          ).rejects.toThrow('Error adding user to organization.')
        })
      })
    })

    describe('removeMember', () => {
      describe('when the slug is an empty string', () => {
        it('throws an error', async () => {
          await expect(
            OrganizationService.removeMember('', 'user')
          ).rejects.toThrow('slug cannot be empty')
        })
      })

      describe('when the username is an empty string', () => {
        it('throws an error', async () => {
          await expect(
            OrganizationService.removeMember('slug', '')
          ).rejects.toThrow('username cannot be empty')
        })
      })

      describe('when the slug does not match an org', () => {
        it('does not change the db', async () => {
          const user1 = userMock.create()
          await UserService.createUser(user1)

          const org1 = orgMock.create({
            created_by: user1.id
          })
          await OrganizationService.create(org1)

          await OrganizationService.removeMember(
            `not-${org1.slug}`,
            user1.username
          )

          const members = await OrganizationService.getMembers(org1.slug)

          expect(members).toEqual([
            {
              user: {
                id: user1.id,
                name: user1.name,
                username: user1.username,
                picture: user1.picture
              },
              role: { id: 0, name: 'owner' }
            }
          ])
        })
      })

      describe('when the username is not a member of the org', () => {
        it('does not change the db', async () => {
          const user1 = userMock.create()
          await UserService.createUser(user1)

          const org1 = orgMock.create({
            created_by: user1.id
          })
          await OrganizationService.create(org1)

          await OrganizationService.removeMember(
            org1.slug,
            `not-${user1.username}`
          )

          const members = await OrganizationService.getMembers(org1.slug)

          expect(members).toEqual([
            {
              user: {
                id: user1.id,
                name: user1.name,
                username: user1.username,
                picture: user1.picture
              },
              role: { id: 0, name: 'owner' }
            }
          ])
        })
      })

      describe('when the username is a member of the org', () => {
        describe('and not the last owner', () => {
          it('removes the member from the organization_user table', async () => {
            const user1 = userMock.create()
            await UserService.createUser(user1)

            const org1 = orgMock.create({
              created_by: user1.id
            })
            await OrganizationService.create(org1)

            const user2 = userMock.create()
            await UserService.createUser(user2)
            await OrganizationService.addMember(org1.slug, user2.id, 'member')

            await OrganizationService.removeMember(org1.slug, user2.username)

            const members = await OrganizationService.getMembers(org1.slug)

            expect(members).toEqual([
              {
                user: {
                  id: user1.id,
                  name: user1.name,
                  username: user1.username,
                  picture: user1.picture
                },
                role: { id: 0, name: 'owner' }
              }
            ])
          })
        })

        describe('and is the last owner of the org', () => {
          it('throws an error', async () => {
            const user1 = userMock.create()
            await UserService.createUser(user1)

            const org1 = orgMock.create({
              created_by: user1.id
            })
            await OrganizationService.create(org1)

            try {
              await OrganizationService.removeMember(org1.slug, user1.username)
              fail('Expected an error')
            } catch (err) {
              expect(err).toBeInstanceOf(Error)

              const error = err as Error
              expect(error.cause).toBeInstanceOf(
                OrganizationService.OrgOwnerRequiredError
              )
            }
          })
        })
      })

      describe('when a database error occurs', () => {
        it('throws an error', async () => {
          causeKyselyToFail('transaction')

          await expect(
            OrganizationService.removeMember('my-id', 'something')
          ).rejects.toThrow('Error removing user from organization.')
        })
      })
    })
  })
})
