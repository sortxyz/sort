import { getDb } from '../'

import type { Label, LabelsByKey } from '../schemas/label.schema'
import type { SortDB } from '../types/kysely.type'
import type { Kysely, Selectable } from 'kysely'

type InsertableLabel = Omit<Label, 'id'> & {
  id?: string
}

const PublicLabelFields = [
  'id',
  'name',
  'description',
  'color',
  'metadata_database_connection_id as connection_id',
  'metadata_database_raw_name as database_name'
] as const

/**
 * Converts a database `label` row into a label suitable for sharing with the
 * public. Specifically we remove the `metadata_` prefix from the object b/c its
 * private implementation detail.
 */
const toPublicLabel = (label: Selectable<SortDB['label']>) => {
  return {
    id: label.id,
    name: label.name,
    description: label.description,
    color: label.color,
    database_name: label.metadata_database_raw_name,
    connection_id: label.metadata_database_connection_id
  }
}

/** Converts a public label to a Label row object */
const toRow = (label: InsertableLabel) => {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { connection_id, database_name, ...rest } = label
  return {
    ...rest,
    metadata_database_connection_id: connection_id,
    metadata_database_raw_name: database_name
  }
}

export const getLabel = async (labelId: string) => {
  const label = await getDb()
    .selectFrom('label')
    .where('id', '=', labelId)
    .select(PublicLabelFields)
    .executeTakeFirst()
  return label
}

export const getLabelsByIds = async (labelIds: string[]) => {
  if (labelIds.length === 0) return []

  try {
    const results = await getDb()
      .selectFrom('label')
      .where('id', 'in', labelIds)
      .select(PublicLabelFields)
      .execute()
    return results
  } catch (error) {
    throw new Error('Failed to get labels by ids', { cause: error })
  }
}

/**
 * Creates a `getLabelsByDatabase` query builder.
 *
 * @example
 *   import { createGetLabelsByDatabaseQuery } from '@sort/shared/services/label.service'
 *   const labels = await createGetLabelsByDatabaseQuery(database)
 *                        .where('id', 'in', [id1, id2])
 *                        .execute()
 **/
export const createGetLabelsByDatabaseQuery = (database: {
  connection_id: string
  database_name: string
}) => {
  const query = getDb()
    .selectFrom('label')
    .where('metadata_database_connection_id', '=', database.connection_id)
    .where('metadata_database_raw_name', '=', database.database_name)
    .select(PublicLabelFields)
  return query
}

export const getLabelsByDatabase = async (databaseData: {
  connection_id: string
  database_name: string
}) => {
  try {
    const labels = await createGetLabelsByDatabaseQuery(databaseData).execute()
    return labels
  } catch (error) {
    throw new Error('Failed to get labels by database', { cause: error })
  }
}

export const getLabelsByIssueIds = async (
  issueIds: string[],
  trx?: Kysely<SortDB>
) => {
  const kyselyDb = trx || getDb()

  try {
    const rows = await kyselyDb
      .selectFrom('label')
      .innerJoin('issue_label', 'issue_label.label_id', 'label.id')
      .where('issue_label.issue_id', 'in', issueIds)
      .selectAll()
      .execute()

    return rows.reduce<LabelsByKey>((acc, row) => {
      if (!acc[row.issue_id]) {
        acc[row.issue_id] = []
      }

      acc[row.issue_id].push(toPublicLabel(row))

      return acc
    }, {})
  } catch (error) {
    throw new Error('Failed to get labels', { cause: error })
  }
}

export const getLabelsByChangeRequestIds = async (
  issueIds: string[],
  trx?: Kysely<SortDB>
) => {
  const kyselyDb = trx || getDb()

  try {
    const rows = await kyselyDb
      .selectFrom('label')
      .innerJoin(
        'change_request_label',
        'change_request_label.label_id',
        'label.id'
      )
      .where('change_request_label.change_request_id', 'in', issueIds)
      .selectAll()
      .execute()

    return rows.reduce<LabelsByKey>((acc, row) => {
      if (!acc[row.change_request_id]) {
        acc[row.change_request_id] = []
      }

      acc[row.change_request_id].push(toPublicLabel(row))

      return acc
    }, {})
  } catch (error) {
    throw new Error('Failed to get labels', { cause: error })
  }
}

export const getLabelByAttributes = async (
  labelData: {
    name: string
    description?: string | null
    color: string
  },
  trx = getDb()
) => {
  const label = await trx
    .selectFrom('label')
    .where(eb =>
      eb.and({
        name: labelData.name,
        color: labelData.color,
        description: labelData.description || null
      })
    )
    .select(PublicLabelFields)
    .executeTakeFirst()

  if (!label) {
    throw new Error(
      `Label not found with the provided attributes: ${JSON.stringify(
        labelData
      )}`
    )
  }

  return label
}

export const createDatabaseLabel = async (labelData: InsertableLabel) => {
  try {
    const label = await getDb()
      .insertInto('label')
      .values(toRow(labelData))
      .returningAll()
      .executeTakeFirstOrThrow()

    return toPublicLabel(label)
  } catch (error) {
    throw new Error('Failed to create label and associate with database', {
      cause: error
    })
  }
}

export const updateDatabaseLabel = async (labelData: {
  id: string
  name: string
  description: string | null
  color: string
}) => {
  try {
    const labelAssociations = await getDb()
      .selectFrom('label')
      .where('id', '=', labelData.id)
      .selectAll()
      .execute()

    if (labelAssociations.length === 0) {
      throw new Error('Failed to find label')
    }

    // If the label is only associated with one database, update it directly
    const label = await getDb()
      .updateTable('label')
      .set({
        name: labelData.name,
        description: labelData.description,
        color: labelData.color
      })
      .where('id', '=', labelData.id)
      .returningAll()
      .executeTakeFirstOrThrow()

    return toPublicLabel(label)
  } catch (error) {
    throw new Error('Failed to update label', { cause: error })
  }
}

export const deleteDatabaseLabel = async (label_id: string) => {
  try {
    if (!label_id.trim()) {
      throw new Error('Invalid label id provided')
    }

    await getDb()
      .selectFrom('label')
      .where('id', '=', label_id)
      .executeTakeFirstOrThrow()

    await getDb().deleteFrom('label').where('id', '=', label_id).execute()

    return { success: true, message: 'Label deleted successfully' }
  } catch (error) {
    throw new Error('Failed to delete label', { cause: error })
  }
}
