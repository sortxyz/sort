import FormData from 'form-data'
import Mailgun from 'mailgun.js'

export const gun = new Mailgun(FormData)

export const createClient = (apiKey: string) => {
  return gun.client({ username: 'api', key: apiKey })
}
