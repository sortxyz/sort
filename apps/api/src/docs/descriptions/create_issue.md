Database Issues are often used to track improvements, answer questions, report inconsistencies, or dialog how to improve queries. Issues can be labeled, assigned and related to Change Requests.

### Request body

Title is required. All other fields are optional.

#### Labels

To set `labels`, you'll pass the `id`s of the Labels you are adding. To see all available database labels, use the [`list_database_labels`](#tag/label/GET/v2/orgs/{org_slug}/databases/{db_slug}/labels) operation.

#### Assignees

#### Related Change Requests

To relate Change Requests to this Issue, pass an array of the Change Request `number`s. Use the [`search_change_requests`](#tag/search/GET/v2/orgs/{org_slug}/databases/{db_slug}/search/change-requests) operation to see all available Change Requests.


[Guide]: https://docs.sort.xyz/docs/issues/create-a-new-issue
