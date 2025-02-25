import { getDb, createKysely, disconnectKysely } from '../..'
import { ConnectionMock } from '../../mocks/connection.mock'
import { OrganizationMock } from '../../mocks/org.mock'
import { SchemaImportJobMock } from '../../mocks/schema-import-job.mock'
import { UserMock } from '../../mocks/user.mock'
import * as ConnectionService from '../connection.service'
import * as OrganizationService from '../org.service'
import * as UserService from '../user.service'

import * as JobService from './job.service'

const connMock = new ConnectionMock()
const orgMock = new OrganizationMock()
const userMock = new UserMock()
const importJobMock = new SchemaImportJobMock()

const orgOwner = userMock.create()
const org = orgMock.create()
const connection1 = connMock.create({
  organization_id: org.id,
  created_by: orgOwner.id
})
const connection2 = connMock.create({
  organization_id: org.id,
  created_by: orgOwner.id
})
const connection3 = connMock.create({
  organization_id: org.id,
  created_by: orgOwner.id
})

const cleanUp = async () => {
  await importJobMock.removeAll()
  await connMock.removeAll()
  await orgMock.removeAll(true)
  await userMock.removeAll()
}

describe('Schema Import Job Service', () => {
  let user: Awaited<ReturnType<typeof UserService.createUser>>
  let conn1: Awaited<ReturnType<typeof ConnectionService.create>>
  let conn2: Awaited<ReturnType<typeof ConnectionService.create>>
  let conn3: Awaited<ReturnType<typeof ConnectionService.create>>

  beforeAll(async () => {
    createKysely()

    user = await UserService.createUser(orgOwner)

    await OrganizationService.create({
      ...org,
      created_by: user.id
    })

    conn1 = await ConnectionService.create(connection1)
    conn2 = await ConnectionService.create(connection2)
    conn3 = await ConnectionService.create(connection3)
  })

  afterAll(async () => {
    await cleanUp()
    await disconnectKysely()
  })

  afterEach(async () => {
    await importJobMock.removeAll()
  })

  describe('#createJob', () => {
    it('creates a PENDING job', async () => {
      const job = await JobService.createJob({
        user_id: user.id,
        connection_id: conn1.id
      })
      importJobMock.pushId(job!.id)
      expect(job!.status).toBe('PENDING')
    })

    it('does not create a job if one exists for that connection', async () => {
      const results = await Promise.all([
        JobService.createJob({
          user_id: user.id,
          connection_id: conn1.id
        }),
        JobService.createJob({
          user_id: user.id,
          connection_id: conn1.id
        })
      ])
      const jobs = results.filter(Boolean)
      for (const job of jobs) importJobMock.pushId(job!.id)
      expect(jobs).toHaveLength(1)
      expect(jobs[0]!.status).toBe('PENDING')
    })
  })

  describe('#getPendingJobs', () => {
    it('returns pending jobs', async () => {
      const job = await JobService.createJob({
        user_id: user.id,
        connection_id: conn1.id
      })
      importJobMock.pushId(job!.id)

      await JobService.updateJobById(getDb(), job!.id, {
        status: 'RUNNING'
      })

      const job2 = await JobService.createJob({
        user_id: user.id,
        connection_id: conn2.id
      })
      importJobMock.pushId(job2!.id)

      const jobs = await JobService.getPendingJobs()
      expect(jobs).toHaveLength(1)
      expect(jobs[0].status).toBe('PENDING')
    })
  })

  describe('#getExpiredJobs', () => {
    it('returns expired jobs', async () => {
      // active job
      const job1 = await JobService.createJob({
        user_id: user.id,
        connection_id: conn1.id
      })
      importJobMock.pushId(job1!.id)

      // job started but never completed
      const job2 = await JobService.createJob({
        user_id: user.id,
        connection_id: conn2.id
      })
      importJobMock.pushId(job2!.id)
      await JobService.updateJobById(getDb(), job2!.id, {
        status: 'RUNNING',
        start_time: new Date(new Date().getTime() - 1000 * 60 * 10)
      })

      // job created but never started
      const job3 = await JobService.createJob({
        user_id: user.id,
        connection_id: conn3.id
      })
      importJobMock.pushId(job3!.id)
      await getDb()
        .updateTable('schema_job')
        .set({
          created_at: new Date(new Date().getTime() - 1000 * 60 * 2)
        })
        .where('id', '=', job3!.id)
        .execute()

      const expired = await JobService.getExpiredJobs(1)
      expect(expired).toHaveLength(2)
      const ids = expired.map(j => j.id)
      expect(ids).toContain(job2!.id)
      expect(ids).toContain(job3!.id)
    })
  })

  describe('#getJobById', () => {
    it('returns a job by id', async () => {
      const job = await JobService.createJob({
        user_id: user.id,
        connection_id: conn1.id
      })
      importJobMock.pushId(job!.id)
      const foundJob = await JobService.getJobById(getDb(), job!.id)
      expect(foundJob.id).toBe(job!.id)
    })
  })

  describe('#updateJobById', () => {
    it('updates a job by id', async () => {
      const job = await JobService.createJob({
        user_id: user.id,
        connection_id: conn1.id
      })
      importJobMock.pushId(job!.id)
      await JobService.updateJobById(getDb(), job!.id, {
        status: 'RUNNING'
      })
      const foundJob = await JobService.getJobById(getDb(), job!.id)
      expect(foundJob.status).toBe('RUNNING')
    })
  })
})
