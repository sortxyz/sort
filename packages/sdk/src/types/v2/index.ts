import type { Json } from "../index.js";

export type Message<
  TType extends string,
  TPayload extends Record<PropertyKey, unknown>,
> = {
  payload: TPayload;
  type: TType;
};

export type Review = {
  id: string;
  change_request_id: string;
  event_type: "APPROVE" | "COMMENT";
  text?: string;
  created_at: string;
  created_by: string;
  permissions?: Record<"update_review", Permission>;
};

export type ChangeField =
  | {
      column_name: string;
      value: string | null;
      type: "string" | "uuid" | "binary" | "date";
    }
  | {
      column_name: string;
      value: number | string | null;
      type: "numeric";
    }
  | {
      column_name: string;
      value: boolean | null;
      type: "boolean";
    }
  | {
      column_name: string;
      value: Json;
      type: "json";
    }
  | {
      column_name: string;
      value: null;
      type: "null";
    };

type ChangeBase = {
  change_request_id: string;
  database_name: string;
  id: string;
  index: number;
  schema_name: string;
  table_name: string;
};

type DeleteChange = ChangeBase & {
  action: "DELETE";
  primary_keys: ChangeField[];
  previous_fields: ChangeField[];
};

type ModifyChange = ChangeBase & {
  action: "MODIFY";
  fields: ChangeField[];
  primary_keys: ChangeField[];
  previous_fields: ChangeField[];
};

type AddChange = ChangeBase & {
  action: "ADD";
  fields: ChangeField[];
};

export type Change = AddChange | ModifyChange | DeleteChange;

type CreateChangeBase = {
  table_name: string;
  schema_name: string;
};

type AddCreateChange = CreateChangeBase & {
  action: "ADD";
  fields: { column_name: string; value: Json }[];
};

type ModifyCreateChange = CreateChangeBase & {
  action: "MODIFY";
  primary_keys: { column_name: string; value: Json }[];
  fields: { column_name: string; value: Json }[];
};

type DeleteCreateChange = CreateChangeBase & {
  action: "DELETE";
  primary_keys: { column_name: string; value: Json }[];
};

export type CreateChange =
  | AddCreateChange
  | ModifyCreateChange
  | DeleteCreateChange;

export type ChangeRequestComment = {
  change_id: string | null;
  change_request_id: string;
  content: string;
  created_at: string;
  created_by: string;
  id: string;
  review_id: string | null;
  updated_at: string;
};

type ChangeRequestTimelineItemBase = {
  change_request_id: string;
  created_at: string;
  id: string;
  user: User;
};

type FailExecuteChangeRequestTimelineItem = ChangeRequestTimelineItemBase & {
  action_details: {
    change_request_job_id: string;
    code: string;
    reason: string;
    sql: string;
  };
  action_type: "FAIL_EXECUTE";
};

type CompleteExecuteChangeRequestTimelineItem =
  ChangeRequestTimelineItemBase & {
    action_details: {
      change_request_job_id: string;
    };
    action_type: "COMPLETE_EXECUTE";
  };

type StartExecuteChangeRequestTimelineItem = ChangeRequestTimelineItemBase & {
  action_details: {
    change_request_job_id: string;
  };
  action_type: "START_EXECUTE";
};

type UpdateTitleChangeRequestTimelineItem = ChangeRequestTimelineItemBase & {
  action_details: {
    curr: string;
    prev: string;
  };
  action_type: "UPDATE_TITLE";
};

type UpdateReviewChangeRequestTimelineItem = ChangeRequestTimelineItemBase & {
  action_details: {
    event_type: "APPROVE" | "COMMENT";
    review_id: string;
    text: string | null;
  };
  action_type: "UPDATE_REVIEW";
  permissions?: Record<"update_review", Permission>;
};

type UpdateDescriptionChangeRequestTimelineItem =
  ChangeRequestTimelineItemBase & {
    action_details: {
      curr: string;
      prev: string;
    };
    action_type: "UPDATE_DESCRIPTION";
  };

type UpdateCommentChangeRequestTimelineItem = ChangeRequestTimelineItemBase & {
  action_details: {
    comment_id: string;
    content: string;
    change_id: null | string;
  };
  action_type: "UPDATE_COMMENT";
  permissions?: Record<"delete_comment" | "update_comment", Permission>;
};

type ReopenChangeRequestChangeRequestTimelineItem =
  ChangeRequestTimelineItemBase & {
    action_details: {
      change_request_number: number;
    };
    action_type: "REOPEN_CHANGE_REQUEST";
  };

type RemoveReviewerChangeRequestTimelineItem = ChangeRequestTimelineItemBase & {
  action_details: {
    reviewer: Member;
  };
  action_type: "REMOVE_REVIEWER";
};

type RemoveLabelChangeRequestTimelineItem = ChangeRequestTimelineItemBase & {
  action_details: {
    label: Label;
  };
  action_type: "REMOVE_LABEL";
};

type RemoveCommentChangeRequestTimelineItem = ChangeRequestTimelineItemBase & {
  action_details: {
    comment_id: string;
    content: string;
  };
  action_type: "REMOVE_COMMENT";
};

type CreateChangeRequestChangeRequestTimelineItem =
  ChangeRequestTimelineItemBase & {
    action_details: {
      change_request_number: number;
    };
    action_type: "CREATE_CHANGE_REQUEST";
  };

type CloseChangeRequestChangeRequestTimelineItem =
  ChangeRequestTimelineItemBase & {
    action_details: {
      change_request_number: number;
    };
    action_type: "CLOSE_CHANGE_REQUEST";
  };

type AddReviewerChangeRequestTimelineItem = ChangeRequestTimelineItemBase & {
  action_details: {
    reviewer: Member;
  };
  action_type: "ADD_REVIEWER";
};

type AddReviewChangeRequestTimelineItem = ChangeRequestTimelineItemBase & {
  action_details: {
    event_type: "APPROVE" | "COMMENT";
    review_id: string;
    text: string | null;
  };
  action_type: "ADD_REVIEW";
  permissions?: Record<"update_review", Permission>;
};

type AddLabelChangeRequestTimelineItem = ChangeRequestTimelineItemBase & {
  action_details: {
    label: Label;
  };
  action_type: "ADD_LABEL";
};

type AddCommentChangeRequestTimelineItem = ChangeRequestTimelineItemBase & {
  action_details: {
    comment_id: string;
    content: string;
    change_id: null | string;
  };
  action_type: "ADD_COMMENT";
  permissions?: Record<"delete_comment" | "update_comment", Permission>;
};

type AddChangeChangeRequestTimelineItem = ChangeRequestTimelineItemBase & {
  action_details: {
    change: {
      id: string;
      change_request_id: string;
      index: number;
      action: "MODIFY";
      connection_id: string;
      metadata_database_name: string;
      metadata_table_name: string;
      metadata_schema_name: string;
      fields: {
        id: string;
        change_id: string;
        column_name: string;
        is_value_null: boolean;
        string_value: string;
      }[];
      primary_keys: {
        id: string;
        change_id: string;
        column_name: string;
        string_value: string;
      }[];
    };
  };
  action_type: "ADD_CHANGE";
};

type DeleteChangeChangeRequesttimelineItem = ChangeRequestTimelineItemBase & {
  action_details: {
    change: {
      id: string;
      change_request_id: string;
      index: number;
      action: "MODIFY";
      connection_id: string;
      metadata_database_name: string;
      metadata_table_name: string;
      metadata_schema_name: string;
      fields: {
        id: string;
        change_id: string;
        column_name: string;
        is_value_null: boolean;
        string_value: string;
      }[];
      primary_keys: {
        id: string;
        change_id: string;
        column_name: string;
        string_value: string;
      }[];
      previous_fields: {
        id: string;
        change_id: string;
        column_name: string;
        is_value_null: boolean;
        string_value?: string;
        numeric_value?: string;
        date_value?: string;
        json_value?: Json;
      }[];
    };
  };
  action_type: "DELETE_CHANGE";
};

export type ChangeRequestTimelineItem =
  | AddChangeChangeRequestTimelineItem
  | AddCommentChangeRequestTimelineItem
  | AddLabelChangeRequestTimelineItem
  | AddReviewChangeRequestTimelineItem
  | AddReviewerChangeRequestTimelineItem
  | CloseChangeRequestChangeRequestTimelineItem
  | CompleteExecuteChangeRequestTimelineItem
  | CreateChangeRequestChangeRequestTimelineItem
  | DeleteChangeChangeRequesttimelineItem
  | FailExecuteChangeRequestTimelineItem
  | RemoveCommentChangeRequestTimelineItem
  | RemoveLabelChangeRequestTimelineItem
  | RemoveReviewerChangeRequestTimelineItem
  | ReopenChangeRequestChangeRequestTimelineItem
  | StartExecuteChangeRequestTimelineItem
  | UpdateCommentChangeRequestTimelineItem
  | UpdateDescriptionChangeRequestTimelineItem
  | UpdateReviewChangeRequestTimelineItem
  | UpdateTitleChangeRequestTimelineItem;

export type ChangeRequest = {
  change_request_number: number;
  connection_id: string;
  created_at: string;
  created_by: string;
  database_name: string;
  description: string | null;
  id: string;
  labels: Label[];
  permissions?: Record<
    | "create_comment"
    | "create_review"
    | "edit_changes"
    | "edit_labels"
    | "edit_relations"
    | "edit_reviewers"
    | "edit_title_description"
    | "open_close_change_request",
    Permission
  >;
  changes: Change[];
  reviewers: Member[];
  related_issues: ChangeRequestRelation[];
  status: "open" | "approved" | "closed" | "executing" | "applied";
  title: string;
  updated_at: string;
};

export type DashboardItem = {
  id: string;
  item_number: number;
  item_type: "issue" | "change_request";
  title: string;
  description: string;
  created_at: string;
  created_by: string;
  database_name: string;
  database_slug: string;
  labels: Label[];
  status: "open" | "approved" | "closed" | "executing" | "applied";
  assignees: Member[];
  reviewers: Member[];
};

export type IssueComment = {
  content: string;
  created_at: string;
  created_by: string;
  id: string;
  issue_id: string;
  updated_at: string;
};

type IssueTimelineItemBase = {
  created_at: string;
  id: string;
  issue_id: string;
  user: User;
};

type UpdateTitleIssueTimelineItem = IssueTimelineItemBase & {
  action_details: {
    curr: string;
    prev: string;
  };
  action_type: "UPDATE_TITLE";
};

type UpdateDescriptionIssueTimelineItem = IssueTimelineItemBase & {
  action_details: {
    curr: string;
    prev: string;
  };
  action_type: "UPDATE_DESCRIPTION";
};

type UpdateCommentIssueTimelineItem = IssueTimelineItemBase & {
  action_details: {
    comment_id: string;
    content: string;
  };
  action_type: "UPDATE_COMMENT";
  permissions?: Record<"delete_comment" | "update_comment", Permission>;
};

type RemoveLabelIssueTimelineItem = IssueTimelineItemBase & {
  action_details: {
    label: Label;
  };
  action_type: "REMOVE_LABEL";
};

type RemoveAssigneeIssueTimelineItem = IssueTimelineItemBase & {
  action_details: {
    assignee: Member;
  };
  action_type: "REMOVE_ASSIGNEE";
};

type ReopenIssueIssueTimelineItem = IssueTimelineItemBase & {
  action_details: {
    issue_number: number;
  };
  action_type: "REOPEN_ISSUE";
};

type CreateIssueIssueTimelineItem = IssueTimelineItemBase & {
  action_details: {
    issue_number: number;
  };
  action_type: "CREATE_ISSUE";
};

type CloseIssueIssueTimelineItem = IssueTimelineItemBase & {
  action_details: {
    issue_number: number;
  };
  action_type: "CLOSE_ISSUE";
};

type AddLabelIssueTimelineItem = IssueTimelineItemBase & {
  action_details: {
    label: Label;
  };
  action_type: "ADD_LABEL";
};

type AddCommentIssueTimelineItem = IssueTimelineItemBase & {
  action_details: {
    comment_id: string;
    content: string;
  };
  action_type: "ADD_COMMENT";
  permissions?: Record<"delete_comment" | "update_comment", Permission>;
};

type AddAssigneeIssueTimelineItem = IssueTimelineItemBase & {
  action_details: {
    assignee: Member;
  };
  action_type: "ADD_ASSIGNEE";
};

export type IssueTimelineItem =
  | AddAssigneeIssueTimelineItem
  | AddCommentIssueTimelineItem
  | AddLabelIssueTimelineItem
  | CloseIssueIssueTimelineItem
  | CreateIssueIssueTimelineItem
  | RemoveAssigneeIssueTimelineItem
  | RemoveLabelIssueTimelineItem
  | ReopenIssueIssueTimelineItem
  | UpdateCommentIssueTimelineItem
  | UpdateDescriptionIssueTimelineItem
  | UpdateTitleIssueTimelineItem;

export type Label = {
  color: string;
  description: string | null;
  id: string;
  name: string;
};

export type Issue = {
  assignees: Member[];
  created_at: string;
  created_by: string;
  description: string | null;
  id: string;
  issue_number: number;
  labels: Label[];
  permissions?: Record<
    | "create_comment"
    | "edit_assignees"
    | "edit_labels"
    | "edit_title_description"
    | "open_close_issue"
    | "edit_relations",
    Permission
  >;
  status: "open" | "closed";
  title: string;
  updated_at: string;
  related_change_requests: IssueRelation[];
};

export type HomePageQuery = {
  connection_data_provider: "postgres" | "snowflake";
  connection_id: string;
  db_display_name: string;
  db_real_name: string;
  db_slug: string;
  org_slug: string;
  query_description: string;
  query_id: string;
  query_name: string;
  query_schema: string;
  updated_at: string;
};

export type HomePageDatabase = {
  connection_id: string;
  data_provider: "postgres" | "snowflake";
  db_display_name: string;
  db_real_name: string;
  db_slug: string;
  db_summary: string;
  org_slug: string;
  updated_at: string;
};

type QueryBase = {
  connection_id: string;
  created_at: string;
  created_by_name: string;
  created_by_picture: string;
  created_by_username: string;
  created_by: string;
  database_name: string;
  database_slug: string;
  description: string | null;
  id: string;
  name: string;
  org_slug: string;
  updated_at: string;
};

type SqlQuery = QueryBase & {
  sql: string;
  type: "sql";
};

type IntentQuery = QueryBase & {
  intent: {
    columns: string[];
    combinator: "AND" | "OR";
    dml: "SELECT";
    filters: QueryIntentFilter[];
    limit: number;
    orders: QueryIntentOrder[];
    schema: string;
    table: string;
  };
  type: "intent";
};

export type Query = IntentQuery | SqlQuery;

type QueryIntentOrder = {
  column: string;
  direction: "ASC" | "DESC";
};

export type QueryIntentFilter = {
  column: string;
  op: "=" | "!=" | ">" | "<" | ">=" | "<=";
  value: string;
};

export type Column = {
  is_primary_key: boolean;
  has_default: boolean;
  name: string;
  nullable: boolean;
  type:
    | "string"
    | "numeric"
    | "date"
    | "boolean"
    | "json"
    | "uuid"
    | "binary"
    | "unknown";
};

export type Table = {
  id: string;
  name: string;
  columns?: Column[];
};

export type Schema = {
  id: string;
  name: string;
  tables?: Table[];
};

export type Profile = User & {
  email: string;
  email_verified: boolean;
};

export type APIKey = {
  id: string;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailSubscription = {
  email: string;
  name: string;
  subscribed: boolean;
};

export type MetadataDatabase = {
  connection_id: string;
  description: string | null;
  display_name: string | null;
  organization_id: string;
  organization_slug: string;
  raw_name: string;
  slug: string;
  summary: string | null;
};

export type Database = {
  connection_id: string;
  connection: string;
  data_provider: string;
  display_name: string;
  is_starred: false;
  name: string;
  organization_slug: string;
  schemas: [string, ...string[]];
  slug: string;
  summary: string;
  visibility: "private" | "public";
};

type IssueRelation = {
  change_request_id: string;
  change_request_number: number;
  change_request_title: string;
};

type ChangeRequestRelation = {
  issue_id: string;
  issue_number: number;
  issue_title: string;
};

type User = {
  id: string;
  name: string;
  picture: string;
  username: string;
};

export type Member = {
  role: {
    id: number;
    name: string;
  };
  user: User;
};

export type SearchResults = {
  databases: DatabaseSearchResult[];
  organizations: OrganizationSearchResult[];
  tables: TableSearchResult[];
};

type TableSearchResult = {
  connection_id: string;
  connection_name: string;
  db_name_raw: string;
  db_name: string;
  db_slug: string;
  org_name: string;
  org_slug: string;
  schema_name_raw: string;
  schema_name: string;
  table_name_raw: string;
  table_name: string;
};

type DatabaseSearchResult = {
  connection_id: string;
  connection_name: string;
  db_name_raw: string;
  db_name: string;
  db_slug: string;
  org_name: string;
  org_slug: string;
};

type OrganizationSearchResult = {
  org_name: string;
  org_slug: string;
};

export type ConnectionTest = {
  message: string;
  success: boolean;
};

export type Connection = {
  created_at: string;
  created_by: string;
  data_provider: "postgres" | "snowflake";
  id: string;
  name: string;
  organization_id: string;
  readonly_connection_id?: string | null;
  visibility: "private" | "public";
  warehouse?: string | null;
  with_ssl: boolean;
};

export type OrganizationInvite = {
  created_at: string;
  created_by: string;
  email: string;
  id: string;
  name: string;
  organization_id: string;
  role_id: number;
  status: "pending" | "accepted" | "rejected" | "rescinded";
};

export type Organization = {
  created_at: string;
  created_by: string;
  description: string | null;
  id: string;
  link: string | null;
  name: string;
  permissions?: Record<
    | "edit_queries"
    | "is_member"
    | "is_owner"
    | "manage_roles"
    | "save_queries"
    | "view_database_settings"
    | "view_invites"
    | "view_settings",
    Permission
  >;
  slug: string;
  banner: string | null;
  slack_webhook_url: string | null;
  discord_webhook_url: string | null;
};

export type Permission = {
  message?: string;
  value: boolean;
};

type Success = {
  message: string;
};

type ValidationError = {
  errors: Partial<
    Record<"query" | "body" | "headers" | "params", Record<string, string>>
  >;
  message: string;
};

type Error = {
  message: string;
};

export type SuccessMessage = Message<"success", { success: Success }>;
export type ValidationErrorMessage = Message<
  "validation_error",
  { validation_error: ValidationError }
>;
export type ErrorMessage = Message<"error", { error: Error }>;

export type UpdateQuery = Query extends infer T
  ? T extends unknown
    ? Pick<
        T,
        Extract<keyof T, "type" | "intent" | "sql" | "name" | "description">
      >
    : never
  : never;

export type QueryResult = {
  columns: Pick<Column, "name" | "type">[];
  duration_ms: number;
  query: string;
  records: Json[][];
};

export type CreateQuery = Query extends infer T
  ? T extends unknown
    ? Pick<
        T,
        Extract<keyof T, "type" | "intent" | "sql" | "name" | "description">
      >
    : never
  : never;
