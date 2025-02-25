import { getDb } from '../../'
import { NotFoundError } from '../../errors/not-found.error'
import { PostgresFkViolationError } from '../../errors/postgres-fk-violation.error'
import { toJSONB } from '../../utils/kysely.util'

import type {
  Change,
  ChangeValueType,
  ChangeFieldValue,
  ChangePrimaryKey,
  FullChange,
  ResponseChangeField,
  ChangePreviousFieldValue
} from '../../schemas/change.schema'
import type { JsonValue } from '../../types/__generated/kysely.type'
import type { ChangePrimaryKeySelect } from '../../types/change-request.types'
import type { SortDB } from '../../types/kysely.type'
import type { Kysely, Transaction, Selectable } from 'kysely'

export const getChange = async (changeId: string) => {
  try {
    const change = await getDb()
      .selectFrom('change')
      .selectAll()
      .where('id', '=', changeId)
      .executeTakeFirst()

    if (!change) {
      return null
    }

    return change
  } catch (error) {
    throw new Error('Failed to get change', { cause: error })
  }
}

export const insertChangeWithValues = async ({
  trx,
  change,
  fieldValues,
  primaryKeys
}: {
  trx: Kysely<SortDB>
  change: Change
  fieldValues: ChangeFieldValue[]
  primaryKeys: ChangePrimaryKey[]
}) => {
  const sortDb = trx || getDb()

  const insertedChange = await insertChange(sortDb, change)
  if (insertedChange) {
    for (const fieldValue of fieldValues) {
      fieldValue.change_id = insertedChange.id
      await insertChangeFieldValue(sortDb, fieldValue)
    }
    for (const primaryKey of primaryKeys) {
      primaryKey.change_id = insertedChange.id
      await insertChangePrimaryKey(sortDb, primaryKey)
    }
  }

  return insertedChange
}

export const insertChange = async (db: Kysely<SortDB>, change: Change) => {
  try {
    return await db
      .insertInto('change')
      .values(change)
      .returningAll()
      .executeTakeFirstOrThrow()
  } catch (err) {
    if (PostgresFkViolationError.isViolationError(err)) {
      throw new PostgresFkViolationError(err, {
        tableName: change.metadata_table_name,
        schemaName: change.metadata_schema_name,
        databaseName: change.metadata_database_name
      })
    }
    throw err
  }
}

export const deleteChange = async (
  trx: Transaction<SortDB>,
  changeId: string
) => {
  return await trx.deleteFrom('change').where('id', '=', changeId).execute()
}

export const deleteFieldValuesForChange = async (
  db: Kysely<SortDB>,
  changeId: string
) => {
  return await db
    .deleteFrom('change_field_value')
    .where('change_id', '=', changeId)
    .execute()
}

export const deletePrimaryKeysForChange = async (
  db: Kysely<SortDB>,
  changeId: string
) => {
  return await db
    .deleteFrom('change_primary_key')
    .where('change_id', '=', changeId)
    .execute()
}

export const insertChangeFieldValue = async (
  trx: Kysely<SortDB>,
  fieldValue: ChangeFieldValue
) => {
  const sortDb = trx || getDb()

  // Do not tamper with the incoming object b/c it's used elsewhere
  const row = {
    ...fieldValue,
    json_value: toJSONB(fieldValue.json_value)
  }

  return await sortDb
    .insertInto('change_field_value')
    .values({
      ...row,
      binary_value: fieldValue.binary_value
        ? Buffer.from(fieldValue.binary_value, 'base64')
        : null
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const replacePreviousChangeFieldValues = async (
  trx: Transaction<SortDB>,
  fieldValues: ChangePreviousFieldValue[]
) => {
  const changeIds = []
  const rows = []

  for (const field of fieldValues) {
    changeIds.push(field.change_id)
    rows.push({
      ...field,
      json_value: toJSONB(field.json_value),
      binary_value: field.binary_value
        ? Buffer.from(field.binary_value, 'base64')
        : null
    })
  }

  await trx
    .deleteFrom('change_previous_field_value')
    .where('change_id', 'in', changeIds)
    .execute()

  return await trx
    .insertInto('change_previous_field_value')
    .values(rows)
    .execute()
}

export const insertChangePrimaryKey = async (
  trx: Kysely<SortDB>,
  primaryKey: ChangePrimaryKey
) => {
  const sortDb = trx || getDb()

  // Do not tamper with the incoming object b/c it's used elsewhere
  const row = {
    ...primaryKey,
    json_value: toJSONB(primaryKey.json_value)
  }

  return await sortDb
    .insertInto('change_primary_key')
    .values({
      ...row,
      binary_value: primaryKey.binary_value
        ? Buffer.from(primaryKey.binary_value, 'base64')
        : null
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const getChangesForChangeRequestId = async (changeRequestId: string) => {
  return await getDb()
    .selectFrom('change')
    .where('change_request_id', '=', changeRequestId)
    .selectAll()
    .execute()
}

export const fullChangeMapper = (field: ChangePrimaryKeySelect) => {
  // maps null values to undefined, used for both PKs and field values
  return {
    ...field,
    string_value: field.string_value === null ? undefined : field.string_value,
    numeric_value:
      field.numeric_value === null ? undefined : field.numeric_value,
    date_value: field.date_value === null ? undefined : field.date_value,
    boolean_value:
      field.boolean_value === null ? undefined : field.boolean_value,
    json_value: field.json_value === null ? undefined : field.json_value,
    uuid_value: field.uuid_value === null ? undefined : field.uuid_value,
    binary_value:
      field.binary_value === null
        ? undefined
        : Buffer.from(field.binary_value).toString('base64')
  } satisfies ChangePrimaryKey
}

/**
 * Converts a change field or primary key to an object suitable for database
 * storage by mapping undefined values to null.
 */
export const dbMapper = (field: ChangePrimaryKey | ChangeFieldValue) => {
  return {
    ...field,
    string_value: field.string_value === undefined ? null : field.string_value,
    numeric_value:
      field.numeric_value === undefined ? null : String(field.numeric_value),
    date_value: field.date_value === undefined ? null : field.date_value,
    boolean_value:
      field.boolean_value === undefined ? null : field.boolean_value,
    json_value:
      field.json_value === undefined ? null : (field.json_value as JsonValue),
    uuid_value: field.uuid_value === undefined ? null : field.uuid_value,
    binary_value:
      field.binary_value === undefined
        ? null
        : field.binary_value === null
          ? null
          : Buffer.from(field.binary_value, 'base64')
  } satisfies ChangePrimaryKeySelect
}

/**
 *  Converts a database row of a Change to a FullChange object suitable for API
 *  responses.
 */
export const dbFieldToResponseField = (
  field:
    | Selectable<SortDB['change_field_value']>
    | Selectable<SortDB['change_primary_key']>
    | Selectable<SortDB['change_previous_field_value']>
) => {
  const { type, fieldName }: { type: ChangeValueType; fieldName: string } =
    'is_value_null' in field && field.is_value_null
      ? { type: 'null', fieldName: 'is_value_null' }
      : field.string_value !== null
        ? { type: 'string', fieldName: 'string_value' }
        : field.numeric_value !== null
          ? { type: 'numeric', fieldName: 'numeric_value' }
          : field.date_value !== null
            ? { type: 'date', fieldName: 'date_value' }
            : field.boolean_value !== null
              ? { type: 'boolean', fieldName: 'boolean_value' }
              : field.uuid_value !== null
                ? { type: 'uuid', fieldName: 'uuid_value' }
                : field.binary_value !== null
                  ? { type: 'binary', fieldName: 'binary_value' }
                  : { type: 'json', fieldName: 'json_value' }

  const val = field[fieldName as keyof typeof field]
  const value = type === 'null' && val === true ? null : val

  if (value === undefined) {
    throw new Error(
      `Value is undefined for field: id:"${field.id}" name:"${field.column_name}"`
    )
  }

  // output base64 string for binary values
  if (type === 'binary' && value instanceof Buffer) {
    return {
      column_name: field.column_name,
      value: value.toString('base64'),
      type
    } satisfies ResponseChangeField
  }

  if (type === 'json' && typeof value === 'object' && value !== null) {
    return {
      column_name: field.column_name,
      value: JSON.stringify(value),
      type
    } satisfies ResponseChangeField
  }

  return {
    column_name: field.column_name,
    value,
    type
  } satisfies ResponseChangeField
}

const getChangeFieldsKeysAndPreviousFields = async (changeId: string) => {
  const db = getDb()

  const [fields, primaryKeys, previousFields] = await Promise.all([
    getFieldValuesForChange(db, changeId),
    getPrimaryKeysForChange(db, changeId),
    getPreviousFieldValuesForChange(db, changeId)
  ])

  return {
    fields,
    primaryKeys,
    previousFields
  }
}

const toFullChange = async (change: Change) => {
  const { fields, primaryKeys, previousFields } =
    await getChangeFieldsKeysAndPreviousFields(change.id)

  return {
    ...change,
    action: change.action,
    fields: fields.map(field => ({
      ...fullChangeMapper(field),
      is_value_null: field.is_value_null
    })),
    primary_keys: primaryKeys.map(pkey => fullChangeMapper(pkey)),
    previous_fields: previousFields.map(field => ({
      ...fullChangeMapper(field),
      is_value_null: field.is_value_null
    }))
  } satisfies FullChange
}

const toFullChangeResponse = async (change: Change) => {
  const { fields, primaryKeys, previousFields } =
    await getChangeFieldsKeysAndPreviousFields(change.id)

  const {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    metadata_schema_name: schema_name,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    metadata_database_name: database_name,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    metadata_table_name: table_name,
    ...chg
  } = change

  return {
    ...chg,
    database_name,
    schema_name,
    table_name,
    action: change.action,
    fields: fields.map(field => dbFieldToResponseField(field)),
    primary_keys: primaryKeys.map(pkey => dbFieldToResponseField(pkey)),
    previous_fields: previousFields.map(field => dbFieldToResponseField(field))
  }
}

export const getChanges = async (changeRequestId: string) => {
  return await getDb()
    .selectFrom('change')
    .where('change_request_id', '=', changeRequestId)
    .selectAll()
    .execute()
}

export const getFullChanges = async (changeRequestId: string) => {
  const changes = await getChanges(changeRequestId)
  return await Promise.all(changes.map(toFullChange))
}

export const getFullChangesResponse = async (changeRequestId: string) => {
  const changes = await getChanges(changeRequestId)
  return await Promise.all(changes.map(toFullChangeResponse))
}

export const getFullChange = async (changeId: string) => {
  const change = await getChange(changeId)
  if (!change) {
    throw new NotFoundError('change')
  }

  return toFullChange(change)
}

export const getFullChangeResponse = async (changeId: string) => {
  const change = await getChange(changeId)
  if (!change) {
    throw new NotFoundError('change')
  }

  return toFullChangeResponse(change)
}

export const getConnectionForChangeRequestId = async (
  changeRequestId: string
) => {
  return await getDb()
    .selectFrom('change_request')
    .innerJoin(
      'connection',
      'connection.id',
      'change_request.metadata_database_connection_id'
    )
    .where('change_request.id', '=', changeRequestId)
    .selectAll('connection')
    .executeTakeFirstOrThrow()
}

export const getPrimaryKeysForChange = async (
  trx: Kysely<SortDB>,
  changeId: string
) => {
  return await (trx || getDb())
    .selectFrom('change_primary_key')
    .where('change_id', '=', changeId)
    .selectAll()
    .execute()
}

export const getFieldValuesForChange = async (
  trx: Kysely<SortDB>,
  changeId: string
) => {
  return await (trx || getDb())
    .selectFrom('change_field_value')
    .where('change_id', '=', changeId)
    .selectAll()
    .execute()
}

export const getPreviousFieldValuesForChange = async (
  db: Kysely<SortDB>,
  changeId: string
) => {
  return await db
    .selectFrom('change_previous_field_value')
    .where('change_id', '=', changeId)
    .selectAll()
    .execute()
}

export const getPreviousPrimaryKeysForChange = async (
  db: Kysely<SortDB>,
  changeId: string
) => {
  return await db
    .selectFrom('change_previous_primary_key')
    .where('change_id', '=', changeId)
    .selectAll()
    .execute()
}
