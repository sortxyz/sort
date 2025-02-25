/* eslint-disable no-console */
import { createAPIKey } from '@sort/shared/services/apikey.service'

import {
  createKysely,
  getDb,
  disconnectKysely
} from '../global/services/kysely.service'

const waitForPostgres = async () => {
  let tries = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await getDb().selectFrom('user').selectAll().limit(1).execute()
      break
    } catch (err) {
      if (tries > 10) {
        throw new Error('Could not connect to Postgres')
      }
      tries++
      await new Promise(resolve => setTimeout(resolve, 250))
    }
  }
}

const main = async () => {
  createKysely()
  await waitForPostgres()
  await createSvcTestUser()
}

export const createSvcTestUser = async () => {
  const svcUser = await getDb()
    .selectFrom('user')
    .where('email', '=', 'svc-sortui-test@sort.xyz')
    .selectAll()
    .limit(1)
    .executeTakeFirst()

  if (!svcUser) {
    const user = {
      id: 'auth0|6549456e0184b0831f527859',
      email: 'svc-sortui-test@sort.xyz',
      name: 'Sort UI Test Service Account',
      username: 'svc-sortui-test',
      picture:
        'https://s.gravatar.com/avatar/a9dff7c85f5b55bba3a497ddc2d705e9?s=480&r=pg&d=monsterid'
    }

    await getDb().insertInto('user').values(user).executeTakeFirstOrThrow()

    const apiKey = await createAPIKey({
      userId: user.id,
      summary: 'Sort UI test service account api key',
      salt: 'MS08ZTdhLTlhOTMtYTJh3kNzg',
      plainTextKey: '88b67a02-43e1-4872-8f9f-1111a1a44fff',
      rowId: 'd5adecc4-7793-413c-be86-a69eb905d231'
    })

    console.log()
    // eslint-disable-next-line prettier/prettier
    console.log('*********************************************************************************')
    console.log('')
    console.log(' Created test user account.')
    console.log(` API key: ${apiKey.api_key}  `)
    console.log('')
    // eslint-disable-next-line prettier/prettier
    console.log('*********************************************************************************')
    console.log()
  }
}

main()
  .then(() => {
    return disconnectKysely()
  })
  .catch(err => {
    console.error(err)
    return disconnectKysely().finally(() => process.exit(1))
  })
