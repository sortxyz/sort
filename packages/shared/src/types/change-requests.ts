export type ReviewNeedsPermissionsSet = {
  needsCustomerAccount?: boolean
  needsOwner?: boolean
  needsMember?: boolean
  needsCreator?: boolean // creator of the review
  needsCreatorOrOrgMember?: boolean
}

export type ChangeRequestNeedsPermissionsSet = {
  needsCustomerAccount?: boolean
  needsOwner?: boolean
  needsMember?: boolean
  needsAuthor?: boolean
  needsAuthorOrOrgMember?: boolean
  needsAuthorOrOrgOwner?: boolean
}

export type ChangeNeedsPermissionsSet = ChangeRequestNeedsPermissionsSet
