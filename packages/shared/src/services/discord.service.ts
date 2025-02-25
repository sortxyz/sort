import { notifySentry } from '@sort/logger'

import type { Issue } from '../schemas/issue.schema'
import type { ChangeRequest } from '../types/kysely.type'
import type { SortLogger } from '@sort/logger'
import type { Selectable } from 'kysely'

const getDiscordPayload = ({
  databaseRawName,
  titleName,
  titleNumber,
  fieldSource,
  title,
  description
}: {
  databaseRawName: string
  titleName: string
  titleNumber: string
  fieldSource:
    | Pick<Selectable<Issue>, 'issue_number' | 'title' | 'created_by'>
    | Pick<
        Selectable<ChangeRequest>,
        'change_request_number' | 'title' | 'created_by'
      >
  title: string
  description: string
}) => {
  return {
    username: 'Sort',
    avatar_url: 'https://docs.sort.xyz/img/logo.png',
    embeds: [
      {
        fields: [
          {
            name: 'Database',
            value: databaseRawName,
            inline: true
          },
          {
            name: titleName,
            value: fieldSource.title,
            inline: true
          },
          {
            name: titleNumber,
            value:
              'change_request_number' in fieldSource
                ? fieldSource.change_request_number.toString()
                : fieldSource.issue_number.toString(),
            inline: true
          }
        ]
      },
      {
        title,
        description
      }
    ]
  } satisfies Parameters<typeof sendDiscordNotification>[0]['discordPayload']
}

export const getChangeRequestDiscordPayload = (
  databaseRawName: string,
  changeRequest: Pick<
    Selectable<ChangeRequest>,
    'change_request_number' | 'title' | 'created_by'
  >,
  title: string,
  description: string
) => {
  return getDiscordPayload({
    databaseRawName,
    titleName: 'Change Request',
    titleNumber: 'Change Request #',
    fieldSource: changeRequest,
    title,
    description
  })
}

export const getIssueDiscordPayload = (
  databaseRawName: string,
  issue: Pick<Selectable<Issue>, 'issue_number' | 'title' | 'created_by'>,
  title: string,
  description: string
) => {
  return getDiscordPayload({
    databaseRawName,
    titleName: 'Issue',
    titleNumber: 'Issue #',
    fieldSource: issue,
    title,
    description
  })
}

/** Sends a notification to Discord. This method logs errors, it does not throw. */
export const sendDiscordNotification = async ({
  discordWebhookUrl,
  logger,
  discordPayload
}: {
  discordWebhookUrl?: string | null
  logger: Pick<SortLogger, 'info' | 'error'>
  discordPayload: {
    content?: string
    username: string
    avatar_url: string
    embeds?: {
      title?: string
      description?: string
      fields?: { name: string; value: string; inline: boolean }[]
    }[]
  }
}) => {
  try {
    const data = JSON.stringify(discordPayload)

    if (!discordWebhookUrl) {
      logger.info('Discord webhook url not set, skipping discord notification')
      return
    }

    logger.info(`Sending discord message for ${data}`)

    const result = await fetch(discordWebhookUrl, {
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST',
      body: data
    })

    if (result.status > 299) {
      const msg = `Discord API replied with HTTP ${result.status} sending discord notification: ${data}`
      logger.error(msg)
      notifySentry({ error: new Error(msg), message: msg })
    } else {
      logger.info('Discord message sent')
    }
    return result
  } catch (error) {
    const msg = 'Error sending discord notification'
    logger.error(error, msg)
    notifySentry({ error, message: msg })
  }
}
