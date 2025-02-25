import { Type } from '@sinclair/typebox'

import type { Static } from '@sinclair/typebox'

export const PermissionSchema = Type.Object({
  value: Type.Boolean(),
  message: Type.Optional(Type.String())
})
export type Permission = Static<typeof PermissionSchema>

export const IssuePermissionsSchema = Type.Object({
  edit_title_description: PermissionSchema,
  edit_labels: PermissionSchema,
  edit_assignees: PermissionSchema,
  open_close_issue: PermissionSchema,
  create_comment: PermissionSchema,
  edit_relations: PermissionSchema
})

export type IssuePermissions = Static<typeof IssuePermissionsSchema>

export const IssueCommentPermissionsSchema = Type.Object({
  update_comment: PermissionSchema,
  delete_comment: PermissionSchema
})

export type IssueCommentPermissions = Static<
  typeof IssueCommentPermissionsSchema
>

export const ChangeRequestPermissionsSchema = Type.Object({
  create_comment: PermissionSchema,
  create_review: PermissionSchema,
  edit_changes: PermissionSchema,
  edit_labels: PermissionSchema,
  edit_relations: PermissionSchema,
  edit_reviewers: PermissionSchema,
  edit_title_description: PermissionSchema,
  open_close_change_request: PermissionSchema
})

export type ChangeRequestPermissions = Static<
  typeof ChangeRequestPermissionsSchema
>

export const ChangeRequestCommentPermissionsSchema = Type.Object({
  update_comment: PermissionSchema,
  delete_comment: PermissionSchema
})

export type ChangeRequestCommentPermissions = Static<
  typeof ChangeRequestCommentPermissionsSchema
>

export const ReviewPermissionsSchema = Type.Object({
  edit_text: PermissionSchema
})

export type ReviewPermissions = Static<typeof ReviewPermissionsSchema>
