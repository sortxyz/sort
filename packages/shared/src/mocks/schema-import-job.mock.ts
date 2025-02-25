import { getDb } from '../'

export class SchemaImportJobMock {
  ids: string[] = []

  pushId(id: string) {
    this.ids.push(id)
  }

  async removeAll(): Promise<void> {
    if (!this.ids.length) return
    await getDb().deleteFrom('schema_job').where('id', 'in', this.ids).execute()
  }
}
