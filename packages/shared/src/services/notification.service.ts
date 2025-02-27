import { notifySentry } from '@sort/logger'

import { getConfig, getDb } from '..'
import { capitalizeWord } from '../utils/string.util'

import * as ConnectionService from './connection.service'
import {
  getChangeRequestDiscordPayload,
  getIssueDiscordPayload,
  sendDiscordNotification
} from './discord.service'
import { createClient } from './mailgun.service'
import {
  sendSlackNotification,
  sendAnalyticsSlackNotification
} from './slack.service'

import type { Organization } from '../schemas/org.schema'
import type { Issue, ChangeRequest, SortDB } from '../types/kysely.type'
import type { SortLogger } from '@sort/logger'
import type { Selectable } from 'kysely'
import type { MailgunMessageData } from 'mailgun.js'

type NotificationLogger = Pick<SortLogger, 'info' | 'error'>

type MetadataDatabase = SortDB['metadata_database']

export const sendEmailNotification = async (
  data: MailgunMessageData,
  logger: NotificationLogger
) => {
  const config = getConfig()
  const { IS_TEST_ENV, MAILGUN_DOMAIN, MAILGUN_API_KEY } = config

  if (IS_TEST_ENV || !MAILGUN_DOMAIN || !MAILGUN_API_KEY) {
    logger.info(
      {
        IS_TEST_ENV,
        MAILGUN_DOMAIN: MAILGUN_DOMAIN ?? '',
        MAILGUN_API_KEY: MAILGUN_API_KEY ? '***' : ''
      },
      'Skipping email notification'
    )
    return {
      id: String(new Date()),
      message: 'Queued. Thank you.',
      details: 'Email notifications are disabled',
      status: 201
    }
  }

  const domain = config.IS_PROD_ENV
    ? 'sort.xyz'
    : 'sandbox7e4efdd6b47e4c2e934d48a4930dbffe.mailgun.org'

  const options = {
    from: `Sort <notifications@${domain}>`,
    'h:Reply-To': 'no-reply@sort.xyz',
    't:text': true,
    ...data
  }

  const mailgunResult = await createClient(MAILGUN_API_KEY).messages.create(
    MAILGUN_DOMAIN,
    options
  )
  return mailgunResult
}

export const getRecipients = async ({
  orgSlug,
  dbSlug,
  createdBy,
  additionalRecipients
}: {
  orgSlug: string
  dbSlug: string
  createdBy: string
  additionalRecipients?: { name: string | null; email: string }[]
}) => {
  const recipients = await getDb()
    .selectFrom('organization as o')
    .innerJoin('organization_user as ou', 'o.id', 'ou.organization_id')
    .innerJoin('user', 'user.id', 'ou.user_id')
    .where('o.slug', '=', orgSlug.trim())
    .where('user.email_verified', '=', true)
    .select(['user.email', 'user.name'])
    .execute()

  const connection = await ConnectionService.getByOrgAndDbSlug({
    orgSlug,
    dbSlug
  })

  if (connection?.visibility === 'public') {
    recipients.push(
      ...(await getDb()
        .selectFrom('user')
        .select(['email', 'name'])
        .where('id', '=', createdBy)
        .where('user.email_verified', '=', true)
        .execute()),
      ...(additionalRecipients || [])
    )
  }

  const to: string[] = []

  // To avoid leaking email addresses to other recipients, Mailgun requires
  // specifying "Recipient Variables". Every address in the `to` field
  // must exist in the `recipient-variables` field too.
  // https://documentation.mailgun.com/en/latest/user_manual.html?highlight=bulk#batch-sending
  const recipientVariables: Record<string, { id: string }> = {}

  for (const recipient of recipients) {
    if (!recipient.email) continue

    const email = recipient.email.toLowerCase()
    if (recipientVariables[email]) continue

    recipientVariables[email] = { id: email }
    to.push(`${recipient.name || email} <${email}>`)
  }

  return {
    to,
    recipientVariables
  }
}

export const isIgnoredMailgunError = (error: Error) => {
  const err = error as Error & { status: number; details: string }
  return (
    err.status === 403 &&
    /add the address to authorized recipients/.test(err.details)
  )
}

/**
 * Sends an Issue email notification to all organization members. If the parent
 * connection is public, the issue creator and optional `additionalRecipients`
 * will be included.
 *
 * Email:
 * To enable sending emails, the MAILGUN_* env variables must be sent.
 * The `@htmlMessage` string will be sent as the email body.
 *
 * Slack:
 * To enable sending slack notifications, the organization must have slack_webhook_url.
 * If `@mdMessage` is provided, it will be sent to Slack, otherwise, `@htmlMessage` will be sent.
 *
 * Errors are logged and reported to Sentry, not thrown.
 */
export const sendIssueNotification = async ({
  org,
  database,
  issue,
  htmlMessage,
  mdMessage,
  logger,
  additionalRecipients,
  initiatingUserEmail,
  source
}: {
  org: Organization
  database: Selectable<MetadataDatabase>
  issue: Pick<Selectable<Issue>, 'issue_number' | 'title' | 'created_by'>
  htmlMessage: string
  mdMessage?: string
  logger: NotificationLogger
  additionalRecipients?: { name: string | null; email: string }[]
  initiatingUserEmail?: string | null
  source: string
}) => {
  try {
    const issueLink = `${getConfig().SORT_WEB_HOST}/orgs/${org.slug}/databases/${
      database.slug
    }/issues/${issue.issue_number}`

    const subject = `📊 ${org.name}/${database.raw_name} :: ${issue.title} (Issue #${issue.issue_number})`

    const baseMessage = `${issueLink}\n\n${mdMessage ?? htmlMessage ?? ''}`
    const slackMsg = `${subject}\n\n${baseMessage}`

    await sendAnalyticsSlackNotification({
      message: slackMsg,
      additionalMarkdown: slackMsg,
      logger,
      initiatingUserEmail
    })

    await sendSlackNotification({
      slackWebhookUrl: org.slack_webhook_url,
      message: slackMsg,
      additionalMarkdown: slackMsg,
      logger
    })

    await sendDiscordNotification({
      discordWebhookUrl: org.discord_webhook_url,
      discordPayload: getIssueDiscordPayload(
        database.raw_name,
        issue,
        source,
        baseMessage
      ),
      logger
    })

    const { to, recipientVariables } = await getRecipients({
      orgSlug: org.slug,
      dbSlug: database.slug,
      createdBy: issue.created_by,
      additionalRecipients
    })

    if (to.length === 0) {
      logger.info('Skipping issue email notification. No valid recipients.')
      return
    } else {
      logger.info(`Sending issue email notification to ${to.length} recipients`)
    }

    await sendEmailNotification(
      {
        to,
        subject,
        template: 'issue notification',
        'h:X-Mailgun-Variables': JSON.stringify({
          link: issueLink,
          message: htmlMessage
        }),
        'recipient-variables': JSON.stringify(recipientVariables)
      },
      logger
    )
  } catch (error) {
    if (!isIgnoredMailgunError(error as Error)) {
      notifySentry({
        error: error as Error,
        message: 'Error sending issue notification'
      })
    }

    // associate with request/job logs
    logger.error(error, 'Error sending issue notification')
  }
}

/**
 * Sends a Change Request email notification to all organization members. If the parent
 * connection is public, the issue creator and optional `additionalRecipients`
 * will be included.
 *
 * Email:
 * To enable sending emails, the MAILGUN_* env variables must be sent.
 * The `@htmlMessage` string will be sent as the email body.
 *
 * Slack:
 * To enable sending slack notifications, the SLACK_WEBHOOK_URL env variable must be sent.
 * If `@mdMessage` is provided, it will be sent to Slack, otherwise, `@htmlMessage` will be sent.
 *
 * Errors are logged and reported to Sentry, not thrown.
 */
export const sendChangeRequestNotification = async ({
  org,
  database,
  changeRequest,
  htmlMessage,
  mdMessage,
  logger,
  additionalRecipients,
  initiatingUserEmail,
  source
}: {
  org: Organization
  database: Selectable<MetadataDatabase>
  changeRequest: Pick<
    Selectable<ChangeRequest>,
    'change_request_number' | 'title' | 'created_by'
  >
  htmlMessage: string
  mdMessage?: string
  logger: NotificationLogger
  additionalRecipients?: { name: string | null; email: string }[]
  initiatingUserEmail?: string | null
  source: string
}) => {
  try {
    const link = `${getConfig().SORT_WEB_HOST}/orgs/${org.slug}/databases/${
      database.slug
    }/change-requests/${changeRequest.change_request_number}`
    const subject = `📊 ${org.name}/${database.raw_name} :: ${changeRequest.title} (Change Request #${changeRequest.change_request_number})`
    const baseMessage = `${link}\n\n${mdMessage ?? htmlMessage ?? ''}`
    const slackMsg = `${subject}\n\n${baseMessage}`

    await sendAnalyticsSlackNotification({
      message: slackMsg,
      additionalMarkdown: slackMsg,
      logger,
      initiatingUserEmail
    })

    await sendSlackNotification({
      slackWebhookUrl: org.slack_webhook_url,
      message: slackMsg,
      additionalMarkdown: slackMsg,
      logger
    })

    await sendDiscordNotification({
      discordWebhookUrl: org.discord_webhook_url,
      discordPayload: getChangeRequestDiscordPayload(
        database.raw_name,
        changeRequest,
        source,
        baseMessage
      ),
      logger
    })

    const { to, recipientVariables } = await getRecipients({
      orgSlug: org.slug,
      dbSlug: database.slug,
      createdBy: changeRequest.created_by,
      additionalRecipients
    })

    if (to.length === 0) {
      logger.info('Skipping change request notification. No valid recipients.')
      return
    } else {
      logger.info(
        `Sending change request notification to ${to.length} recipients`
      )
    }

    const template = 'change request notification'

    const emailResult = await sendEmailNotification(
      {
        to,
        subject,
        template,
        'h:X-Mailgun-Variables': JSON.stringify({
          link,
          message: htmlMessage
        }),
        'recipient-variables': JSON.stringify(recipientVariables)
      },
      logger
    )

    return emailResult
  } catch (error) {
    if (!isIgnoredMailgunError(error as Error)) {
      notifySentry({
        error: error as Error,
        message: 'Error sending change request notification email'
      })
    }

    // associate with request/job logs
    logger.error(error, 'Error sending change request notification email')
  }
}

/**
 * Sends a Welcome email notification to the specified email address.
 *
 * Errors are logged and reported to Sentry, not thrown.
 */
export const sendWelcomeEmail = async ({
  name,
  email,
  logger
}: {
  name?: string | null | undefined
  email: string
  logger: NotificationLogger
}) => {
  try {
    const subject = '📊 Welcome to Sort!'
    const template = 'welcome'

    const emailResult = await sendEmailNotification(
      {
        to: [`${name || email} <${email}>`],
        subject,
        template
      },
      logger
    )

    if (emailResult.status >= 400) {
      throw new Error(
        `Mailgun error [${emailResult.id}]: ${emailResult.message}`
      )
    }

    if (emailResult.details !== 'Email notifications are disabled') {
      logger.info('Welcome email sent')
    }

    return emailResult
  } catch (error) {
    if (!isIgnoredMailgunError(error as Error)) {
      notifySentry({
        error: error as Error,
        message: 'Error sending welcome email'
      })
    }

    // associate with server/worker logs
    logger.error(error, 'Error sending welcome email')
  }
}

/**
 * Sends an email to the specified email address with a link to verify their email.
 *
 * @param name The user's name (optional).
 * @param email The user's email address.
 * @param key The email verification JWT.
 * Errors are logged and reported to Sentry, not thrown.
 */
export const sendVerificationEmail = async ({
  name,
  email,
  key,
  logger
}: {
  name?: string | null | undefined
  email: string
  key: string
  logger: NotificationLogger
}) => {
  try {
    const subject = '📊 Confirm your email address'
    const template = 'email confirmation'
    const url = `${getConfig().SORT_WEB_HOST}/confirm/email`
    const link = `${url}?key=${key}`

    const emailResult = await sendEmailNotification(
      {
        to: [`${name || email} <${email}>`],
        subject,
        template,
        'h:X-Mailgun-Variables': JSON.stringify({
          link,
          email
        })
      },
      logger
    )

    if (emailResult.status >= 400) {
      throw new Error(
        `Mailgun error [${emailResult.id}]: ${emailResult.message}`
      )
    }

    if (emailResult.details !== 'Email notifications are disabled') {
      logger.info('Confirmation email sent')
    }

    return emailResult
  } catch (error) {
    if (!isIgnoredMailgunError(error as Error)) {
      notifySentry({
        error: error as Error,
        message: 'Error sending confirmation email'
      })
    }

    // associate with server/worker logs
    logger.error(error, 'Error sending confirmation email')
  }
}

/**
 * Prevent URL injection by removing URLs and escaping the string.
 *
 * NOTE: Gmail converts "something.xyz" to a URL so remove "." as well.
 */
export const sanitize = (str: string) =>
  String(str)
    .replace(/\n|\r/gm, '')
    .replace(/(https?:\/\/)/gim, '')
    .replace(/\./gm, '-')
    .replace(/[<>"'&]/gm, (match: string) => {
      const code = match.charCodeAt(0)
      switch (code) {
        case 34: // "
          return '&quot;'
        case 38: // &
          return '&amp;'
        case 39: // '
          return '&#39;'
        case 60: // <
          return '&lt;'
        case 62: // >
          return '&gt;'
        default:
          return ''
      }
    })

/**
 * Sends a invite email to the specified email address.
 */
export const sendOrgInviteEmail = async ({
  fromName,
  fromEmail,
  toName,
  toEmail,
  org,
  inviteId,
  logger
}: {
  fromName: string
  fromEmail: string
  toName: string
  toEmail: string
  org: Organization
  inviteId: string
  logger: NotificationLogger
}) => {
  const orgName = capitalizeWord(sanitize(org.name))
  fromName = sanitize(fromName)

  const subject = `📊 ${fromName} invited you to join ${orgName} on Sort`
  const template = 'invite'

  const host = getConfig().SORT_WEB_HOST
  const inviteLink = `${host}/orgs/${org.slug}/invites/${inviteId}`

  const emailResult = await sendEmailNotification(
    {
      to: [`${toName || toEmail} <${toEmail}>`],
      subject,
      template,
      'h:X-Mailgun-Variables': JSON.stringify({
        sender_name: fromName,
        sender_email: fromEmail,
        org_name: orgName,
        invite_link: inviteLink
      })
    },
    logger
  )

  if (emailResult.status >= 400) {
    throw new Error(`Mailgun error [${emailResult.id}]: ${emailResult.message}`)
  }

  return emailResult
}
