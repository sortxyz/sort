import { createKysely, disconnectKysely, getDb } from '../'
import { DatabaseUniquenessError } from '../errors/database-uniqueness.error'
import { UserMock } from '../mocks/user.mock'

import * as Mailgun from './mailgun.service'
import * as UserService from './user.service'

describe('v2/services/user.service', () => {
  const userMock = new UserMock()

  beforeAll(async () => {
    createKysely()
  })

  afterAll(async () => {
    await userMock.removeAll()
    await disconnectKysely()
  })

  beforeEach(async () => {
    await userMock.removeAll()
  })

  describe('createUser', () => {
    it('should create a user', async () => {
      const mock = userMock.create()
      const ret = await UserService.createUser(mock)
      expect(ret).toEqual({
        ...mock
      })
    })

    it('should throw a DatabaseUniquenessError if the id already exists', async () => {
      const mock = userMock.create()
      await UserService.createUser(mock)

      try {
        await UserService.createUser({
          ...mock,
          username: String(Math.random())
        })
        fail('expected an error')
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseUniquenessError)
        const err = error as DatabaseUniquenessError
        expect(err?.column).toBe('id')
        expect(err?.table).toBe('user')
      }
    })

    it('should throw a DatabaseUniquenessError if the username already exists', async () => {
      const mock = userMock.create()
      await UserService.createUser(mock)

      try {
        await UserService.createUser({
          ...mock,
          id: String(Math.random())
        })
        fail('expected an error')
      } catch (error) {
        expect(error).toBeInstanceOf(DatabaseUniquenessError)
        const err = error as DatabaseUniquenessError
        expect(err?.column).toBe('username')
        expect(err?.table).toBe('user')
      }
    })

    it('should throw an Error if a db connection error occurs', async () => {
      jest.spyOn(getDb(), 'insertInto').mockImplementationOnce(() => {
        throw new Error('shucks')
      })

      const mock = userMock.create()
      try {
        await UserService.createUser(mock)
        fail('expected an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(error).not.toBeInstanceOf(DatabaseUniquenessError)
        expect((error as Error)?.message).toBe('Error creating user')
      }
    })
  })

  describe('updateUserById', () => {
    it('should update a user', async () => {
      const mock = userMock.create()
      await UserService.createUser(mock)

      const updates = {
        name: String(Math.random()),
        picture: String(Math.random()),
        username: String(Math.random()),
        email: `test-user+${Math.random()}@sort.xyz`
      }

      const ret = await UserService.updateUserById(mock.id, updates)
      expect(ret).toEqual({
        ...mock,
        ...updates
      })

      const user = await getDb()
        .selectFrom('user')
        .where('id', '=', mock.id)
        .selectAll()
        .executeTakeFirst()

      expect(user).toEqual({
        ...mock,
        ...updates
      })
    })

    it('should return null if the user does not exist', async () => {
      const updates = {
        name: String(Math.random()),
        picture: String(Math.random()),
        username: String(Math.random())
      }

      const ret = await UserService.updateUserById(
        String(Math.random()),
        updates
      )
      expect(ret).toBeNull()
    })

    it('should throw an Error if a db connection error occurs', async () => {
      const mock = userMock.create()
      await UserService.createUser(mock)

      // eslint-disable-next-line @typescript-eslint/unbound-method
      const original = getDb().updateTable

      // cannot use jest.spyOn(KyselyService.db, 'updateTable') because TypeScript complains with
      // "Type instantiation is excessively deep and possibly infinite.
      const fn = jest.fn().mockImplementationOnce(() => {
        getDb().updateTable = original
        throw new Error('shucks')
      })

      getDb().updateTable = fn

      try {
        await UserService.updateUserById(mock.id, {
          name: String(Math.random())
        })
        fail('expected an error')
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect(error).not.toBeInstanceOf(DatabaseUniquenessError)
        expect((error as Error)?.message).toMatch(/Error updating user/)
      }
    })
  })

  describe('getUserById', () => {
    it('should return a user', async () => {
      const mock = userMock.create()
      await UserService.createUser(mock)

      const result = await UserService.getUserById(mock.id)

      expect(result?.id).toEqual(mock.id)
    })
  })

  describe('addToCustomerMailingList', () => {
    const subscriber = {
      address: `test-${Math.random()}@sort.xyz`,
      name: 'test',
      subscribed: true,
      vars: {}
    }
    const user = userMock.create({ email: subscriber.address })

    it('adds the given email to the customer mailing list', async () => {
      jest.spyOn(Mailgun, 'createClient').mockImplementationOnce(() => ({
        lists: {
          // @ts-expect-error - mocking mailgun client
          members: {
            createMember: () => Promise.resolve(subscriber)
          }
        }
      }))

      const result = UserService.addToCustomerMailingList(user)
      await expect(result).resolves.toEqual({ added: true })
    })

    it('returns { added: false } when the email is already on the mailing list', async () => {
      jest.spyOn(Mailgun, 'createClient').mockImplementationOnce(() => ({
        lists: {
          // @ts-expect-error - mocking mailgun client
          members: {
            createMember: () => {
              const err = new Error('fail')
              // @ts-expect-error - mocking mailgun error
              err.status = 400
              // @ts-expect-error - mocking mailgun error
              err.details = 'Address already exists'

              throw err
            }
          }
        }
      }))

      const result = UserService.addToCustomerMailingList(user)
      await expect(result).resolves.toEqual({ added: false })
    })

    it('throws an error when the client fails', async () => {
      const failure = new Error('fail')

      jest.spyOn(Mailgun, 'createClient').mockImplementationOnce(() => ({
        lists: {
          // @ts-expect-error - mocking mailgun client
          members: {
            createMember: () => {
              throw failure
            }
          }
        }
      }))

      const result = UserService.addToCustomerMailingList(user)
      await expect(result).rejects.toThrow(failure)
    })
  })

  describe('removeFromCustomerMailingList', () => {
    const subscriber = {
      address: `test-${Math.random()}@sort.xyz`,
      name: 'test',
      subscribed: true,
      vars: {}
    }
    const user = userMock.create({ email: subscriber.address })

    it('removes the given email from the customer mailing list', async () => {
      jest.spyOn(Mailgun, 'createClient').mockImplementationOnce(() => ({
        lists: {
          // @ts-expect-error - mocking mailgun client
          members: {
            destroyMember: () => {
              return Promise.resolve({
                member: subscriber,
                message: 'Mailing list member has been deleted'
              })
            }
          }
        }
      }))

      const result = UserService.removeFromCustomerMailingList(user)
      await expect(result).resolves.toEqual(undefined)
    })

    it('gracefully handles when the email was not on the list', async () => {
      jest.spyOn(Mailgun, 'createClient').mockImplementationOnce(() => ({
        lists: {
          // @ts-expect-error - mocking mailgun client
          members: {
            destroyMember: () => {
              return Promise.reject({
                status: 404,
                details: 'Member such-and-such not found'
              })
            }
          }
        }
      }))

      const result = UserService.removeFromCustomerMailingList(user)
      await expect(result).resolves.toEqual(undefined)
    })

    it('throws an error when the client fails', async () => {
      const failure = new Error('fail')

      jest.spyOn(Mailgun, 'createClient').mockImplementationOnce(() => ({
        lists: {
          // @ts-expect-error - mocking mailgun client
          members: {
            destroyMember: () => {
              throw failure
            }
          }
        }
      }))

      const result = UserService.removeFromCustomerMailingList(user)
      await expect(result).rejects.toThrow(failure)
    })
  })

  describe('getMailingListSubscriptions', () => {
    describe('when user email does not exist', () => {
      it('returns an empty array', async () => {
        const user = userMock.create({ email: null })
        const result = await UserService.getMailingListSubscriptions(user)
        expect(result).toEqual([])
      })
    })

    describe('when user email is not verified', () => {
      it('returns an empty array', async () => {
        const user = userMock.create({
          email: 'testing@sort.xyz',
          email_verified: false
        })
        const result = await UserService.getMailingListSubscriptions(user)
        expect(result).toEqual([])
      })
    })

    describe('when user is on the mailing list', () => {
      const subscriber = {
        address: `test-${Math.random()}@sort.xyz`,
        name: 'ms test',
        subscribed: true,
        vars: {}
      }
      const user = userMock.create({
        email: subscriber.address,
        email_verified: true
      })

      it('returns the subscription', async () => {
        jest.spyOn(Mailgun, 'createClient').mockImplementationOnce(() => ({
          lists: {
            // @ts-expect-error - mocking mailgun client
            members: {
              getMember: () => Promise.resolve(subscriber)
            }
          }
        }))

        const result = UserService.getMailingListSubscriptions(user)
        await expect(result).resolves.toEqual([
          {
            name: 'newsletter',
            email: subscriber.address,
            subscribed: true
          }
        ])
      })
    })

    describe('when user not is on the mailing list', () => {
      const user = userMock.create({
        email: `test-${Math.random()}@sort.xyz`,
        email_verified: true
      })

      it('returns the subscription', async () => {
        jest.spyOn(Mailgun, 'createClient').mockImplementationOnce(() => ({
          lists: {
            // @ts-expect-error - mocking mailgun client
            members: {
              getMember: () => {
                return Promise.reject({
                  status: 404,
                  details: 'Member such-and-such not found'
                })
              }
            }
          }
        }))

        const result = UserService.getMailingListSubscriptions(user)
        await expect(result).resolves.toEqual([
          {
            name: 'newsletter',
            email: user.email,
            subscribed: false
          }
        ])
      })
    })
  })

  describe('trackLogin', () => {
    it('sets user terms acceptance date and increments login count', async () => {
      const mock = userMock.create()
      await UserService.createUser(mock)

      const ret = await UserService.trackLogin(mock)
      expect(ret).toEqual({
        ...mock,
        login_count: 1,
        terms_accepted_at: expect.any(Date)
      })

      await UserService.trackLogin(mock)

      const user = await getDb()
        .selectFrom('user')
        .where('id', '=', mock.id)
        .selectAll()
        .executeTakeFirstOrThrow()

      expect(user).toEqual({
        ...mock,
        login_count: 2,
        terms_accepted_at: expect.any(Date)
      })

      expect(Number(user.terms_accepted_at)).toBeGreaterThan(
        Number(ret.terms_accepted_at)
      )
    })
  })
})
