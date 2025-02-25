import { randomUUID } from 'crypto'

import { sql } from 'kysely'

import { getDb } from '../..'
import { NonNullableColumnError } from '../../errors/change-requests/non-nullable.error'
import { InvalidValueError } from '../../errors/change-requests/unknown.error'
import { NotFoundError } from '../../errors/not-found.error'
import {
  addChangeRequestHistory,
  updateChangeRequestStatus
} from '../change-requests/change-request.service'
import * as ConnectionService from '../connection.service'
import { getColumnsByTableId } from '../kysely/snapshot/column.service'
import { getTableFromCurrentSnapshot } from '../kysely/snapshot/table.service'

import { buildRowFromChange } from './change-builder.service'
import {
  deleteChange,
  deleteFieldValuesForChange,
  deletePrimaryKeysForChange,
  getFullChange,
  getFullChangeResponse,
  insertChange,
  insertChangeFieldValue,
  insertChangePrimaryKey
} from './change.service'
import { storePreviousChanges } from './previous-change.service'
import {
  validateNoDuplicates,
  validateNonNullFieldsForInsert,
  validatePrimaryKeys
} from './validation.service'

import type { FullChangeRequestResponse } from '../../schemas/change-request.schema'
import type {
  ChangeFieldValue,
  ChangeFieldValueBody,
  ChangePrimaryKey,
  ChangePrimaryKeyBody,
  FullChange,
  RequestChange,
  RequestChangeFieldValue,
  RequestUpdateChange
} from '../../schemas/change.schema'
import type { ChangeSelect } from '../../types/change-request.types'
import type { SortDB } from '../../types/kysely.type'
import type { Transaction } from 'kysely'

export const replaceChangeFieldValues = async (
  trx: Transaction<SortDB>,
  changeId: string,
  fieldValues: ChangeFieldValueBody[]
) => {
  const insertedFieldValues: ChangeFieldValue[] = []
  await deleteFieldValuesForChange(trx, changeId)
  for (const fieldValue of fieldValues) {
    const preInsertFieldValue = {
      ...fieldValue,
      id: randomUUID(),
      change_id: changeId
    }
    await insertChangeFieldValue(trx, preInsertFieldValue)
    insertedFieldValues.push(preInsertFieldValue)
  }
  return insertedFieldValues
}

export const replaceChangePrimaryKeys = async (
  trx: Transaction<SortDB>,
  changeId: string,
  primaryKeys: ChangePrimaryKeyBody[]
) => {
  if (!primaryKeys.length) {
    throw new Error('Primary keys must be provided')
  }

  await deletePrimaryKeysForChange(trx, changeId)

  const insertedPrimaryKeys: ChangePrimaryKey[] = []

  for (const primaryKey of primaryKeys) {
    const preInsertPrimarykey = {
      ...primaryKey,
      id: randomUUID(),
      change_id: changeId
    }
    await insertChangePrimaryKey(trx, preInsertPrimarykey)
    insertedPrimaryKeys.push(preInsertPrimarykey)
  }

  return insertedPrimaryKeys
}

export const deleteChangeInChangeRequest = async (
  changeRequest: FullChangeRequestResponse,
  changeId: string,
  userId: string
) => {
  const fullChange = await getFullChange(changeId)

  await getDb()
    .transaction()
    .execute(async trx => {
      const now = new Date()

      const deleteResult = await deleteChange(trx, changeId)
      if (deleteResult.length === 0) {
        throw new NotFoundError('change')
      }

      await addChangeRequestHistory(
        {
          history: {
            id: randomUUID(),
            change_request_id: changeRequest.id,
            action_type: 'DELETE_CHANGE',
            action_details: { change: fullChange },
            created_at: now
          },
          userId
        },
        trx
      )

      // When a change request is manipulated via `updateChange`, we need to move the state of the change request back from Approved
      if (changeRequest.status === 'approved') {
        await updateChangeRequestStatus(trx, changeRequest.id, 'open')
      }
    })

  return fullChange
}

export const updateChangeInChangeRequest = async (
  changeRequest: FullChangeRequestResponse,
  change: FullChange,
  body: RequestUpdateChange,
  userId: string
) => {
  if (change.action === 'ADD' && (body.primary_keys?.length ?? 0) > 0) {
    // TODO make this an HTTP 400 error
    throw new Error('Primary keys cannot be declared on an ADD change.')
  }

  if (change.action === 'DELETE' && (body.fields?.length ?? 0) > 0) {
    // TODO make this an HTTP 400 error
    throw new Error('Fields cannot be declared on a DELETE change.')
  }

  if (body.fields) validateNoDuplicates(body.fields)
  if (body.primary_keys) validateNoDuplicates(body.primary_keys)

  await getDb()
    .transaction()
    .execute(async trx => {
      const now = new Date()

      if (change.action === 'ADD') {
        await validateNonNullFieldsForInsert({
          change,
          connectionId: changeRequest.connection_id,
          databaseName: changeRequest.database_name,
          fields: body.fields ?? []
        })
      }

      if (change.action === 'MODIFY' || change.action === 'DELETE') {
        if (body.primary_keys?.length) {
          await validatePrimaryKeys({
            change,
            connectionId: changeRequest.connection_id,
            databaseName: changeRequest.database_name,
            keys: body.primary_keys
          })
        }
      }

      const updatedChange = await doUpsert({
        trx,
        change,
        changeRequest,
        fieldValues: body.fields ?? [],
        primaryKeys: body.primary_keys ?? []
      })

      await addChangeRequestHistory(
        {
          history: {
            id: randomUUID(),
            change_request_id: changeRequest.id,
            action_type: 'UPDATE_CHANGE',
            action_details: { previous_change: change, change: updatedChange },
            created_at: now
          },
          userId
        },
        trx
      )
    })

  // This must run after the tx commits or the change won't be found.
  return await getFullChangeResponse(change.id)
}

/**
 * Converts fields and primary keys to objects suitable for db storage and
 * inserts / updates the database tables.
 */
const doUpsert = async ({
  trx,
  change,
  changeRequest,
  fieldValues,
  primaryKeys
}: {
  trx: Transaction<SortDB>
  change: ChangeSelect & Partial<Pick<FullChange, 'primary_keys' | 'fields'>>
  changeRequest: FullChangeRequestResponse
  fieldValues: RequestChangeFieldValue[]
  primaryKeys: RequestChangeFieldValue[]
}) => {
  const connection = await ConnectionService.getById(
    changeRequest.connection_id
  )
  if (!connection) {
    throw new NotFoundError('connection')
  }

  const table = await getTableFromCurrentSnapshot(
    changeRequest.connection_id,
    changeRequest.database_name,
    change.metadata_schema_name,
    change.metadata_table_name
  )
  if (!table) {
    throw new NotFoundError('table')
  }

  const columns = await getColumnsByTableId(table.id)
  if (!columns) {
    throw new NotFoundError('column')
  }

  const { fields, keys } = buildRowFromChange({
    changeRequestId: changeRequest.id,
    change: {
      schema_name: change.metadata_schema_name,
      table_name: change.metadata_table_name,
      action: change.action,
      fields: fieldValues,
      primary_keys: primaryKeys
    },
    connection,
    columns,
    databaseName: changeRequest.database_name,
    index: change.index
  })

  if (change.action === 'ADD' || change.action === 'MODIFY') {
    if (fields.length) {
      await replaceChangeFieldValues(trx, change.id, fields)
    }
  }

  if (change.action === 'DELETE' || change.action === 'MODIFY') {
    if (keys.length) {
      await replaceChangePrimaryKeys(trx, change.id, keys)
    }

    await storePreviousChanges({
      trx,
      changes: [
        {
          ...change,
          fields: fields.length ? fields : (change.fields ?? []),
          primary_keys: keys.length ? keys : (change.primary_keys ?? []),
          previous_fields: []
        }
      ]
    })
  }

  if (changeRequest.status === 'approved') {
    await updateChangeRequestStatus(trx, changeRequest.id, 'open')
  }

  return { ...change, fields, primary_keys: keys } as FullChange
}

/**
 * Appends the given `changes` to the end of the list of change request changes.
 * @returns The array of newly created full change responses.
 */
export const createChangesInChangeRequest = async (
  changeRequest: FullChangeRequestResponse,
  changes: RequestChange[],
  userId: string
) => {
  const insertedChanges = await getDb()
    .transaction()
    .execute(async trx => {
      const now = new Date()

      const { index } = await trx
        .selectFrom('change')
        .where('change_request_id', '=', changeRequest.id)
        .select(({ fn }) =>
          fn.coalesce(fn.max<number>('index'), sql<number>`-1`).as('index')
        )
        .executeTakeFirstOrThrow()

      const ret: Awaited<ReturnType<typeof insertChange>>[] = []

      for (let i = 0; i < changes.length; i++) {
        const change = changes[i]

        if (change.action !== 'DELETE') {
          validateNoDuplicates(change.fields)
        }

        const insertedChange = await insertChange(trx, {
          id: randomUUID(),
          change_request_id: changeRequest.id,
          index: index + 1 + i,
          action: change.action,
          connection_id: changeRequest.connection_id,
          metadata_database_name: changeRequest.database_name,
          metadata_table_name: change.table_name,
          metadata_schema_name: change.schema_name
        })

        if (change.action === 'ADD') {
          await validateNonNullFieldsForInsert({
            change: insertedChange,
            payloadIndex: i,
            connectionId: changeRequest.connection_id,
            databaseName: changeRequest.database_name,
            fields: change.fields
          })
        }

        let insertedFullChange: Awaited<ReturnType<typeof doUpsert>>
        try {
          insertedFullChange = await doUpsert({
            trx,
            change: insertedChange,
            changeRequest,
            fieldValues: change.action !== 'DELETE' ? change.fields : [],
            primaryKeys: change.action !== 'ADD' ? change.primary_keys : []
          })
        } catch (err) {
          if (
            err instanceof NonNullableColumnError ||
            err instanceof InvalidValueError
          ) {
            err.cause.payloadIndex = i
          }
          throw err
        }

        await addChangeRequestHistory(
          {
            history: {
              id: randomUUID(),
              change_request_id: changeRequest.id,
              action_type: 'ADD_CHANGE',
              action_details: { change: insertedFullChange },
              created_at: now
            },
            userId
          },
          trx
        )

        ret.push(insertedChange)
      }

      return ret
    })

  // This must run after the tx commits or the changes won't be found.
  return await Promise.all(
    insertedChanges.map(chg => getFullChangeResponse(chg.id))
  )
}
