/* eslint-disable no-console */
import { Buffer } from 'node:buffer'
import { parseArgs } from 'node:util'

import { Type } from '@sinclair/typebox'
import * as Config from '@sort/config'

const PROD_DOMAIN = 'mail.sort.xyz'
const SANDBOX_DOMAIN = 'sandbox7e4efdd6b47e4c2e934d48a4930dbffe.mailgun.org'

const config = Config.configure({
  directory: process.cwd(),
  schema: Type.Object({
    MAILGUN_API_KEY: Type.String()
  })
})

const usage = () => {
  console.log(`
    Usage: copy-mailgun-template -t <template> -d <destination>
  `)
}

const rawAuthorization = `api:${config.MAILGUN_API_KEY}`
const authorization = Buffer.from(rawAuthorization).toString('base64')

type TemplateResponse = {
  message?: string
  template: {
    name: string
    description: string
    version: {
      tag: string
      template: string
    }
  }
}

const getTemplate = async ({
  template,
  domain
}: {
  template: string
  domain: string
}) => {
  console.log(`Getting template "${template}" from ${domain} ..`)

  const r = await fetch(
    `https://api.mailgun.net/v3/${domain}/templates/${template}?active=yes`,
    {
      headers: {
        Authorization: `Basic ${authorization}`
      }
    }
  )
  if (r.status === 200) {
    const json = (await r.json()) as TemplateResponse
    return json.template
  }
  console.error(`status: ${r.status}; ${await r.text()}`)
  throw new Error(`Failed to get template "${template}" from ${domain}`)
}

const createTemplate = async ({
  name,
  description,
  domain,
  template
}: {
  name: string
  description: string
  domain: string
  template: string
}) => {
  console.log(`Creating template "${name}" in ${domain} ..`)

  const body = new FormData()
  body.set('name', name)
  body.set('description', description)
  body.set('template', template)

  const r = await fetch(`https://api.mailgun.net/v3/${domain}/templates`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authorization}`
    },
    body
  })

  if (r.status === 200) {
    const json = (await r.json()) as TemplateResponse
    if (json.message === 'template has been stored') {
      return json.template
    }
  }

  console.error(`status: ${r.status}; ${await r.text()}`)
  throw new Error(`Failed to create template "${template}" in ${domain}`)
}

const copy = async () => {
  const {
    values: { template, destination }
  } = parseArgs({
    strict: true,
    options: {
      template: {
        type: 'string',
        short: 't'
      },
      destination: {
        type: 'string',
        short: 'd'
      }
    }
  })

  if (!template) {
    console.error('Please provide a template name')
    usage()
    return
  }
  if (!destination) {
    console.error('Please provide a destination')
    usage()
    return
  }
  if (!/^(sandbox|prod(uction)?)$/.test(destination)) {
    console.error('Destination must be either "sandbox" or "production"')
    usage()
    return
  }

  const dest = destination === 'sandbox' ? SANDBOX_DOMAIN : PROD_DOMAIN
  const source = destination === 'sandbox' ? PROD_DOMAIN : SANDBOX_DOMAIN

  console.log(`Template: ${template}`)
  console.log(`Source: ${source}`)
  console.log(`Dest: ${dest}`)

  const oldTemplate = await getTemplate({ template, domain: source })
  await createTemplate({
    name: oldTemplate.name,
    description: oldTemplate.description,
    domain: dest,
    template: oldTemplate.version.template
  })

  console.log(`Template "${template}" copied to ${destination} successfully`)
}

copy().catch(err => {
  console.error(err)
  process.exit(1)
})
