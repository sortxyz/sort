import type { User } from './user.type'

/**
 * @property user - The authenticated user.
 * @property isPublicAccount - Signifies if the `user` is the _public_ account (SortWeb service account).
 * @property isCustomerAccount - Signifies if the `user` is a _customer_ account. The opposite of `isPublicAccount`.
 */
export type SortContext = {
  user: User
  isPublicAccount: boolean
  isCustomerAccount: boolean
}
