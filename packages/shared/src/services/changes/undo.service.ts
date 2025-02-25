import { getDb } from '../..'

import * as ChangeService from './change.service'
import { dbFieldToResponseField } from './change.service'

import type { ChangeResponse, RequestChange } from '../../schemas/change.schema'
import type {
  ChangePreviousFieldValueSelect,
  ChangePreviousPrimaryKeySelect
} from '../../types/change-request.types'

export class UndoChangesService {
  constructor(private readonly changes: ChangeResponse[]) {}

  private runOnce = false

  public previousFieldValuesMap: Map<string, ChangePreviousFieldValueSelect[]> =
    new Map()

  public previousPrimaryKeysMap: Map<string, ChangePreviousPrimaryKeySelect[]> =
    new Map()

  private async setup() {
    await Promise.all(
      this.changes.map(async change => {
        this.previousFieldValuesMap.set(
          change.id,
          await ChangeService.getPreviousFieldValuesForChange(
            getDb(),
            change.id
          )
        )

        this.previousPrimaryKeysMap.set(
          change.id,
          await ChangeService.getPreviousPrimaryKeysForChange(
            getDb(),
            change.id
          )
        )
      })
    )
  }

  public async generateUndoChanges() {
    if (this.runOnce) {
      throw new Error('Cannot undo changes twice')
    }

    await this.setup()

    const ret = await Promise.all(
      this.changes.map(async change => {
        switch (change.action) {
          case 'ADD':
            return await this.undoAddChange(change)
          case 'MODIFY':
            return await this.undoModifyChange(change)
          case 'DELETE':
            return await this.undoDeleteChange(change)
          default:
            throw new Error('Unknown change action')
        }
      })
    )

    this.runOnce = true

    return ret
  }

  private async undoDeleteChange(change: ChangeResponse) {
    if (change.action !== 'DELETE') {
      throw new Error('Unknown change action')
    }

    const previousFieldValues = this.previousFieldValuesMap.get(change.id) ?? []
    if (previousFieldValues.length === 0) {
      throw new Error('Could not find previous field values for change')
    }

    const newFields = previousFieldValues.map(field =>
      dbFieldToResponseField(field)
    )

    return {
      action: 'ADD',
      schema_name: change.schema_name,
      table_name: change.table_name,
      fields: newFields
    } as RequestChange
  }

  private async undoModifyChange(change: ChangeResponse) {
    if (change.action !== 'MODIFY') {
      throw new Error('Unknown change action')
    }

    const previousFieldValues = this.previousFieldValuesMap.get(change.id) ?? []
    if (previousFieldValues.length === 0) {
      throw new Error('Could not find previous field values for change')
    }

    if (!change.primary_keys.length) {
      throw new Error('Could not find primary keys for change')
    }

    // change.fields were the updated fields, we want to set them back to their previous values
    const newFields = change.fields.map(field => {
      const changedField = previousFieldValues.find(
        v => v.column_name === field.column_name
      )

      if (!changedField) {
        throw new Error(
          `Could not find field ${field.column_name} in change ${change.id}`
        )
      }

      return dbFieldToResponseField(changedField)
    })

    return {
      action: 'MODIFY',
      schema_name: change.schema_name,
      table_name: change.table_name,
      primary_keys: change.primary_keys,
      fields: newFields
    } as RequestChange
  }

  private async undoAddChange(change: ChangeResponse) {
    if (change.action !== 'ADD') {
      throw new Error('Unknown change action')
    }

    const keys = this.previousPrimaryKeysMap.get(change.id) ?? []
    if (!keys.length) {
      throw new Error('Could not find primary keys for change')
    }

    const convertedKeys = keys.map(key => dbFieldToResponseField(key))

    return {
      action: 'DELETE',
      schema_name: change.schema_name,
      table_name: change.table_name,
      primary_keys: convertedKeys
    } as RequestChange
  }
}
