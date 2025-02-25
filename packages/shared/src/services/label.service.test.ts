import { randomUUID } from 'node:crypto'

import { createKysely, disconnectKysely, getDb } from '../'
import { ConnectionMock } from '../mocks/connection.mock'
import { IssueMock } from '../mocks/issue.mock'
import { LabelMock } from '../mocks/label.mock'
import { MetadataDatabaseMock } from '../mocks/metadata.mock'
import { OrganizationMock } from '../mocks/org.mock'
import { UserMock } from '../mocks/user.mock'

import * as ConnectionService from './connection.service'
import * as IssueService from './issue.service'
import * as MetadataDatabaseService from './kysely/metadata/database.service'
import * as LabelService from './label.service'
import * as OrganizationService from './org.service'
import * as UserService from './user.service'

describe('Label Service', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const connMock = new ConnectionMock()
  const labelMock = new LabelMock()
  const issueMock = new IssueMock()

  const user = userMock.create()
  const org = orgMock.create({ created_by: user.id })
  const conn = connMock.create({
    organization_id: org.id,
    created_by: user.id
  })
  const conn2 = connMock.create({
    organization_id: org.id,
    created_by: user.id
  })
  const dbEntry = dbMock.create({
    organization_id: org.id,
    connection_id: conn.id
  })
  const dbEntry2 = dbMock.create({
    organization_id: org.id,
    connection_id: conn2.id
  })

  beforeAll(async () => {
    createKysely()

    await UserService.createUser(user)
    await OrganizationService.create(org)
    await ConnectionService.create(conn)
    await ConnectionService.create(conn2)
    await MetadataDatabaseService.insertMetadataDb(getDb(), dbEntry)
    await MetadataDatabaseService.insertMetadataDb(getDb(), dbEntry2)
  })

  afterEach(async () => {
    if (labelMock.mockIds.length) {
      // Remove all label associations from issue_label table
      await getDb()
        .deleteFrom('issue_label')
        .where('label_id', 'in', labelMock.mockIds)
        .execute()
    }

    await labelMock.removeAll()
    await issueMock.removeAll()
  })

  afterAll(async () => {
    await labelMock.removeAll()
    await connMock.removeAll()
    await dbMock.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()

    await disconnectKysely()
  })

  describe('createDatabaseLabel', () => {
    it('should create a label with all fields', async () => {
      const mockLabel = labelMock.create({
        name: 'Test Label',
        description: 'This is a Test Label.',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      const createdLabel = await LabelService.createDatabaseLabel(mockLabel)

      expect(createdLabel).toBeDefined()
      expect(createdLabel.id).toBeDefined()
      expect(createdLabel.name).toBe(mockLabel.name)
      expect(createdLabel.description).toBe(mockLabel.description)
      expect(createdLabel.color).toBeDefined()

      labelMock.addMockId(createdLabel.id)
    })

    it('should create a label with minimal fields', async () => {
      const mockLabel = labelMock.create({
        name: 'Minimal Label',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      const createdLabel = await LabelService.createDatabaseLabel(mockLabel)

      expect(createdLabel).toBeDefined()
      expect(createdLabel.id).toBeDefined()
      expect(createdLabel.name).toBe(mockLabel.name)
      expect(createdLabel.description).toBeNull()
      expect(createdLabel.color).toBe(mockLabel.color)

      labelMock.addMockId(createdLabel.id)
    })

    it('should reject labels with names exceeding 128 characters', async () => {
      const mockLabel = labelMock.create({
        name: 'a'.repeat(129),
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      try {
        await LabelService.createDatabaseLabel(mockLabel)
        fail('Expected label creation to fail with long name')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe(
          'Failed to create label and associate with database'
        )
        expect(error.cause.message).toContain(
          'value too long for type character varying(16)'
        )
      }
    })

    it('should reject invalid hex color codes', async () => {
      const mockLabel = labelMock.create({
        name: 'Invalid Color',
        color: '#gggggg',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      try {
        await LabelService.createDatabaseLabel(mockLabel)
        fail('Expected label creation to fail with invalid color code')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe(
          'Failed to create label and associate with database'
        )
        expect(error.cause.message).toContain(
          'new row for relation "label" violates check constraint "chk_color_hex"'
        )
      }
    })

    it('should only add one row to label table when duplicate label creation is attempted', async () => {
      const mockLabel = labelMock.create({
        name: 'Duplicate Label',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      await LabelService.createDatabaseLabel(mockLabel)

      labelMock.addMockId(mockLabel.id)

      try {
        await LabelService.createDatabaseLabel(mockLabel)
        fail('Expected label creation to fail with duplicate label')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe(
          'Failed to create label and associate with database'
        )
      }

      const labelAssociations = await getDb()
        .selectFrom('label')
        .where('id', 'in', [mockLabel.id])
        .selectAll()
        .execute()

      expect(labelAssociations).toBeDefined()
      expect(labelAssociations.length).toBe(1)
    })
  })

  describe('createLabelForDatabase', () => {
    it('should create a label for a database', async () => {
      const mockLabel = labelMock.create({
        name: 'Database Label',
        color: '#fffffe',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      const createdLabel = await LabelService.createDatabaseLabel(mockLabel)

      labelMock.addMockId(createdLabel.id)

      expect(createdLabel).toBeDefined()
      if (createdLabel) {
        expect(createdLabel.id).toBeDefined()
        expect(createdLabel.name).toBe(mockLabel.name)
        expect(createdLabel.description).toBeNull()
        expect(createdLabel.color).toBe(mockLabel.color)

        const databaseAssociatedLabels = await LabelService.getLabelsByDatabase(
          {
            connection_id: conn.id,
            database_name: dbEntry.raw_name
          }
        )

        expect(databaseAssociatedLabels).toBeDefined()
        expect(databaseAssociatedLabels.length).toBe(1)
        expect(databaseAssociatedLabels[0].id).toBe(createdLabel.id)
      } else {
        fail('createdLabel is undefined')
      }
    })
  })

  describe('getLabelsByIds', () => {
    it('should get labels by their IDs', async () => {
      const mockLabel1 = labelMock.create({
        name: 'Label 1',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })
      const mockLabel2 = labelMock.create({
        name: 'Label 2',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      const createdLabel1 = await LabelService.createDatabaseLabel(mockLabel1)
      const createdLabel2 = await LabelService.createDatabaseLabel(mockLabel2)

      const labels = await LabelService.getLabelsByIds([
        createdLabel1.id,
        createdLabel2.id
      ])

      expect(labels).toBeDefined()
      expect(labels.length).toBe(2)
      expect(labels[0].id).toBe(createdLabel1.id)
      expect(labels[1].id).toBe(createdLabel2.id)

      labelMock.addMockId(createdLabel1.id)
      labelMock.addMockId(createdLabel2.id)
    })

    it('should return an empty array if an any empty array is provided as input', async () => {
      const labels = await LabelService.getLabelsByIds([])
      expect(labels).toBeDefined()
      expect(labels).toEqual([])
    })

    it('should return an empty array if no labels are found', async () => {
      const labels = await LabelService.getLabelsByIds([
        randomUUID(),
        randomUUID()
      ])

      expect(labels).toBeDefined()
      expect(labels).toEqual([])
    })

    it('should throw an error if an invalid ID is provided', async () => {
      try {
        await LabelService.getLabelsByIds([randomUUID(), 'invalid-id'])
        fail('Expected getLabelsByIds to fail with invalid ID provided')
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to get labels by ids')
        expect(error.cause.message).toContain(
          'invalid input syntax for type uuid'
        )
      }
    })
  })

  describe('getLabelsByDatabase', () => {
    it('should get labels by database', async () => {
      const mockLabel1 = labelMock.create({
        name: 'Label 1',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })
      const mockLabel2 = labelMock.create({
        name: 'Label 2',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      const createdLabel1 = await LabelService.createDatabaseLabel(mockLabel1)

      const createdLabel2 = await LabelService.createDatabaseLabel(mockLabel2)

      const labels = await LabelService.getLabelsByDatabase({
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      expect(labels).toBeDefined()
      expect(labels.length).toBe(2)
      expect(labels).toEqual(
        expect.arrayContaining([createdLabel1, createdLabel2])
      )

      labelMock.addMockId(createdLabel1.id)
      labelMock.addMockId(createdLabel2.id)
    })

    it('should return an empty array if no labels are associated with the provided database', async () => {
      const labels = await LabelService.getLabelsByDatabase({
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      expect(labels).toBeDefined()
      expect(labels).toEqual([])
    })

    it('should return an empty array if a database does not exist with provided connection ID or database name', async () => {
      const labels = await LabelService.getLabelsByDatabase({
        connection_id: randomUUID(),
        database_name: 'non-existent-db-name'
      })

      expect(labels).toBeDefined()
      expect(labels).toEqual([])
    })

    it('should throw an error if an invalid connection ID is provided', async () => {
      const invalidConnectionId = 'invalid-id'

      try {
        await LabelService.getLabelsByDatabase({
          connection_id: invalidConnectionId,
          database_name: dbEntry.raw_name
        })
        fail(
          'Expected getLabelsByDatabase to fail with invalid connection ID provided'
        )
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        expect((error.cause as Error).message).toBe(
          `invalid input syntax for type uuid: "${invalidConnectionId}"`
        )
      }
    })
  })

  describe('getLabelsByIssueIds', () => {
    it('should get labels by issue IDs', async () => {
      const mockLabel1 = labelMock.create({
        name: 'Label 1',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })
      const mockLabel2 = labelMock.create({
        name: 'Label 2',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      const createdLabel1 = await LabelService.createDatabaseLabel(mockLabel1)
      const createdLabel2 = await LabelService.createDatabaseLabel(mockLabel2)

      const mockIssue1 = issueMock.create({
        connection_id: conn.id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        labels: [createdLabel1, createdLabel2]
      })

      const mockIssue2 = issueMock.create({
        connection_id: conn.id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        labels: [createdLabel2]
      })

      await IssueService.createIssue(mockIssue1)
      await IssueService.createIssue(mockIssue2)

      const labels = await LabelService.getLabelsByIssueIds([
        mockIssue1.id,
        mockIssue2.id
      ])

      expect(labels).toBeDefined()
      expect(labels[mockIssue1.id]).toEqual(
        expect.arrayContaining([createdLabel1, createdLabel2])
      )
      expect(labels[mockIssue2.id]).toEqual([createdLabel2])

      labelMock.addMockId(createdLabel1.id)
      labelMock.addMockId(createdLabel2.id)
    })

    it('should return an empty array if no labels are associated with the provided issue ID', async () => {
      const mockIssue = issueMock.create({
        connection_id: conn.id,
        database_name: dbEntry.raw_name,
        created_by: user.id
      })

      await IssueService.createIssue(mockIssue)
      const labels = await LabelService.getLabelsByIssueIds([mockIssue.id])

      expect(labels).toBeDefined()
      expect(labels).toEqual({})
    })

    it('should return an empty array if an issue does not exist with provided issue ID', async () => {
      const labels = await LabelService.getLabelsByIssueIds([
        randomUUID(),
        randomUUID()
      ])

      expect(labels).toBeDefined()
      expect(labels).toEqual({})
    })

    it('should throw an error if an invalid issue ID is provided', async () => {
      const invalidIssueId = 'invalid-id'
      try {
        await LabelService.getLabelsByIssueIds([invalidIssueId])
        fail(
          'Expected getLabelsByIssueIds to fail with invalid issue ID provided'
        )
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        expect(error.message).toBe('Failed to get labels')
      }
    })
  })

  describe('getLabelByAttributes', () => {
    it('should get a label by its attributes', async () => {
      const mockLabel = labelMock.create({
        name: 'Label 1',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      const createdLabel = await LabelService.createDatabaseLabel(mockLabel)

      const foundLabel = await LabelService.getLabelByAttributes({
        name: createdLabel.name,
        color: createdLabel.color
      })

      if (!foundLabel) {
        fail('Expected foundLabel to be defined')
      }

      expect(foundLabel).toBeDefined()
      expect(foundLabel.id).toBe(createdLabel.id)
      expect(foundLabel.name).toBe(createdLabel.name)
      expect(foundLabel.description).toBe(createdLabel.description)
      expect(foundLabel.color).toBe(createdLabel.color)

      labelMock.addMockId(createdLabel.id)
    })
  })

  describe('updateDatabaseLabel', () => {
    it('should update a label with valid data when associated with a single database', async () => {
      const mockLabel = labelMock.create({
        name: 'Original Label',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      const createdLabel = await LabelService.createDatabaseLabel(mockLabel)

      const updatedLabelValues = {
        id: createdLabel.id,
        name: 'Updated Label',
        description: 'This is an updated label.',
        color: '#eeeeee'
      }

      const updatedLabel =
        await LabelService.updateDatabaseLabel(updatedLabelValues)

      if (!updatedLabel) {
        fail('Expected updatedLabel to be defined')
      }

      expect(updatedLabel).toBeDefined()
      expect(updatedLabel.id).toBe(createdLabel.id)
      expect(updatedLabel.name).toBe(updatedLabelValues.name)
      expect(updatedLabel.description).toBe(updatedLabelValues.description)
      expect(updatedLabel.color).toBe(updatedLabelValues.color)

      labelMock.addMockId(updatedLabel.id)
    })

    it('should throw an error if a label does not exist with provided label ID', async () => {
      const updatedLabelValues = {
        id: randomUUID(),
        name: 'Updated Label',
        description: 'This is an updated label.',
        color: '#000000'
      }

      try {
        await LabelService.updateDatabaseLabel(updatedLabelValues)

        fail(
          'Expected updateDatabaseLabel to fail with non-existent label ID provided'
        )
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to update label')
        expect(error.cause.message).toContain('Failed to find label')
      }
    })

    it('should throw an error if an invalid label ID is provided', async () => {
      const updatedLabelValues = {
        id: 'invalid-id',
        name: 'Updated Label',
        description: 'This is an updated label.',
        color: '#000000'
      }

      try {
        await LabelService.updateDatabaseLabel(updatedLabelValues)

        fail(
          'Expected updateDatabaseLabel to fail with invalid label ID provided'
        )
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to update label')
        expect(error.cause.message).toContain(
          'invalid input syntax for type uuid'
        )
      }
    })
  })

  describe('deleteDatabaseLabel', () => {
    // Positive Test Cases
    it('should delete CUSTOM label and issue_label associations when label is associated with only one database', async () => {
      const mockLabel = labelMock.create({
        name: 'Database Label',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      const createdLabel = await LabelService.createDatabaseLabel(mockLabel)

      const mockIssue = issueMock.create({
        connection_id: conn.id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        labels: [createdLabel]
      })

      await IssueService.createIssue(mockIssue)

      const labelsBefore = await LabelService.getLabelsByDatabase({
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      expect(labelsBefore).toBeDefined()
      expect(labelsBefore.length).toBe(1)

      const issueLabelAssociationsBefore = await getDb()
        .selectFrom('issue_label')
        .where('label_id', 'in', [createdLabel.id])
        .selectAll()
        .execute()

      expect(issueLabelAssociationsBefore).toBeDefined()
      expect(issueLabelAssociationsBefore.length).toBe(1)

      await LabelService.deleteDatabaseLabel(createdLabel.id)

      const labelsAfter = await LabelService.getLabelsByIds([createdLabel.id])

      expect(labelsAfter).toBeDefined()
      expect(labelsAfter.length).toBe(0)

      const issueLabelAssociationsAfter = await getDb()
        .selectFrom('issue_label')
        .where('label_id', 'in', [createdLabel.id])
        .selectAll()
        .execute()

      expect(issueLabelAssociationsAfter).toBeDefined()
      expect(issueLabelAssociationsAfter.length).toBe(0)
    })

    it('should delete CUSTOM label if no issue_label associations exist', async () => {
      const mockLabel = labelMock.create({
        name: 'Database Label',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      const createdLabel = await LabelService.createDatabaseLabel(mockLabel)

      const labelsBefore = await LabelService.getLabelsByIds([createdLabel.id])

      expect(labelsBefore).toBeDefined()
      expect(labelsBefore.length).toBe(1)

      const issueLabelAssociationsBefore = await getDb()
        .selectFrom('issue_label')
        .where('label_id', 'in', [createdLabel.id])
        .selectAll()
        .execute()

      expect(issueLabelAssociationsBefore).toBeDefined()
      expect(issueLabelAssociationsBefore.length).toBe(0)

      await LabelService.deleteDatabaseLabel(createdLabel.id)

      const labelsAfter = await LabelService.getLabelsByIds([createdLabel.id])

      expect(labelsAfter).toBeDefined()
      expect(labelsAfter.length).toBe(0)

      const issueLabelAssociationsAfter = await getDb()
        .selectFrom('issue_label')
        .where('label_id', 'in', [createdLabel.id])
        .selectAll()
        .execute()

      expect(issueLabelAssociationsAfter).toBeDefined()
      expect(issueLabelAssociationsAfter.length).toBe(0)
    })

    // // Negative Test Cases
    it('should reject labels with invalid label ID', async () => {
      const mockLabel = labelMock.create({
        name: 'Database Label',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      await LabelService.createDatabaseLabel(mockLabel)

      labelMock.addMockId(mockLabel.id)

      try {
        await LabelService.deleteDatabaseLabel('invalid-id')

        fail(
          'Expected deleteDatabaseLabel to fail with invalid label ID provided'
        )
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to delete label')
        expect(error.cause.message).toContain(
          'invalid input syntax for type uuid'
        )
      }
    })

    it('should throw an error if a label is too short', async () => {
      try {
        await LabelService.deleteDatabaseLabel('')

        fail(
          'Expected deleteDatabaseLabel to fail with non-existent label ID provided'
        )
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to delete label')
        expect(error.cause.message).toContain('Invalid label id provided')
      }
    })

    it('should throw an error if a label does not exist with provided label ID', async () => {
      try {
        await LabelService.deleteDatabaseLabel(randomUUID())

        fail(
          'Expected deleteDatabaseLabel to fail with non-existent label ID provided'
        )
      } catch (error) {
        if (!(error instanceof Error)) {
          fail('Caught error is not of type Error')
        }

        if (!(error.cause && error.cause instanceof Error)) {
          fail('Caught error cause is not of type Error')
        }

        expect(error.message).toBe('Failed to delete label')
        expect(error.cause.message).toContain('no result')
      }
    })

    // // Edge Cases
    it('should not delete other labels', async () => {
      const mockLabel1 = labelMock.create({
        name: 'Database Label 1',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      const mockLabel2 = labelMock.create({
        name: 'Database Label 2',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      const mockLabel3 = labelMock.create({
        name: 'Database Label 3',
        color: '#ffffff',
        connection_id: conn.id,
        database_name: dbEntry.raw_name
      })

      const mockIssue1 = issueMock.create({
        connection_id: conn.id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        labels: [mockLabel1, mockLabel2]
      })

      const mockIssue2 = issueMock.create({
        connection_id: conn.id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        labels: [mockLabel2, mockLabel3]
      })

      const createdLabel1 = await LabelService.createDatabaseLabel(mockLabel1)

      const createdLabel2 = await LabelService.createDatabaseLabel(mockLabel2)

      const createdLabel3 = await LabelService.createDatabaseLabel(mockLabel3)

      await IssueService.createIssue(mockIssue1)
      await IssueService.createIssue(mockIssue2)

      const labelsBefore = await LabelService.getLabelsByIds([
        createdLabel1.id,
        createdLabel2.id,
        createdLabel3.id
      ])

      expect(labelsBefore).toBeDefined()
      expect(labelsBefore.length).toBe(3)

      const issueLabelAssociationsBefore = await getDb()
        .selectFrom('issue_label')
        .where('label_id', 'in', [
          createdLabel1.id,
          createdLabel2.id,
          createdLabel3.id
        ])
        .selectAll()
        .execute()

      expect(issueLabelAssociationsBefore).toBeDefined()
      expect(issueLabelAssociationsBefore.length).toBe(4)

      await LabelService.deleteDatabaseLabel(createdLabel1.id)

      const labelsAfter = await LabelService.getLabelsByIds([
        createdLabel1.id,
        createdLabel2.id,
        createdLabel3.id
      ])

      expect(labelsAfter).toBeDefined()
      expect(labelsAfter.length).toBe(2)
      expect(labelsAfter[0].id).toBe(createdLabel2.id)

      const issueLabelAssociationsAfter = await getDb()
        .selectFrom('issue_label')
        .where('label_id', 'in', [createdLabel2.id, createdLabel3.id])
        .selectAll()
        .execute()

      expect(issueLabelAssociationsAfter).toBeDefined()
      expect(issueLabelAssociationsAfter.length).toBe(3)

      labelMock.addMockId(createdLabel1.id)
      labelMock.addMockId(createdLabel2.id)
      labelMock.addMockId(createdLabel3.id)
    })
  })
})
