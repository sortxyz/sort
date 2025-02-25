import * as DiscordService from './discord.service'

const createMockLogger = () => {
  return {
    info: jest.fn(),
    error: jest.fn()
  }
}

describe('sendDiscordNotification', () => {
  const discordWebhookUrl = 'https://localhost:3000'

  it('constructs the proper payload and POSTs to discord', async () => {
    const logger = createMockLogger()

    // @ts-expect-error we don't care about the response
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({ status: 204 })

    const discordPayload = DiscordService.getIssueDiscordPayload(
      'Our Database',
      {
        issue_number: 1,
        title: 'Test Issue',
        created_by: 'Test User'
      },
      'This is the source of an Issue',
      'This is links etc.'
    )

    const res = await DiscordService.sendDiscordNotification({
      logger,
      discordWebhookUrl,
      discordPayload
    })

    expect(res).toBeDefined()

    expect(logger.info).toHaveBeenCalledWith(
      `Sending discord message for ${JSON.stringify(discordPayload)}`
    )
    expect(logger.error).not.toHaveBeenCalled()

    expect(res?.status).toEqual(204)
  })
})
