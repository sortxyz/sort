import type { ConnectionServiceTest } from '../../schemas/connection.schema'
import type { ConnectionDataProvider } from '../../schemas/data-provider.schema'
import type { ConnectionInsert } from '../../types/kysely/connection/connection.type'

export abstract class ConnectionServiceBase<
  TConnectionDataProvider extends ConnectionDataProvider
> {
  constructor(
    dataProvider: TConnectionDataProvider,
    protected connection: ConnectionInsert
  ) {
    if (dataProvider !== this.connection.data_provider) {
      throw new Error(
        `Invalid data provider "${dataProvider}" for connection ${this.connection.id}`
      )
    }
  }

  /**
   * Test the connection to the database; if successful, return the version of a connection string that worked. If unsuccessful, return null.
   */
  abstract tryCreateConnection(): Promise<ConnectionServiceTest | null>
}
