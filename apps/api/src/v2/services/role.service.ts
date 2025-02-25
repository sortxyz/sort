import { getDb } from '../../global/services/kysely.service'

export async function getById(id: number) {
  return await getDb()
    .selectFrom('role')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}
