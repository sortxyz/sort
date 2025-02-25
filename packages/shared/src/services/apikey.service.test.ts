import { createKysely, disconnectKysely } from '../bootstrap'
import { APIKeyMock } from '../mocks/apikey.mock'
import { UserMock } from '../mocks/user.mock'
import * as UserService from '../services/user.service'

import * as APIKeyService from './apikey.service'

describe('apikey.service', () => {
  const apiKeyMock = new APIKeyMock()
  const userMock = new UserMock()

  beforeAll(async () => {
    createKysely()

    const user = userMock.create()
    await UserService.createUser(user)

    const apiKey = await APIKeyService.createAPIKey({
      userId: user.id
    })
    apiKeyMock.addId(apiKey.id)
  })

  afterAll(async () => {
    await apiKeyMock.removeAll()
    await userMock.removeAll()
    await disconnectKysely()
  })

  describe('createAPIKey', () => {
    it('should create an API key', async () => {
      const user = userMock.create()
      await UserService.createUser(user)

      const summary = 'hello super mario world'

      const apiKey = await APIKeyService.createAPIKey({
        userId: user.id,
        summary
      })

      apiKeyMock.addId(apiKey.id)

      expect(apiKey).toEqual({
        id: expect.any(String),
        summary,
        api_key: expect.any(String),
        created_at: expect.any(Date),
        updated_at: expect.any(Date)
      })
    })

    it('honors the given args', async () => {
      const user = userMock.create()
      await UserService.createUser(user)

      const summary = 'hello super mario world'
      const salt = 'abc'
      const plainTextKey = '123'
      const rowId = 'a5adecc4-7793-413c-be86-a69eb905d231'
      apiKeyMock.addId(rowId)

      const apiKey1 = await APIKeyService.createAPIKey({
        userId: user.id,
        summary,
        salt,
        plainTextKey,
        rowId
      })
      await APIKeyService.deleteAPIKey({ id: apiKey1.id, userId: user.id })

      const apiKey2 = await APIKeyService.createAPIKey({
        userId: user.id,
        summary,
        salt,
        plainTextKey,
        rowId
      })
      await APIKeyService.deleteAPIKey({ id: apiKey2.id, userId: user.id })
      expect(apiKey1.api_key).toEqual(apiKey2.api_key)
    })
  })

  describe('listAPIKeys', () => {
    it('should list all API keys for a user', async () => {
      const user = userMock.create()
      await UserService.createUser(user)

      const apiKey1 = await APIKeyService.createAPIKey({
        userId: user.id
      })
      apiKeyMock.addId(apiKey1.id)

      const apiKey2 = await APIKeyService.createAPIKey({
        userId: user.id
      })
      apiKeyMock.addId(apiKey2.id)

      const keys = await APIKeyService.listAPIKeys({ userId: user.id })
      expect(keys).toHaveLength(2)

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { api_key: ignore1, ...key1 } = apiKey1
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { api_key: ignore2, ...key2 } = apiKey2

      expect(keys).toEqual(expect.arrayContaining([key1, key2]))
    })
  })

  describe('deleteAPIKey', () => {
    it('should delete an API key', async () => {
      const user = userMock.create()
      await UserService.createUser(user)

      const apiKey = await APIKeyService.createAPIKey({
        userId: user.id
      })
      apiKeyMock.addId(apiKey.id)

      await APIKeyService.deleteAPIKey({
        id: apiKey.id,
        userId: user.id
      })

      const keys = await APIKeyService.listAPIKeys({ userId: user.id })
      expect(keys).toHaveLength(0)
    })
  })

  describe('updateAPIKey', () => {
    it('should update an API key', async () => {
      const user = userMock.create()
      await UserService.createUser(user)

      const apiKey = await APIKeyService.createAPIKey({
        userId: user.id
      })
      apiKeyMock.addId(apiKey.id)

      // make sure the updated_at is different
      await new Promise(resolve => setTimeout(resolve, 50))

      const summary = Date.now().toString()

      const updatedKey = await APIKeyService.updateAPIKey({
        id: apiKey.id,
        userId: user.id,
        summary
      })

      // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-unused-vars
      const { api_key, ...key } = apiKey

      expect(updatedKey.updated_at.getTime()).not.toEqual(
        apiKey.updated_at.getTime()
      )
      expect(updatedKey).toEqual({
        ...key,
        summary,
        updated_at: expect.any(Date)
      })
    })
  })

  describe('getUserByAPIKey', () => {
    it('should get a user by API key', async () => {
      const user = userMock.create()
      await UserService.createUser(user)

      const apiKey = await APIKeyService.createAPIKey({
        userId: user.id
      })
      apiKeyMock.addId(apiKey.id)

      const foundUser = await APIKeyService.getUserByAPIKey({
        apiKey: apiKey.api_key
      })

      expect(foundUser).toEqual(user)
    })

    it('does not throw when short strings are passed', async () => {
      const tests = ['', 'a', '.a']

      for (const apiKey of tests) {
        const result = await APIKeyService.getUserByAPIKey({
          apiKey
        })
        expect(result).toEqual(undefined)
      }
    })
  })
})
