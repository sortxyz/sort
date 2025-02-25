import * as ConnectionService from '../connection.service'

import type { FullChangeRequestResponse } from '../../schemas/change-request.schema'
import type { Organization } from '../../schemas/org.schema'
import type { ReviewPermissions } from '../../schemas/permissions.schema'
import type { Review } from '../../schemas/review.schema'
import type { ReviewNeedsPermissionsSet as NeedsPermissionsSet } from '../../types/change-requests'
import type { SortContext } from '../../types/sort-context.type'

const PrivateDefaultPermissionSet: NeedsPermissionsSet = {
  needsCustomerAccount: true,
  needsMember: true,
  needsCreator: false
}

const PublicDefaultPermissionSet: NeedsPermissionsSet = {
  needsCustomerAccount: true,
  needsMember: false,
  needsCreator: false
}

type ValidationStates = 200 | 404 | 403

type ReviewPermissionsOptions = {
  isCreator?: boolean // creator of the review
  prv?: NeedsPermissionsSet
  pub?: NeedsPermissionsSet
}

export const validateReviewPermissions = async (
  connectionId: string,
  sortContext: SortContext,
  org: Organization,
  { isCreator, prv, pub }: ReviewPermissionsOptions = {
    prv: PrivateDefaultPermissionSet,
    pub: PublicDefaultPermissionSet
  }
): Promise<ValidationStates> => {
  // overlay passed permissions with our defaults
  prv = { ...PrivateDefaultPermissionSet, ...prv }
  pub = { ...PublicDefaultPermissionSet, ...pub }

  const connection = (await ConnectionService.getById(connectionId))!
  const permSet = connection.visibility === 'private' ? prv : pub

  if (permSet.needsCustomerAccount && !sortContext.isCustomerAccount) {
    return 404
  }

  if (permSet?.needsMember && !org?.permissions?.is_member.value) {
    return connection.visibility === 'private' ? 404 : 403
  }

  if (permSet?.needsCreator && !isCreator) {
    if (org?.permissions?.is_member.value) {
      return 403
    }
    return connection.visibility === 'private' ? 404 : 403
  }

  return 200
}

export const getReviewPermissions = async (
  review: Review,
  changeRequest: FullChangeRequestResponse,
  org: Organization,
  sortContext: SortContext
) => {
  const isCreator = sortContext.user.id === review.created_by

  const updateItemValue = await validateReviewPermissions(
    changeRequest.connection_id,
    sortContext,
    org,
    { isCreator }
  )

  return {
    edit_text: {
      value: updateItemValue === 200,
      message: 'You do not have permission to edit this review'
    }
  } satisfies ReviewPermissions
}
