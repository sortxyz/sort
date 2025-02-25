import { createKysely, disconnectKysely, getDb } from '@sort/shared'
import { ConnectionMock } from '@sort/shared/mocks/connection.mock'
import { OrganizationMock } from '@sort/shared/mocks/org.mock'
import { UserMock } from '@sort/shared/mocks/user.mock'
import * as ConnectionService from '@sort/shared/services/connection.service'
import * as OrganizationService from '@sort/shared/services/org.service'
import * as JobService from '@sort/shared/services/schema-import/job.service'
import * as UserService from '@sort/shared/services/user.service'

import { config, logger } from '../config/bootstrap'

import { SchemaImportJobController } from './schema-import-job.controller'

const userMock = new UserMock()
const orgMock = new OrganizationMock()
const connMock = new ConnectionMock()

const orgOwner = userMock.create()
const org = orgMock.create()
const connection = connMock.create({
  organization_id: org.id,
  created_by: orgOwner.id
})

const cleanUp = async () => {
  await connMock.removeAll()
  await orgMock.removeAll(true)
  await userMock.removeAll()
}

describe('SchemaImportJobController', () => {
  let user: Awaited<ReturnType<typeof UserService.createUser>>
  let conn: Awaited<ReturnType<typeof ConnectionService.create>>

  beforeAll(async () => {
    createKysely({ config, sortLogger: logger })

    user = await UserService.createUser(orgOwner)

    await OrganizationService.create({
      ...org,
      created_by: user.id
    })

    conn = await ConnectionService.create(connection)
  })

  afterAll(async () => {
    await cleanUp()
    await disconnectKysely()
  })

  describe('#runJob', () => {
    it('should run the job', async () => {
      const job = await JobService.createJob({
        user_id: user.id,
        connection_id: conn.id
      })
      expect(job!.status).toBe('PENDING')
      const controller = new SchemaImportJobController(job!)
      await controller.runJob()
      const finishedJob = await JobService.getJobById(getDb(), job!.id)
      expect(finishedJob.status).toBe('COMPLETED')
    })

    it('updates status to FAILED upon failure', async () => {
      const job = await JobService.createJob({
        user_id: user.id,
        connection_id: conn.id
      })
      expect(job!.status).toBe('PENDING')

      jest
        .spyOn(ConnectionService, 'getById')
        .mockImplementationOnce(async () => {
          return undefined
        })

      const controller = new SchemaImportJobController(job!)
      await controller.runJob()
      const finishedJob = await JobService.getJobById(getDb(), job!.id)
      expect(finishedJob.status).toBe('FAILED')
      expect(finishedJob.error_message).toBe('Connection not found')
    })
  })
})
