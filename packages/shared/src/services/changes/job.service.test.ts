import {
  getDb,
  createKysely,
  disconnectKysely,
  getConfig,
  logger
} from '../../'
import { JobExistsError } from '../../errors/job-exists.error'
import { ChangeRequestMock } from '../../mocks/change-requests/change-request.mock'
import { ChangeRequestJobMock } from '../../mocks/change-requests/job.mock'
import { ConnectionMock } from '../../mocks/connection.mock'
import { LabelMock } from '../../mocks/label.mock'
import { MetadataDatabaseMock } from '../../mocks/metadata.mock'
import { OrganizationMock } from '../../mocks/org.mock'
import { ReviewMock } from '../../mocks/review.mock'
import { UserMock } from '../../mocks/user.mock'
import * as ChangeRequestService from '../change-requests/change-request.service'
import * as ConnectionService from '../connection.service'
import * as MetadataDatabaseService from '../kysely/metadata/database.service'
import * as OrganizationService from '../org.service'
import * as UserService from '../user.service'

import * as JobService from './job.service'

describe('job.service', () => {
  const userMock = new UserMock()
  const orgMock = new OrganizationMock()
  const dbMock = new MetadataDatabaseMock()
  const labelMock = new LabelMock()
  const connMock = new ConnectionMock()
  const changeRequestMock = new ChangeRequestMock()
  const changeRequestJobMock = new ChangeRequestJobMock()
  const reviewMock = new ReviewMock()

  const user = userMock.create()
  const org = orgMock.create({ created_by: user.id })
  const conn = connMock.create({
    organization_id: org.id,
    created_by: user.id
  })
  const dbEntry = dbMock.create({
    organization_id: org.id,
    connection_id: conn.id
  })

  beforeAll(async () => {
    createKysely({ config: getConfig(), sortLogger: logger })
    await UserService.createUser(user)
    await OrganizationService.create(org)
    await ConnectionService.create(conn)
    await MetadataDatabaseService.insertMetadataDb(getDb(), dbEntry)
  })

  afterEach(async () => {
    await reviewMock.removeAll()
    await changeRequestMock.removeAll()
    await changeRequestJobMock.removeAll()
  })

  afterAll(async () => {
    await reviewMock.removeAll()
    await changeRequestMock.removeAll()
    await changeRequestJobMock.removeAll()
    await labelMock.removeAll()
    await connMock.removeAll()
    await dbMock.removeAll()
    await orgMock.removeAll(true)
    await userMock.removeAll()
    await disconnectKysely()
  })

  describe('createJob', () => {
    it('creates the job if it does not already exist', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test success'
      })

      const changeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const job = await getDb()
        .transaction()
        .execute(async trx => {
          return await JobService.createJob(trx, changeRequest.id)
        })

      expect(job).toEqual({
        id: expect.any(String),
        change_request_id: changeRequest.id,
        status: 'PENDING',
        start_time: null,
        end_time: null,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
        error_message: null,
        rows_affected: null
      })
    })

    it('creates the job if existing jobs are complete', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test success'
      })

      const changeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      const job = await getDb()
        .transaction()
        .execute(async trx => {
          return await JobService.createJob(trx, changeRequest.id)
        })

      await getDb()
        .updateTable('change_request_job')
        .where('id', '=', job.id)
        .set({
          status: 'COMPLETED',
          end_time: new Date()
        })
        .execute()

      const job2 = await getDb()
        .transaction()
        .execute(async trx => {
          return await JobService.createJob(trx, changeRequest.id)
        })

      expect(job2).toEqual({
        id: expect.any(String),
        change_request_id: changeRequest.id,
        status: 'PENDING',
        start_time: null,
        end_time: null,
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
        error_message: null,
        rows_affected: null
      })
    })

    it('throws if an incomplete job already exists', async () => {
      const mockChangeRequest = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test success'
      })

      const changeRequest =
        await ChangeRequestService.createChangeRequest(mockChangeRequest)

      await getDb()
        .transaction()
        .execute(async trx => {
          return await JobService.createJob(trx, changeRequest.id)
        })

      await expect(async () => {
        return await getDb()
          .transaction()
          .execute(async trx => {
            return await JobService.createJob(trx, changeRequest.id)
          })
      }).rejects.toThrow(JobExistsError)
    })
  })

  describe('getPendingChangeJobs', () => {
    it('should select the first job from each connection_id, database_name pair', async () => {
      const mockChangeRequest1 = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test success'
      })
      const changeRequest1 =
        await ChangeRequestService.createChangeRequest(mockChangeRequest1)
      const job1 = changeRequestJobMock.create({
        change_request_id: changeRequest1.id,
        status: 'PENDING',
        created_at: new Date('2021-01-02')
      })
      await JobService.insertTestJob(job1)

      const mockChangeRequest2 = changeRequestMock.create({
        connection_id: dbEntry.connection_id,
        database_name: dbEntry.raw_name,
        created_by: user.id,
        title: 'Test success'
      })
      const changeRequest2 =
        await ChangeRequestService.createChangeRequest(mockChangeRequest2)
      const job2 = changeRequestJobMock.create({
        change_request_id: changeRequest2.id,
        status: 'PENDING',
        created_at: new Date('2021-01-03')
      })
      await JobService.insertTestJob(job2)

      const pendingJobs = await JobService.getPendingChangeJobs()

      expect(pendingJobs).toEqual([
        {
          change_request_id: changeRequest2.id,
          created_at: new Date('2021-01-03'),
          id: job2.id,
          status: 'PENDING',
          updated_at: job2.updated_at,
          error_message: job2.error_message,
          rows_affected: job2.rows_affected,
          start_time: job2.start_time,
          end_time: job2.end_time
        }
      ])
    })
  })
})
