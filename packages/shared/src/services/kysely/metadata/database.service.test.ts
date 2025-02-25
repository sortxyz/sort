/* eslint-disable  @typescript-eslint/no-non-null-assertion */
import { randomUUID } from 'crypto'

import { createKysely, disconnectKysely, getDb } from '../../../'
import { ConnectionMock } from '../../../mocks/connection.mock'
import { MetadataDatabaseMock } from '../../../mocks/metadata.mock'
import { OrganizationMock } from '../../../mocks/org.mock'
import { UserMock } from '../../../mocks/user.mock'
import * as ConnectionService from '../../connection.service'
import {
  insertMetadataDb,
  removeMetadataDb
} from '../../kysely/metadata/database.service'
import * as MetadataDatabaseService from '../../kysely/metadata/database.service'
import * as OrganizationService from '../../org.service'
import * as UserService from '../../user.service'

import type { DatabaseInsert } from '../../../types/kysely/metadata/database.type'
import type { SortDB } from '../../../types/kysely.type'

describe('Metadata Database Service', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const connMock = new ConnectionMock()

  const user = userMock.create()
  const org = orgMock.create()

  const databaseMock = new MetadataDatabaseMock()

  let connectionId: string
  const connectionsInOrg: string[] = []

  let mock: SortDB['metadata_database']

  let insert: DatabaseInsert

  beforeAll(async () => {
    createKysely()

    await UserService.createUser(user)

    await OrganizationService.create({ ...org, created_by: user.id })

    for (let i = 0; i < 6; i++) {
      const id = randomUUID()
      await ConnectionService.create(
        connMock.create({
          id,
          organization_id: org.id,
          created_by: user.id
        })
      )
      connectionsInOrg.push(id)
    }

    // we use this as our default "testing" connection
    connectionId = connectionsInOrg[5]
  })

  afterEach(async () => {
    await databaseMock.removeAll()
  })

  afterAll(async () => {
    await connMock.removeAll()

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

    await disconnectKysely()
  })

  describe('#insertMetadataDb', () => {
    it('should return a DB entry', async () => {
      const mock = databaseMock.create({
        organization_id: org.id,
        connection_id: connectionsInOrg[0]
      })
      const insert = await insertMetadataDb(getDb(), mock)

      expect(insert).toEqual({
        ...mock,
        slug: expect.stringMatching(new RegExp(`${mock.raw_name}-[a-f0-9]+$`))
      })
    })

    it('should throw an Error attempting to find a slug after max failed attempts', async () => {
      jest
        .spyOn(MetadataDatabaseService, 'randomizeName')
        .mockImplementation(() => 'test-slug')

      await insertMetadataDb(
        getDb(),
        databaseMock.create({
          organization_id: org.id,
          connection_id: connectionId,
          raw_name: 'test'
        })
      )

      await expect(
        insertMetadataDb(
          getDb(),
          databaseMock.create({
            organization_id: org.id,
            connection_id: connectionId,
            raw_name: 'test'
          })
        )
      ).rejects.toThrow(
        'Failed to insert database after maximum attempts to attain a unique slug.'
      )
    })

    it('should throw an Error for constraint connection_id, raw_name duplicate violation', async () => {
      await insertMetadataDb(
        getDb(),
        databaseMock.create({
          raw_name: 'test',
          organization_id: org.id,
          connection_id: connectionId
        })
      )

      await expect(
        insertMetadataDb(
          getDb(),
          databaseMock.create({
            raw_name: 'test',
            organization_id: org.id,
            connection_id: connectionId
          })
        )
      ).rejects.toThrow(
        'duplicate key value violates unique constraint "connection_id_raw_name"'
      )
    })

    it('should throw an Error for FK connection_id constraint violation', async () => {
      await expect(
        insertMetadataDb(
          getDb(),
          databaseMock.create({
            raw_name: 'test',
            organization_id: org.id,
            connection_id: randomUUID()
          })
        )
      ).rejects.toThrow(
        'insert or update on table "metadata_database" violates foreign key constraint "fk_metadata_database_connection_id"'
      )
    })
  })

  describe('#removeMetadataDb', () => {
    beforeEach(async () => {
      mock = databaseMock.create({ connection_id: connectionId })
      insert = await insertMetadataDb(getDb(), mock)
    })

    it('should remove an existing Database', async () => {
      const remove = await removeMetadataDb(insert.connection_id, insert.slug)

      expect(remove).toEqual({ numDeletedRows: 1n })
    })

    it('should return 0 on non-existant DB', async () => {
      const remove = await removeMetadataDb(randomUUID(), insert.slug)

      expect(remove).toEqual({ numDeletedRows: 0n })
    })
  })
})
