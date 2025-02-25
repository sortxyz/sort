import { PublicFacingError } from './public-facing.error'

export type NotFoundEntity =
  | 'change'
  | 'changes'
  | 'change request'
  | 'change request comment'
  | 'columns'
  | 'comment'
  | 'completed snapshot'
  | 'connection'
  | 'connections'
  | 'database'
  | 'issue'
  | 'issue comment'
  | 'label'
  | 'organization'
  | 'organization invite'
  | 'query'
  | 'review'
  | 'schema'
  | 'snapshot'
  | 'table'
  | 'column'
  | 'user'
  | 'record'

export type ColumnContext = {
  missingColumnName: string
  changeRequestId?: string
  changeId?: string
}

export type ColumnsContext = {
  missingTableName: string
  missingTableSchemaName: string
  missingTableDatabaseName: string
}

export type TableContext = {
  missingTableName: string
  missingTableSchemaName: string
  missingTableDatabaseName: string
}

export type ConnectionContext = {
  missingConnectionId: string
}

export type EntityContext =
  | ColumnContext
  | TableContext
  | ColumnsContext
  | ConnectionContext

export class NotFoundError extends PublicFacingError {
  entity: NotFoundEntity
  code: string
  statusCode: number
  context?: EntityContext

  constructor(entity: NotFoundEntity, context?: EntityContext) {
    let msg = `${entity} not found`
    if (typeof context === 'object' && 'missingColumnName' in context) {
      msg = `column "${context.missingColumnName}" not found`
    } else if (typeof context === 'object' && 'missingTableName' in context) {
      msg = `table "${context.missingTableName}" not found`
    }

    super(msg)

    this.context = context
    this.entity = entity
    this.name = 'NotFound'
    this.code = 'FST_SORT_ENTITY_NOT_FOUND'
    this.statusCode = 404
  }
}
