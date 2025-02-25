import { Type } from '@sinclair/typebox'

import { TUser as UserSchema } from '../types/user.type'

export const ProfileSchema = Type.Pick(
  UserSchema,
  ['id', 'email', 'name', 'picture', 'username', 'email_verified'],
  { $id: 'ProfileSchema' }
)
