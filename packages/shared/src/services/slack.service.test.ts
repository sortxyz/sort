import * as Logger from '@sort/logger'

import { getConfig } from '../bootstrap'

import * as SlackService from './slack.service'

const createMockLogger = () => {
  return {
    info: jest.fn(),
    error: jest.fn()
  }
}

beforeAll(() => {
  getConfig().SLACK_WEBHOOK_URL = 'https://localhost:3000'
})
afterAll(() => {
  getConfig().SLACK_WEBHOOK_URL = ''
})

describe('sendSlackNotification', () => {
  it('constructs the proper payload and POSTs to slack', async () => {
    const logger = createMockLogger()

    // @ts-expect-error we don't care about the response
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ status: 200 })

    const msg = 'test'
    const res = await SlackService.sendAnalyticsSlackNotification({
      message: msg,
      logger
    })

    expect(logger.info).toHaveBeenCalledWith(
      `Sending slack message for ${JSON.stringify({ text: msg })}`
    )

    expect(res?.status).toEqual(200)
  })

  it('constructs the proper payload for markdown and POSTs to slack', async () => {
    const logger = createMockLogger()

    // @ts-expect-error we don't care about the response
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ status: 200 })

    const msg = 'test'
    const res = await SlackService.sendAnalyticsSlackNotification({
      message: msg,
      additionalMarkdown: '```sql\nSELECT * FROM users\n```',
      logger
    })

    expect(logger.info).toHaveBeenCalledWith(
      `Sending slack message for ${JSON.stringify({
        text: msg,
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '```sql\nSELECT * FROM users\n```' }
          }
        ]
      })}`
    )

    expect(res?.status).toEqual(200)
  })

  it('does not send a notification if the initiating user email is a Sort email', async () => {
    const logger = createMockLogger()

    // @ts-expect-error we don't care about the response
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ status: 200 })

    const msg = 'test'
    const res = await SlackService.sendAnalyticsSlackNotification({
      message: msg,
      logger,
      initiatingUserEmail: 'test@sort.xyz'
    })

    expect(logger.info).toHaveBeenCalledWith(
      'Skipping analytics slack notification for Sort email'
    )

    expect(res).toBeUndefined()
  })

  it('logs and notifies sentry if the slack API replies with non-200 status', async () => {
    const logger = createMockLogger()
    const sentry = jest.spyOn(Logger, 'notifySentry').mockImplementation()

    // @ts-expect-error we don't care about the response
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ status: 400 })

    const msg = 'test'
    const res = await SlackService.sendAnalyticsSlackNotification({
      message: msg,
      logger
    })

    expect(logger.error).toHaveBeenCalledWith(
      `Slack API replied with HTTP 400 sending slack notification: ${JSON.stringify(
        { text: msg }
      )}`
    )

    expect(res?.status).toEqual(400)
    expect(sentry).toHaveBeenCalled()
  })

  it('logs and notifies sentry if the slack API throws error', async () => {
    const logger = createMockLogger()
    const sentry = jest.spyOn(Logger, 'notifySentry').mockImplementation()

    jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('bam'))

    const msg = 'test'
    await SlackService.sendAnalyticsSlackNotification({
      message: msg,
      logger
    })

    expect(logger.error).toHaveBeenCalled()
    expect(sentry).toHaveBeenCalled()
  })
})
