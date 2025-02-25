import { notifySentry } from '@sort/logger'

import { getConfig } from '../bootstrap'

import type { SortLogger } from '@sort/logger'

export const sendAnalyticsSlackNotification = async ({
  additionalMarkdown,
  message,
  logger,
  initiatingUserEmail
}: {
  message: string
  logger: Pick<SortLogger, 'info' | 'error'>
  initiatingUserEmail?: string | null
  additionalMarkdown?: string
}) => {
  if (!getConfig().SLACK_WEBHOOK_URL) {
    logger.info(
      'Skipping analytics slack notification for missing SLACK_WEBHOOK_URL'
    )
    return
  }

  if (/@sort\.xyz\s*$/i.test(initiatingUserEmail ?? '')) {
    logger.info('Skipping analytics slack notification for Sort email')
    return
  }

  return sendSlackNotification({
    slackWebhookUrl: getConfig().SLACK_WEBHOOK_URL,
    message,
    logger,
    additionalMarkdown
  })
}

/** Sends a notification to Slack. This method logs errors, it does not throw. */
export const sendSlackNotification = async ({
  slackWebhookUrl,
  additionalMarkdown,
  message,
  logger
}: {
  slackWebhookUrl?: string | null
  message: string
  logger: Pick<SortLogger, 'info' | 'error'>
  additionalMarkdown?: string
}) => {
  try {
    // https://api.slack.com/messaging/webhooks#advanced_message_formatting
    const additionalData = additionalMarkdown
      ? {
          blocks: [
            {
              type: 'section',
              text: { type: 'mrkdwn', text: additionalMarkdown }
            }
          ]
        }
      : undefined
    const data = JSON.stringify({
      text: message,
      ...(additionalData ?? {})
    })

    if (!slackWebhookUrl) {
      logger.info('Slack webhook url not set, skipping slack notification')
      return
    }

    logger.info(`Sending slack message for ${data}`)

    const result = await fetch(slackWebhookUrl, {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: data
    })

    if (result.status !== 200) {
      const msg = `Slack API replied with HTTP ${result.status} sending slack notification: ${data}`
      logger.error(msg)
      notifySentry({ error: new Error(msg), message: msg })
    } else {
      logger.info('Slack message sent')
    }
    return result
  } catch (error) {
    const msg = 'Error sending slack notification'
    logger.error(error, msg)
    notifySentry({ error, message: msg })
  }
}
