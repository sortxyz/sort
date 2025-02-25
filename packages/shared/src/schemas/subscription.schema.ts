import { Type } from '@sinclair/typebox'

import { StringEnum } from './api.schema'

import type { Static } from '@sinclair/typebox'

export const SubscriptionNameSchema = StringEnum(['newsletter'])

export const SubscriptionSchema = Type.Object(
  {
    email: Type.String({ format: 'email' }),
    name: SubscriptionNameSchema,
    subscribed: Type.Boolean()
  },
  { $id: 'SubscriptionSchema' }
)

export type Subscription = Static<typeof SubscriptionSchema>
