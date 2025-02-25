import { randomUUID } from 'node:crypto'

import { ConnectionMock } from '@sort/shared/mocks/connection.mock'
import { LabelMock } from '@sort/shared/mocks/label.mock'
import { MetadataDatabaseMock } from '@sort/shared/mocks/metadata.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as MetadataDatabaseService from '@sort/shared/services/kysely/metadata/database.service'
import * as LabelService from '@sort/shared/services/label.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as UserService from '@sort/shared/services/user.service'

import {
  createKysely,
  disconnectKysely,
  getDb
} from '../../../../global/services/kysely.service'
import { getTestServer } from '../../../../global/utils/test.util'
import { createSortJwt } from '../../../utils/jwt.util'
import { testInvalidSortAuthHeaders } from '../../../utils/test.util'

describe('/v2 labels routes', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
  const connMock = new ConnectionMock()

  const user = userMock.create()
  const nonOrgUser = userMock.create()
  const orgNonOwnerUser = userMock.create()
  const org = orgMock.create({ created_by: user.id })
  const conn = connMock.create({
    visibility: 'private',
    organization_id: org.id,
    created_by: user.id
  })
  const dbEntry = dbMock.create({
    organization_id: org.id,
    connection_id: conn.id
  })
  const label1 = labelMock.create({
    connection_id: conn.id,
    database_name: dbEntry.raw_name
  })
  const label2 = labelMock.create({
    connection_id: conn.id,
    database_name: dbEntry.raw_name
  })

  let server: Awaited<ReturnType<typeof getTestServer>>

  async function cleanupTests() {
    await labelMock.removeAll()
    await connMock.removeAll()
    await dbMock.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()
  }

  async function setupTests() {
    await UserService.createUser(user)
    await UserService.createUser(nonOrgUser)
    await UserService.createUser(orgNonOwnerUser)
    await OrganizationService.create(org)
    await OrganizationService.addMember(org.slug, orgNonOwnerUser.id, 'member')
    await ConnectionService.create(conn)
    await MetadataDatabaseService.insertMetadataDb(getDb(), dbEntry)
    await LabelService.createDatabaseLabel(label1)
    await LabelService.createDatabaseLabel(label2)
  }

  beforeAll(async () => {
    server = await getTestServer()
    createKysely()
    await setupTests()
  })

  afterAll(async () => {
    await cleanupTests()
    await disconnectKysely()
  })

  describe('get_database_label operation', () => {
    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/labels'
    })

    it('should 404 when a label does not exist', async () => {
      const badLabelId = randomUUID()

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/labels/${badLabelId}`
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Label not found.' }
        },
        type: 'error'
      })
    })

    it('should 404 when a database does not exist', async () => {
      const badDbSlug = 'bad-db-slug'

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${badDbSlug}/labels/${label1.id}`
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Database not found.' }
        },
        type: 'error'
      })
    })

    it('should 404 when an org does not exist', async () => {
      const badOrgSlug = 'bad-org-slug'

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'GET',
        url: `/v2/orgs/${badOrgSlug}/databases/${dbEntry.slug}/labels/${label1.id}`
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Organization not found.' }
        },
        type: 'error'
      })
    })

    it('should 404 when the org is private and its an external user', async () => {
      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(nonOrgUser.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/labels/${label1.id}`
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Database not found.' }
        },
        type: 'error'
      })
    })

    it('should return a label for a database', async () => {
      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/labels/${label1.id}`
      })

      expect(response.json()).toEqual({
        type: 'get_database_label',
        payload: {
          label: label1
        }
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('list_database_labels operation', () => {
    testInvalidSortAuthHeaders({
      method: 'GET',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/labels'
    })

    it('should 404 when a database does not exist', async () => {
      const badDbSlug = 'bad-db-slug'

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${badDbSlug}/labels`
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Database not found.' }
        },
        type: 'error'
      })
    })

    it('should 404 when an non-org user tries to access labels', async () => {
      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(nonOrgUser.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/labels`
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Database not found.' }
        },
        type: 'error'
      })
    })

    it('should 404 when an org does not exist', async () => {
      const badOrgSlug = 'bad-org-slug'

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'GET',
        url: `/v2/orgs/${badOrgSlug}/databases/${dbEntry.slug}/labels`
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Organization not found.' }
        },
        type: 'error'
      })
    })

    it('should 404 when the org is private and its an external user', async () => {
      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(nonOrgUser.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/labels`
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Database not found.' }
        },
        type: 'error'
      })
    })

    it('should return all labels for a database', async () => {
      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'GET',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/labels`
      })

      expect(response.json()).toEqual({
        type: 'list_database_labels',
        payload: {
          labels: expect.arrayContaining([label1, label2])
        }
      })

      expect(response.statusCode).toBe(200)
    })
  })

  describe('create_database_label operation', () => {
    testInvalidSortAuthHeaders({
      method: 'POST',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/labels'
    })

    it('should 404 when a database does not exist', async () => {
      const badDbSlug = 'bad-db-slug'
      const newLabel = labelMock.create({ name: 'New Label' })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${badDbSlug}/labels`,
        payload: newLabel
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Database not found.' }
        },
        type: 'error'
      })
    })

    it('should 404 when an org does not exist', async () => {
      const badOrgSlug = 'bad-org-slug'
      const newLabel = labelMock.create({ name: 'New Label' })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'POST',
        url: `/v2/orgs/${badOrgSlug}/databases/${dbEntry.slug}/labels`,
        payload: newLabel
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Organization not found.' }
        },
        type: 'error'
      })
    })

    it('should 404 when user is not an org member', async () => {
      const response = await server.inject({
        headers: {
          authorization: `Bearer ${createSortJwt(nonOrgUser.id)}`
        },
        method: 'POST',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/labels`,
        payload: labelMock.create({ name: 'New Label' })
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Database not found.' }
        },
        type: 'error'
      })
    })

    it('should create a label and associate it with a database if owner', async () => {
      const newOrg = orgMock.create({ created_by: user.id })
      const newConn = connMock.create({
        organization_id: newOrg.id,
        created_by: user.id
      })
      const newDbEntry = dbMock.create({
        organization_id: newOrg.id,
        connection_id: newConn.id
      })

      await OrganizationService.create(newOrg)
      await ConnectionService.create(newConn)
      await MetadataDatabaseService.insertMetadataDb(getDb(), newDbEntry)

      const newLabel = labelMock.create({
        name: 'New Label',
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'POST',
        url: `/v2/orgs/${newOrg.slug}/databases/${newDbEntry.slug}/labels`,
        payload: newLabel
      })

      const createdLabel = response.json().payload.label
      labelMock.addMockId(createdLabel.id)

      expect(response.json()).toEqual({
        type: 'create_database_label',
        payload: {
          label: {
            ...newLabel,
            id: expect.any(String)
          }
        }
      })

      expect(response.statusCode).toBe(201)

      const fetchedLabels = await LabelService.getLabelsByDatabase({
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })

      expect(fetchedLabels.length).toEqual(1)
      expect(fetchedLabels[0]).toEqual(createdLabel)
    })

    it('should create a label and associate it with a database if member', async () => {
      const newOrg = orgMock.create({ created_by: user.id })
      const newConn = connMock.create({
        organization_id: newOrg.id,
        created_by: user.id
      })
      const newDbEntry = dbMock.create({
        organization_id: newOrg.id,
        connection_id: newConn.id
      })

      await OrganizationService.create(newOrg)
      await ConnectionService.create(newConn)
      await MetadataDatabaseService.insertMetadataDb(getDb(), newDbEntry)
      await OrganizationService.addMember(
        newOrg.slug,
        orgNonOwnerUser.id,
        'member'
      )

      const newLabel = labelMock.create({
        name: 'Member label',
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })

      const response = await server.inject({
        headers: {
          authorization: `Bearer ${createSortJwt(orgNonOwnerUser.id)}`
        },
        method: 'POST',
        url: `/v2/orgs/${newOrg.slug}/databases/${newDbEntry.slug}/labels`,
        payload: newLabel
      })

      const createdLabel = response.json().payload.label
      labelMock.addMockId(createdLabel?.id)

      expect(response.json()).toEqual({
        type: 'create_database_label',
        payload: {
          label: {
            ...newLabel,
            id: expect.any(String)
          }
        }
      })

      expect(response.statusCode).toBe(201)

      const fetchedLabels = await LabelService.getLabelsByDatabase({
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })

      expect(fetchedLabels.length).toEqual(1)
      expect(fetchedLabels[0]).toEqual(createdLabel)
    })

    it('rejects labels containing a double quote', async () => {
      const newOrg = orgMock.create({ created_by: user.id })
      const newConn = connMock.create({
        organization_id: newOrg.id,
        created_by: user.id
      })
      const newDbEntry = dbMock.create({
        organization_id: newOrg.id,
        connection_id: newConn.id
      })

      await OrganizationService.create(newOrg)
      await ConnectionService.create(newConn)
      await MetadataDatabaseService.insertMetadataDb(getDb(), newDbEntry)

      const newLabel = labelMock.create({
        name: 'My "label"',
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'POST',
        url: `/v2/orgs/${newOrg.slug}/databases/${newDbEntry.slug}/labels`,
        payload: newLabel
      })

      expect(response.json()).toEqual({
        type: 'validation_error',
        payload: {
          validation_error: {
            context: 'body',
            errors: {
              body: {
                name: 'must match pattern "^[^"]+$"'
              }
            },
            message: 'A validation error occurred when validating the body.'
          }
        }
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('update_database_label operation', () => {
    testInvalidSortAuthHeaders({
      method: 'PATCH',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/labels/some-label-id'
    })

    it('should 404 when a label does not exist', async () => {
      const badLabelId = randomUUID()

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/labels/${badLabelId}`,
        payload: {
          id: badLabelId,
          name: 'Updated Label',
          color: '#000000',
          description: 'Updated description'
        }
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Label not found.' }
        },
        type: 'error'
      })
    })

    it('should 404 when a database does not exist', async () => {
      const badDbSlug = 'bad-db-slug'

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${org.slug}/databases/${badDbSlug}/labels/${label1.id}`,
        payload: {
          id: label1.id,
          name: 'Updated Label',
          color: '#000000',
          description: 'Updated description'
        }
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Database not found.' }
        },
        type: 'error'
      })
    })

    it('should 404 when an org does not exist', async () => {
      const badOrgSlug = 'bad-org-slug'

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${badOrgSlug}/databases/${dbEntry.slug}/labels/${label1.id}`,
        payload: {
          id: label1.id,
          name: 'Updated Label',
          color: '#000000',
          description: 'Updated description'
        }
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Organization not found.' }
        },
        type: 'error'
      })
    })

    it('should update a label if owner', async () => {
      const newOrg = orgMock.create({ created_by: user.id })
      const newConn = connMock.create({
        organization_id: newOrg.id,
        created_by: user.id
      })
      const newDbEntry = dbMock.create({
        organization_id: newOrg.id,
        connection_id: newConn.id
      })

      await OrganizationService.create(newOrg)
      await ConnectionService.create(newConn)
      await MetadataDatabaseService.insertMetadataDb(getDb(), newDbEntry)

      const newLabel = labelMock.create({
        name: 'New Label',
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })

      const createdLabel = await LabelService.createDatabaseLabel(newLabel)

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'PATCH',
        url: `/v2/orgs/${newOrg.slug}/databases/${newDbEntry.slug}/labels/${createdLabel.id}`,
        payload: {
          id: createdLabel.id,
          name: 'Updated Label',
          color: '#000000',
          description: 'Updated description'
        }
      })

      const updatedLabel = response.json().payload.label
      labelMock.addMockId(updatedLabel.id)

      expect(response.json()).toEqual({
        type: 'update_database_label',
        payload: {
          label: updatedLabel
        }
      })

      expect(response.statusCode).toBe(200)

      const fetchedLabels = await LabelService.getLabelsByDatabase({
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })

      expect(fetchedLabels.length).toEqual(1)
      expect(fetchedLabels[0]).toEqual({
        ...updatedLabel,
        name: 'Updated Label'
      })
    })

    it('should update a label if member', async () => {
      const newOrg = orgMock.create({ created_by: user.id })
      const newConn = connMock.create({
        organization_id: newOrg.id,
        created_by: user.id
      })
      const newDbEntry = dbMock.create({
        organization_id: newOrg.id,
        connection_id: newConn.id
      })

      await OrganizationService.create(newOrg)
      await ConnectionService.create(newConn)
      await MetadataDatabaseService.insertMetadataDb(getDb(), newDbEntry)
      await OrganizationService.addMember(
        newOrg.slug,
        orgNonOwnerUser.id,
        'member'
      )

      const newLabel = labelMock.create({
        name: 'New Label',
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })

      const createdLabel = await LabelService.createDatabaseLabel(newLabel)

      const response = await server.inject({
        headers: {
          authorization: `Bearer ${createSortJwt(orgNonOwnerUser.id)}`
        },
        method: 'PATCH',
        url: `/v2/orgs/${newOrg.slug}/databases/${newDbEntry.slug}/labels/${createdLabel.id}`,
        payload: {
          id: createdLabel.id,
          name: 'Updated Label',
          color: '#000000',
          description: 'Updated description'
        }
      })

      const updatedLabel = response.json().payload.label
      labelMock.addMockId(updatedLabel?.id)

      expect(response.json()).toEqual({
        type: 'update_database_label',
        payload: {
          label: updatedLabel
        }
      })

      expect(response.statusCode).toBe(200)

      const fetchedLabels = await LabelService.getLabelsByDatabase({
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })

      expect(fetchedLabels.length).toEqual(1)
      expect(fetchedLabels[0]).toEqual({
        ...updatedLabel,
        name: 'Updated Label'
      })
    })
  })

  describe('delete_database_label operation', () => {
    testInvalidSortAuthHeaders({
      method: 'DELETE',
      url: '/v2/orgs/some-org-slug/databases/some-db-slug/labels/some-label-id'
    })

    it('should 404 when an org does not exist', async () => {
      const badOrgSlug = 'bad-org-slug'

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'DELETE',
        url: `/v2/orgs/${badOrgSlug}/databases/${dbEntry.slug}/labels/${label1.id}`
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Organization not found.' }
        },
        type: 'error'
      })
    })

    it('should 404 when a database does not exist', async () => {
      const badDbSlug = 'bad-db-slug'

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'DELETE',
        url: `/v2/orgs/${org.slug}/databases/${badDbSlug}/labels/${label1.id}`
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Database not found.' }
        },
        type: 'error'
      })
    })

    it('should 404 when a label does not exist', async () => {
      const badLabelId = randomUUID()

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'DELETE',
        url: `/v2/orgs/${org.slug}/databases/${dbEntry.slug}/labels/${badLabelId}`
      })

      expect(response.statusCode).toEqual(404)
      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Label not found.' }
        },
        type: 'error'
      })
    })

    it('should 404 when user does not belong to org', async () => {
      const newOrg = orgMock.create({ created_by: user.id })
      const newConn = connMock.create({
        organization_id: newOrg.id,
        created_by: user.id
      })
      const newDbEntry = dbMock.create({
        organization_id: newOrg.id,
        connection_id: newConn.id
      })

      await OrganizationService.create(newOrg)
      await ConnectionService.create(newConn)
      await MetadataDatabaseService.insertMetadataDb(getDb(), newDbEntry)

      const newLabel = labelMock.create({
        name: 'New Label',
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })
      const createdLabel = await LabelService.createDatabaseLabel(newLabel)

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(nonOrgUser.id)}` },
        method: 'DELETE',
        url: `/v2/orgs/${newOrg.slug}/databases/${newDbEntry.slug}/labels/${createdLabel.id}`
      })

      expect(response.json()).toEqual({
        payload: {
          error: { message: 'Label not found.' }
        },
        type: 'error'
      })
      expect(response.statusCode).toEqual(404)
    })

    it('should delete a label if owner', async () => {
      const newOrg = orgMock.create({ created_by: user.id })
      const newConn = connMock.create({
        organization_id: newOrg.id,
        created_by: user.id
      })
      const newDbEntry = dbMock.create({
        organization_id: newOrg.id,
        connection_id: newConn.id
      })

      await OrganizationService.create(newOrg)
      await ConnectionService.create(newConn)
      await MetadataDatabaseService.insertMetadataDb(getDb(), newDbEntry)

      const newLabel = labelMock.create({
        name: 'New Label',
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })

      const createdLabel = await LabelService.createDatabaseLabel(newLabel)

      const fetchedLabelsBefore = await LabelService.getLabelsByDatabase({
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })

      expect(fetchedLabelsBefore.length).toEqual(1)

      const response = await server.inject({
        headers: { authorization: `Bearer ${createSortJwt(user.id)}` },
        method: 'DELETE',
        url: `/v2/orgs/${newOrg.slug}/databases/${newDbEntry.slug}/labels/${createdLabel.id}`
      })

      expect(response.json()).toEqual({
        type: 'success',
        payload: {
          success: {
            message: `Label ${createdLabel.id} deleted successfully.`
          }
        }
      })

      expect(response.statusCode).toBe(200)

      const fetchedLabelsAfter = await LabelService.getLabelsByDatabase({
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })

      expect(fetchedLabelsAfter.length).toEqual(0)
    })

    it('should delete a label if member', async () => {
      const newOrg = orgMock.create({ created_by: user.id })
      const newConn = connMock.create({
        organization_id: newOrg.id,
        created_by: user.id
      })
      const newDbEntry = dbMock.create({
        organization_id: newOrg.id,
        connection_id: newConn.id
      })

      await OrganizationService.create(newOrg)
      await ConnectionService.create(newConn)
      await MetadataDatabaseService.insertMetadataDb(getDb(), newDbEntry)
      await OrganizationService.addMember(
        newOrg.slug,
        orgNonOwnerUser.id,
        'member'
      )

      const newLabel = labelMock.create({
        name: 'New Label',
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })

      const createdLabel = await LabelService.createDatabaseLabel(newLabel)

      const fetchedLabelsBefore = await LabelService.getLabelsByDatabase({
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })

      expect(fetchedLabelsBefore.length).toEqual(1)

      const response = await server.inject({
        headers: {
          authorization: `Bearer ${createSortJwt(orgNonOwnerUser.id)}`
        },
        method: 'DELETE',
        url: `/v2/orgs/${newOrg.slug}/databases/${newDbEntry.slug}/labels/${createdLabel.id}`
      })

      expect(response.json()).toEqual({
        type: 'success',
        payload: {
          success: {
            message: `Label ${createdLabel.id} deleted successfully.`
          }
        }
      })

      expect(response.statusCode).toBe(200)

      const fetchedLabelsAfter = await LabelService.getLabelsByDatabase({
        connection_id: newConn.id,
        database_name: newDbEntry.raw_name
      })

      expect(fetchedLabelsAfter.length).toEqual(0)
    })
  })
})
