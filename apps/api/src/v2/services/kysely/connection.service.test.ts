import * as crypto from 'node:crypto'
import { randomUUID } from 'node:crypto'

import { ConnectionMock } from '@sort/shared/mocks/connection.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as QueryStorageService from '@sort/shared/services/query/storage.service'
import * as UserService from '@sort/shared/services/user.service'
import * as SharedUtils from '@sort/shared/utils/index'

import {
  createKysely,
  getDb,
  disconnectKysely
} from '../../../global/services/kysely.service'

async function cleanUpQueries(userIds: string[]) {
  await getDb().deleteFrom('query').where('created_by', 'in', userIds).execute()
}

describe('Tests for Connection', () => {
  const userMock = new UserMock()
  const user = userMock.create()
  const connMock = new ConnectionMock()
  const orgMock = new OrganizationMock()
  const org = orgMock.create({
    created_by: user.id
  })
  const org2 = orgMock.create({
    created_by: user.id
  })

  const pgReadOnlyConnMock = connMock.create({
    id: randomUUID(),
    created_by: user.id,
    organization_id: org.id,
    data_provider: 'postgres'
  })
  const pgParentConnMock = connMock.create({
    id: randomUUID(),
    created_by: user.id,
    organization_id: org.id,
    data_provider: 'postgres',
    readonly_connection_id: pgReadOnlyConnMock.id
  })
  const pgConnMock = connMock.create({
    id: randomUUID(),
    created_by: user.id,
    organization_id: org.id,
    data_provider: 'postgres'
  })
  const snowflakeReadOnlyConnMock = connMock.create({
    id: randomUUID(),
    created_by: user.id,
    organization_id: org.id,
    data_provider: 'snowflake'
  })
  const snowflakeParentConnMock = connMock.create({
    id: randomUUID(),
    created_by: user.id,
    organization_id: org.id,
    data_provider: 'snowflake',
    readonly_connection_id: snowflakeReadOnlyConnMock.id
  })
  const snowflakeConnMock = connMock.create({
    id: randomUUID(),
    created_by: user.id,
    organization_id: org.id,
    data_provider: 'snowflake'
  })
  const snowflakeConnMock2 = connMock.create({
    id: randomUUID(),
    created_by: user.id,
    data_provider: 'snowflake',
    organization_id: org2.id
  })

  beforeAll(async () => {
    createKysely()

    await UserService.createUser(user)

    await OrganizationService.create({
      ...org,
      created_by: user.id
    })

    await OrganizationService.create({
      ...org2,
      created_by: user.id
    })
  })

  afterEach(async () => {
    await ConnectionMock.removeIds([
      pgConnMock.id,
      snowflakeConnMock.id,
      snowflakeConnMock2.id,
      pgReadOnlyConnMock.id,
      pgParentConnMock.id,
      snowflakeReadOnlyConnMock.id,
      snowflakeParentConnMock.id
    ])
  })

  afterAll(async () => {
    await cleanUpQueries([user.id])

    await connMock.removeAll()

    await getDb()
      .deleteFrom('organization_user')
      .where(
        'user_id',
        'in',
        userMock.mocks.map(u => u.id)
      )
      .execute()

    await orgMock.removeAll()

    await userMock.removeAll()

    await disconnectKysely()
  })

  describe('#getById', () => {
    it('Should return a valid connection when retrieving by id', async () => {
      await ConnectionService.create(pgConnMock)

      const result = await ConnectionService.getById(pgConnMock.id)

      expect(result).toBeDefined()
      expect(result).toEqual(pgConnMock)
    })

    it('Should return null when getting an existing connection using an invalid id', async () => {
      await ConnectionService.create(pgConnMock)

      const result = await ConnectionService.getById(crypto.randomUUID())

      expect(result).toBeUndefined()
    })

    it('Should return null when getting an existing connection using an empty id', async () => {
      await ConnectionService.create(pgConnMock)

      const result = await ConnectionService.getById('')

      expect(result).toBeUndefined()
    })
  })

  describe('#getAll', () => {
    it('Should return non-readonly connections when no argument is specified', async () => {
      await ConnectionService.create(pgReadOnlyConnMock)
      await ConnectionService.create(pgParentConnMock)
      await ConnectionService.create(snowflakeReadOnlyConnMock)
      await ConnectionService.create(snowflakeParentConnMock)

      const result = await ConnectionService.getAll()

      expect(result).toBeDefined()
      expect(result).toBeInstanceOf(Array)
      expect(result).toHaveLength(2)
      const ids = result.map(conn => conn.id)
      expect(ids).toContainEqual(pgParentConnMock.id)
      expect(ids).toContainEqual(snowflakeParentConnMock.id)
    })

    it('Should return non-readonly org-specific connections when an org id is specified', async () => {
      await ConnectionService.create(pgReadOnlyConnMock)
      await ConnectionService.create(pgParentConnMock)
      await ConnectionService.create(snowflakeConnMock2)

      const result = await ConnectionService.getAll({
        orgId: pgReadOnlyConnMock.organization_id
      })

      expect(result).toBeDefined()
      expect(result).toBeInstanceOf(Array)
      expect(result).toHaveLength(1)

      expect(result[0]).toEqual(pgParentConnMock)
    })

    it('Should return no connections when an org id that doesnt exist is specified', async () => {
      await ConnectionService.create(pgConnMock)
      await ConnectionService.create(snowflakeConnMock)

      const result = await ConnectionService.getAll({
        orgId: crypto.randomUUID()
      })

      expect(result).toBeDefined()
      expect(result).toBeInstanceOf(Array)
      expect(result).toHaveLength(0)
    })

    it('Should return non-readonly org-specific connections when an org slug is specified', async () => {
      await ConnectionService.create(pgReadOnlyConnMock)
      await ConnectionService.create(pgParentConnMock)
      await ConnectionService.create(snowflakeReadOnlyConnMock)
      await ConnectionService.create(snowflakeParentConnMock)
      await ConnectionService.create(snowflakeConnMock2)

      const result = await ConnectionService.getAll({
        orgSlug: org.slug
      })

      expect(result).toBeDefined()
      expect(result).toBeInstanceOf(Array)
      expect(result).toHaveLength(2)
      expect(result).toEqual(
        expect.arrayContaining([pgParentConnMock, snowflakeParentConnMock])
      )
    })

    it('includes readonly connections when includeReadOnly is true', async () => {
      await ConnectionService.create(pgReadOnlyConnMock)
      await ConnectionService.create(pgParentConnMock)
      await ConnectionService.create(snowflakeReadOnlyConnMock)
      await ConnectionService.create(snowflakeParentConnMock)
      await ConnectionService.create(snowflakeConnMock2)

      const result = await ConnectionService.getAll({
        orgSlug: org.slug,
        includeReadOnly: true
      })

      expect(result).toBeDefined()
      expect(result).toBeInstanceOf(Array)
      expect(result).toHaveLength(4)
      expect(result).toEqual(expect.not.arrayContaining([snowflakeConnMock2]))
    })
  })

  describe('#updateById', () => {
    describe('when id is empty', () => {
      it('throws an error', async () => {
        try {
          await ConnectionService.updateById('', {
            name: 'new name',
            data_provider: 'snowflake',
            connection_string: SharedUtils.EncryptedField.fromDecryptedValue(
              'new-connection-string'
            )
          })
          fail('should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
          expect((error as Error).message).toBe('id cannot be empty.')
        }
      })
    })

    describe('when no updates are provided', () => {
      it('throws an error', async () => {
        try {
          await ConnectionService.updateById('some-id', {})
          fail('should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
          expect((error as Error)?.message).toBe(
            'At least one field is required to update a connection.'
          )
        }
      })
    })

    describe('when all necessary params are provided', () => {
      describe('when the id matches an existing connection', () => {
        it('changes the connection in the database', async () => {
          await ConnectionService.create(pgConnMock)

          const newConnectionString = 'new-connection-string'
          const newValues = {
            name: 'new name',
            data_provider: 'snowflake',
            visibility: 'public',
            connection_string:
              SharedUtils.EncryptedField.fromDecryptedValue(newConnectionString)
          } as const

          await ConnectionService.updateById(pgConnMock.id, newValues)

          const conn = await ConnectionService.getById(pgConnMock.id)

          expect(conn?.name).toBe(newValues.name)
          expect(conn?.data_provider).toBe(newValues.data_provider)
          expect(conn?.visibility).toBe(newValues.visibility)
          expect(await conn?.connection_string.decrypt()).toBe(
            newConnectionString
          )
        })
      })

      describe('when the id does not match an existing connection', () => {
        it('returns null', async () => {
          await ConnectionService.create(pgConnMock)

          const newValues = {
            name: 'new name',
            data_provider: 'snowflake',
            connection_string: SharedUtils.EncryptedField.fromDecryptedValue(
              'new-connection-string'
            )
          } as const

          const result = await ConnectionService.updateById(
            crypto.randomUUID(),
            newValues
          )
          expect(result).toBeUndefined()
        })
      })
    })

    describe('when an invalid id is passed', () => {
      it('rejects with an error', async () => {
        try {
          await ConnectionService.updateById('myid', { name: 'new name' })
          fail('should have thrown')
        } catch (error) {
          expect(error).toBeInstanceOf(Error)

          const err = error as Error
          expect(err.message).toBe('invalid input syntax for type uuid: "myid"')
        }
      })
    })
  })

  describe('#removeConnection', () => {
    it('Should remove specific connection in database when an id is specified', async () => {
      await ConnectionService.create(pgConnMock)

      await ConnectionService.removeConnection(pgConnMock.id)

      const result = await ConnectionService.getAll()

      expect(result).toBeDefined()
      expect(result).toBeInstanceOf(Array)
      expect(result).toHaveLength(0)
    })

    it('Should remove 0 connections in database when an non-existant id is specified', async () => {
      await ConnectionService.create(pgConnMock)

      await ConnectionService.removeConnection(crypto.randomUUID())

      const result = await ConnectionService.getAll()

      expect(result).toEqual([pgConnMock])
    })

    it('should remove a connection with an existing linked query', async () => {
      await ConnectionService.create(pgConnMock)

      await QueryStorageService.insert({
        connectionId: pgConnMock.id,
        databaseName: 'postgres',
        userId: user.id,
        query: {
          name: 'My Query',
          description: 'My Query Description',
          type: 'intent',
          intent: {
            dml: 'SELECT',
            schema: 'public',
            table: 'connection',
            columns: ['id', 'name'],
            combinator: 'AND',
            filters: [],
            orders: [{ column: 'id', direction: 'ASC' }],
            limit: 100
          }
        }
      })

      await ConnectionService.removeConnection(pgConnMock.id)

      const result = await ConnectionService.getAll()

      expect(result).toEqual([])
    })
  })

  describe('#isReadOnlyConnection', () => {
    it('returns true when given connection is readonly', async () => {
      await ConnectionService.create(pgReadOnlyConnMock)
      await ConnectionService.create(pgParentConnMock)
      const pgResult = await ConnectionService.isReadOnlyConnection(
        pgReadOnlyConnMock.id
      )
      expect(pgResult).toBe(true)

      await ConnectionService.create(snowflakeReadOnlyConnMock)
      await ConnectionService.create(snowflakeParentConnMock)
      const snowResult = await ConnectionService.isReadOnlyConnection(
        snowflakeReadOnlyConnMock.id
      )
      expect(snowResult).toBe(true)
    })

    it('returns false when given connection is not readonly', async () => {
      await ConnectionService.create(pgConnMock)
      const pgResult = await ConnectionService.isReadOnlyConnection(
        pgConnMock.id
      )
      expect(pgResult).toBe(false)

      await ConnectionService.create(snowflakeConnMock)
      const snowResult = await ConnectionService.isReadOnlyConnection(
        snowflakeConnMock.id
      )
      expect(snowResult).toBe(false)
    })
  })
})
