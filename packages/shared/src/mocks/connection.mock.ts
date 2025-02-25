import { randomUUID } from 'node:crypto'

import { getConfig } from '../bootstrap'
import * as ConnectionService from '../services/connection.service'
import { EncryptedField } from '../utils/crypt.util'

import { userMock } from './user.mock'

import type {
  ConnectionSelect,
  ConnectionSelectWithEncryption
} from '../types/kysely/connection/connection.type'

export class ConnectionMock {
  mocks: (ConnectionSelectWithEncryption | ConnectionSelect)[] = []

  add(mock: ConnectionSelectWithEncryption | ConnectionSelect) {
    this.mocks.push(mock)
  }

  create(values: Partial<ConnectionSelect> = {}) {
    const id = randomUUID()

    const mock = {
      id,
      organization_id: randomUUID(),
      name: `Connection name ${id}`,
      data_provider: 'postgres',
      created_by: userMock.id,
      created_at: new Date(),
      with_ssl: false,
      warehouse: null,
      visibility: 'private',
      readonly_connection_id: null,
      ...values,
      connection_string: EncryptedField.fromDecryptedValue(
        values.connection_string ??
          'postgres://root:dbadmin@localhost:5432/sort_xyz'
      )
    } satisfies ConnectionSelectWithEncryption

    this.mocks.push(mock)

    return mock
  }

  createSnowflakeHybridConnection(values: Partial<ConnectionSelect> = {}) {
    if (!getConfig().IS_TEST_ENV) {
      throw new Error(
        'Cannot create a snowflake hybrid connection in a non test environment'
      )
    }

    return this.create({
      name: 'Snowflake Hybrid Tables Test',
      data_provider: 'snowflake',
      warehouse: 'COMPUTE_WH',
      connection_string: getConfig().TEST_SNOWFLAKE_HYBRID_CONNECTION_STRING,
      with_ssl: false,
      ...values
    })
  }

  async createSnowflakeHybridConnectionRaw(
    values: Partial<ConnectionSelect> = {}
  ) {
    const encryptedMock = this.createSnowflakeHybridConnection(values)
    if (encryptedMock.connection_string === undefined)
      throw new Error('Should have a connection string')
    return {
      ...encryptedMock,
      connection_string: await encryptedMock.connection_string.decrypt()
    } satisfies ConnectionSelect
  }

  async removeAll(): Promise<void> {
    const ids = this.mocks.filter(m => m.id !== undefined).map(m => m.id)
    await ConnectionMock.removeIds(ids)
  }

  static async removeIds(ids: string[]): Promise<void> {
    if (!ids.length) return
    await Promise.all(
      ids.map(async id => await ConnectionService.removeConnection(id))
    )
  }
}

// local PG SQL mock
export const postgresConnectionMock = {
  id: 'fd31d867-768e-4b4b-8608-31887d42c69b',
  organization_id: 'c748d7d6-a612-4723-aa55-8fb481fb6b08',
  name: 'FIFA World Cup Stats',
  data_provider: 'postgres',
  connection_string: 'postgres://root:dbadmin@localhost:5432/sort_xyz',
  created_by: userMock.id,
  created_at: new Date(),
  warehouse: null,
  with_ssl: false,
  readonly_connection_id: null,
  visibility: 'private'
} satisfies ConnectionSelect

export const snowflakeConnectionMockPartial = {
  id: '2b0501b3-e178-448f-b7d4-01b7fe591844',
  organization_id: '06becf48-9eb5-4037-96c1-b8deb8f15eae',
  name: 'CVE Data',
  data_provider: 'snowflake',
  created_by: userMock.id,
  created_at: new Date(),
  warehouse: 'COMPUTE_WH',
  with_ssl: false,
  readonly_connection_id: null,
  visibility: 'private'
} satisfies Partial<ConnectionSelect>

export const airQualityPostgresConnectionMockPartial = {
  id: 'dc5a9e87-9398-4523-bd53-38e962aa8c17',
  organization_id: 'c748d7d6-a612-4723-aa55-8fb481fb6b08',
  name: 'Air Quality',
  data_provider: 'postgres',
  created_by: userMock.id,
  created_at: new Date(),
  warehouse: null,
  with_ssl: true,
  readonly_connection_id: null,
  visibility: 'private'
} satisfies Partial<ConnectionSelect>
