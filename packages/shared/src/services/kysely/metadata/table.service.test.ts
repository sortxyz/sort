/* eslint-disable no-console */
import { randomUUID } from 'crypto'

import { createKysely, getDb, disconnectKysely } from '../../../'
import {
  ConnectionMock,
  postgresConnectionMock
} from '../../../mocks/connection.mock'
import { MetadataTableMock } from '../../../mocks/metadata.mock'
import { OrganizationMock } from '../../../mocks/org.mock'
import { UserMock } from '../../../mocks/user.mock'
import * as ConnectionService from '../../../services/connection.service'
import {
  getTable,
  insertTable,
  removeTable
} from '../../kysely/metadata/table.service'
import * as OrganizationService from '../../org.service'
import * as UserService from '../../user.service'

import type { SortDB } from '../../../types/kysely.type'

describe('Tests for Metadata Table Service', () => {
  const userMock = new UserMock()
  const user = userMock.create()
  const orgMock = new OrganizationMock()
  const org = orgMock.create({
    created_by: user.id
  })

  const connMock = new ConnectionMock()

  const tableMock = new MetadataTableMock()

  const connectionId = randomUUID()

  let mock: SortDB['metadata_table']

  let insert: {
    connection_id: string
    raw_name: string
    raw_schema_name: string
    raw_database_name: string
  }

  beforeAll(async () => {
    createKysely()

    await UserService.createUser(user)

    await OrganizationService.create({
      ...org,
      created_by: user.id
    })

    await ConnectionService.create(
      connMock.create({
        ...postgresConnectionMock,
        id: connectionId,
        organization_id: org.id,
        created_by: user.id
      })
    )
  })

  afterAll(async () => {
    await tableMock.removeAll()

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

  describe('#insertTable', () => {
    beforeAll(async () => {
      mock = tableMock.create({ connection_id: connectionId })
      insert = await insertTable(mock)
    })

    it('should return Table PK', async () => {
      expect(insert).toStrictEqual({
        connection_id: connectionId,
        raw_name: mock.raw_name,
        raw_schema_name: mock.raw_schema_name,
        raw_database_name: mock.raw_database_name
      })
    })

    it('should not be able to insert a Table with duplicate PK', async () => {
      await expect(insertTable(mock)).rejects.toThrow(
        'duplicate key value violates unique constraint "metadata_table_pkey"'
      )
    })
  })

  describe('#getTable', () => {
    beforeAll(async () => {
      mock = tableMock.create({ connection_id: connectionId })
      insert = await insertTable(mock)
    })

    it('should retrieve an existing Table', async () => {
      const select = await getTable(
        insert.connection_id,
        insert.raw_name,
        insert.raw_schema_name,
        insert.raw_database_name
      )

      expect(select).toStrictEqual(mock)
    })

    it('should return undefined on invalid retrieval', async () => {
      const select = await getTable(
        randomUUID(),
        insert.raw_name,
        insert.raw_schema_name,
        insert.raw_database_name
      )

      expect(select).toStrictEqual(undefined)
    })
  })

  describe('#removeTable', () => {
    beforeAll(async () => {
      mock = tableMock.create({ connection_id: connectionId })
      insert = await insertTable(mock)
    })

    it('should remove an existing Table', async () => {
      const remove = await removeTable(
        insert.connection_id,
        insert.raw_name,
        insert.raw_schema_name,
        insert.raw_database_name
      )

      expect(remove).toEqual({ numDeletedRows: 1n })
    })

    it('should return 0 on non-existant Table', async () => {
      const remove = await removeTable(
        randomUUID(),
        insert.raw_name,
        insert.raw_schema_name,
        insert.raw_database_name
      )

      expect(remove).toEqual({ numDeletedRows: 0n })
    })
  })
})
