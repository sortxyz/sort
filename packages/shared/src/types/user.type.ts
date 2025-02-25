import { Type } from '@sinclair/typebox'

import { TNullable } from './nullable.type'

import type { Static } from '@sinclair/typebox'

// eslint-disable-next-line
export const TUser = Type.Object({
  id: Type.String(),
  username: Type.String({ minLength: 2, maxLength: 128 }),
  username_discord: TNullable(Type.String()),
  name: Type.Optional(TNullable(Type.String({ minLength: 1, maxLength: 256 }))),
  email: Type.Optional(
    TNullable(Type.String({ minLength: 5, maxLength: 1024, format: 'email' }))
  ),
  email_verified: Type.Boolean(),
  picture: Type.Optional(TNullable(Type.String({ maxLength: 180 }))),
  administrator: Type.Optional(Type.Boolean())
})

export type User = Static<typeof TUser>
