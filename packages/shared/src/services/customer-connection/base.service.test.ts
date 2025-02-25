/* eslint-disable  @typescript-eslint/no-non-null-assertion */

import { createKysely } from '../..'
import {
  ConnectionMock,
  postgresConnectionMock,
  snowflakeConnectionMockPartial
} from '../../mocks/connection.mock'

import { ConnectionServiceBase } from './base.service'

import type { ConnectionServiceTest } from '../../schemas/connection.schema'
import type { ConnectionInsert } from '../../types/kysely/connection/connection.type'

class BaseConnectionMock extends ConnectionServiceBase<'postgres'> {
  constructor(protected connection: ConnectionInsert) {
    super('postgres', connection)
  }

  async tryCreateConnection(): Promise<ConnectionServiceTest | null> {
    return null
  }

  async createConnection(): Promise<unknown> {
    return Promise.resolve()
  }

  async closeConnection(): Promise<void> {
    return Promise.resolve()
  }
}

describe('Tests for Base Connection', () => {
  const connMock = new ConnectionMock()

  beforeAll(async () => {
    createKysely()
  })

  afterAll(async () => {
    await connMock.removeAll()
  })

  it('should instantiate with a connection', () => {
    const pg = new BaseConnectionMock(postgresConnectionMock)

    expect(pg).toBeDefined()
  })

  it('should throw an error if the data provider doesnt match connection', async () => {
    const conn = await connMock.createSnowflakeHybridConnectionRaw(
      snowflakeConnectionMockPartial
    )
    expect(() => new BaseConnectionMock(conn)).toThrowError(
      /^Invalid data provider/
    )
  })
})
