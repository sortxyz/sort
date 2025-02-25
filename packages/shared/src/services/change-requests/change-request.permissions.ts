import * as ConnectionService from '../connection.service'

import type { FullChangeRequestResponse } from '../../schemas/change-request.schema'
import type { Organization } from '../../schemas/org.schema'
import type {
  ChangeRequestCommentPermissions,
  ChangeRequestPermissions
} from '../../schemas/permissions.schema'
import type { ChangeRequestNeedsPermissionsSet as NeedsPermissionsSet } from '../../types/change-requests'
import type { SortContext } from '../../types/sort-context.type'

const PrivateDefaultPermissionSet = {
  needsCustomerAccount: true,
  needsOwner: false,
  needsMember: true,
  needsAuthor: false,
  needsAuthorOrOrgMember: false,
  needsAuthorOrOrgOwner: false
} satisfies NeedsPermissionsSet

const PublicDefaultPermissionSet = {
  needsCustomerAccount: true,
  needsOwner: false,
  needsMember: false,
  needsAuthor: false,
  needsAuthorOrOrgMember: false,
  needsAuthorOrOrgOwner: false
} satisfies NeedsPermissionsSet

export type ValidationStates = 200 | 404 | 403

export type ChangeRequestPermissionsOptions = {
  isAuthor?: boolean
  prv?: NeedsPermissionsSet
  pub?: NeedsPermissionsSet
}

export const validateChangeRequestPermissions = async (
  connectionId: string,
  sortContext: SortContext,
  org: Organization,
  { isAuthor, prv, pub }: ChangeRequestPermissionsOptions = {
    isAuthor: false,
    prv: PrivateDefaultPermissionSet,
    pub: PublicDefaultPermissionSet
  }
): Promise<ValidationStates> => {
  // overlay passed permissions with our defaults
  prv = { ...PrivateDefaultPermissionSet, ...prv }
  pub = { ...PublicDefaultPermissionSet, ...pub }

  const connection = (await ConnectionService.getById(connectionId))!
  const permSet = connection.visibility === 'private' ? prv : pub

  if (permSet?.needsCustomerAccount && !sortContext.isCustomerAccount) {
    return 404
  }
  if (permSet?.needsOwner && !org?.permissions?.is_owner.value) {
    return 404
  }
  if (permSet?.needsMember && !org?.permissions?.is_member.value) {
    return 404
  }

  if (connection.visibility === 'private') {
    if (prv?.needsAuthor && !isAuthor) {
      if (
        org?.permissions?.is_owner.value ||
        org?.permissions?.is_member.value
      ) {
        return 403
      }
      return 404
    } else {
      if (
        prv?.needsAuthorOrOrgMember &&
        !(isAuthor || org?.permissions?.is_member.value)
      ) {
        return 404
      }
      if (
        prv?.needsAuthorOrOrgOwner &&
        !(isAuthor || org?.permissions?.is_owner.value)
      ) {
        return 403
      }
    }
  } else if (connection.visibility === 'public') {
    if (pub?.needsAuthor && !isAuthor) {
      return 403
    } else {
      if (
        pub?.needsAuthorOrOrgMember &&
        !(isAuthor || org?.permissions?.is_member.value)
      ) {
        return 403
      }
      if (
        pub?.needsAuthorOrOrgOwner &&
        !(isAuthor || org?.permissions?.is_owner.value)
      ) {
        return 403
      }
    }
  }

  return 200
}

export const getChangeRequestPermissions = async (
  changeRequest: FullChangeRequestResponse,
  org: Organization,
  sortContext: SortContext
) => {
  const updateItemValue = await validateChangeRequestPermissions(
    changeRequest.connection_id,
    sortContext,
    org,
    {
      isAuthor: sortContext.user.id === changeRequest.created_by,
      pub: { needsAuthorOrOrgMember: true },
      prv: { needsAuthorOrOrgMember: true }
    }
  )

  const createCommentValue = await validateChangeRequestPermissions(
    changeRequest.connection_id,
    sortContext,
    org,
    {
      pub: { needsCustomerAccount: false }
    }
  )

  return {
    edit_title_description: {
      value: updateItemValue === 200,
      message: 'You do not have permission to edit the title and description.'
    },
    edit_labels: {
      value: updateItemValue === 200,
      message: 'You do not have permission to edit labels.'
    },
    edit_reviewers: {
      value: updateItemValue === 200,
      message: 'You do not have permission to edit reviewers.'
    },
    open_close_change_request: {
      value: updateItemValue === 200,
      message:
        'You do not have permission to open or close this change request.'
    },
    create_review: {
      value: !!org.permissions?.is_member.value,
      message: 'You do not have permission to create a review.'
    },
    create_comment: {
      value: createCommentValue === 200,
      message: 'You do not have permission to create a comment.'
    },
    edit_relations: {
      value: updateItemValue === 200,
      message: 'You do not have permission to edit relations.'
    },
    edit_changes: {
      value:
        updateItemValue === 200 &&
        changeRequest.status !== 'executing' &&
        changeRequest.status !== 'applied' &&
        changeRequest.status !== 'closed',
      message: 'You do not have permission to edit changes.'
    }
  } satisfies ChangeRequestPermissions
}

export const updateCommentPermissionValues = (isAuthor: boolean) => ({
  isAuthor,
  pub: { needsAuthor: true },
  prv: { needsAuthor: true }
})

export const deleteCommentPermissionValues = (isAuthor: boolean) => ({
  isAuthor,
  pub: { needsAuthorOrOrgOwner: true },
  prv: { needsAuthorOrOrgOwner: true }
})

export const getChangeRequestCommentPermissions = async (
  changeRequest: FullChangeRequestResponse,
  changeRequestCommentAuthor: string,
  org: Organization,
  sortContext: SortContext
) => {
  const updateCommentValue = await validateChangeRequestPermissions(
    changeRequest.connection_id,
    sortContext,
    org,
    updateCommentPermissionValues(
      changeRequestCommentAuthor === sortContext.user.id
    )
  )

  const deleteCommentValue = await validateChangeRequestPermissions(
    changeRequest.connection_id,
    sortContext,
    org,
    deleteCommentPermissionValues(
      changeRequestCommentAuthor === sortContext.user.id
    )
  )

  return {
    update_comment: {
      value: updateCommentValue === 200,
      message: 'You do not have permission to update this comment.'
    },
    delete_comment: {
      value: deleteCommentValue === 200,
      message: 'You do not have permission to delete this comment.'
    }
  } satisfies ChangeRequestCommentPermissions
}
