import type * as QueryExecutionSchema from '../../../schemas/query-execution.schema'

export abstract class BaseQueryService {
  protected mapRowsToRecords(rows: unknown[], cols: string[]) {
    return rows.map(row => {
      const ret: unknown[] = []
      const record = row as object

      for (const key of cols) {
        const value = record[key as keyof typeof record]
        ret.push(value)
      }

      return ret
    })
  }

  abstract execute(
    database: string,
    query: QueryExecutionSchema.Query
  ): Promise<QueryExecutionSchema.QueryExecutionResponse>
}
