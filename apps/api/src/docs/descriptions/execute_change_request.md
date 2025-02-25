Schedules the Change Request for execution. The Change Request does not execute immediately, rather, a task is scheduled and an HTTP response is sent immediately.

After calling this endpoint, the Change Request `status` will be one of the following:

- `approved` - Before execution begins OR if the task failed (see "Timeline events" below)
- `executing` - Change Request execution is in-progress
- `applied` - Execution was successful

Run the [`get_change_request`](#tag/change_request/GET/v2/orgs/{org_slug}/databases/{db_slug}/change-requests/{change_request_number}) operation to see the current `status` of the Change Request.

### Timeline events

This endpoint triggers the following Timeline events:

- `START_EXECUTE` - Created when this endpoint is called
- `COMPLETE_EXECUTE` - Created after execution succeeds
- `FAIL_EXECUTE` - Created when execution fails

The Change Request Timeline records a log of Change Request events which occurred. You can get the details by calling the [`list_change_request_timeline`](#tag/change_request/GET/v2/orgs/{org_slug}/databases/{db_slug}/change-requests/{change_request_number}/timeline) endpoint.

### Idempotence

If the execution task was already scheduled for the Change Request, an HTTP status 409 will be returned.
