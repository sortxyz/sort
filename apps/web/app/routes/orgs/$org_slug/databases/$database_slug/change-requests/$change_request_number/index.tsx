import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  data,
  Link,
  redirect,
  useFetcher,
  useLoaderData,
  useParams,
  useRouteLoaderData,
} from "react-router";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { dataFnMiddleware } from "~/utils/request.server";
import {
  assertResponse,
  assertResponseParams,
  extractMessageOrThrow,
} from "~/utils/response";

import type { DefaultValue } from "@conform-to/react";
import {
  getCollectionProps,
  getFormProps,
  getInputProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import type { V2 } from "@sort/sdk";
import { mergeHeaders } from "@sort/sdk";
import {
  IconCheck,
  IconDotsVertical,
  IconEdit,
  IconGitPullRequest,
  IconLabel,
  IconMaximize,
  IconMinimize,
  IconRefresh,
  IconTable,
  IconUserCircle,
  IconUsersPlus,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { z } from "zod";
import { LinkAnchor } from "~/components/anchor";
import { Avatar } from "~/components/avatar";
import { Button } from "~/components/button";
import { ChangeTable } from "~/components/change-table";
import { ControlMarkdownFieldTextarea } from "~/components/control-markdown-field";
import {
  DropDown,
  DropDownItem,
  DropDownTrigger,
} from "~/components/drop-down";
import {
  FormDrawer,
  FormDrawerFooter,
  FormDrawerHeader,
  FormDrawerSection,
} from "~/components/form-drawer";
import {
  InlineField,
  InlineFieldInput,
  InlineFieldLabel,
} from "~/components/inline-field";
import { Markdown } from "~/components/markdown";
import { RelativeTime } from "~/components/relative-time";
import { Spinner } from "~/components/spinner";
import { Tag } from "~/components/tag";
import type { loader as orgLoader } from "~/routes/orgs/$org_slug";
import type { loader as changeRequestLoader } from "~/routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number";
import { client } from "~/sdk/client.server";
import { getFlags } from "~/services/flags.server";
import { getTextColor } from "~/utils/color";
import { validateCsrf } from "~/utils/csrf.server";
import { setFlashHeaders } from "~/utils/flash";
import { errorMessageToReplyOptions } from "~/utils/message";
import { pluralize } from "~/utils/string";

type FormDrawerState =
  | "closed"
  | "editLabelsOpen"
  | "editReviewersOpen"
  | "editRelatedIssuesOpen";

type ProcessedChangeRequestTimelineItemUpdateReviewers = Omit<
  V2.ChangeRequestTimelineItem,
  "action_type" | "action_details"
> & {
  action_type: "UPDATE_REVIEWERS";
  action_details: {
    added: V2.Member[];
    removed: V2.Member[];
  };
};

type ProcessedChangeRequestTimelineItemUpdateLabels = Omit<
  V2.ChangeRequestTimelineItem,
  "action_type" | "action_details"
> & {
  action_type: "UPDATE_LABELS";
  action_details: {
    added: V2.Label[];
    removed: V2.Label[];
  };
};

type ProcessedChangeRequestTimelineItem =
  | Exclude<
      V2.ChangeRequestTimelineItem,
      {
        action_type:
          | "ADD_REVIEWER"
          | "REMOVE_REVIEWER"
          | "ADD_LABEL"
          | "REMOVE_LABEL";
      }
    >
  | ProcessedChangeRequestTimelineItemUpdateReviewers
  | ProcessedChangeRequestTimelineItemUpdateLabels;

function groupItemsByTimeAndType(timelineData: V2.ChangeRequestTimelineItem[]) {
  const groupedEvents: Record<
    number,
    Partial<{
      [ActionType in V2.ChangeRequestTimelineItem["action_type"]]: Extract<
        V2.ChangeRequestTimelineItem,
        { action_type: ActionType }
      >[];
    }>
  > = {};

  // Group all events by their exact timestamp
  for (const event of timelineData) {
    const timestamp = new Date(event.created_at).getTime();
    const type = event.action_type;

    const groupedEventsByTimestamp = (groupedEvents[timestamp] ??= {});

    const processedChangeRequestTimelineArray = (groupedEventsByTimestamp[
      type
    ] ??= []);

    // @ts-expect-error - We know this is correct because we're grouping by type
    processedChangeRequestTimelineArray.push(event);
  }

  return groupedEvents;
}

function getProcessedChangeRequestTimeline(
  timelineData: V2.ChangeRequestTimelineItem[],
) {
  const groupedEvents = groupItemsByTimeAndType(timelineData);

  const processedEvents: ProcessedChangeRequestTimelineItem[] = [];

  // For each timestamp
  for (const {
    ADD_LABEL = [],
    REMOVE_LABEL = [],
    ADD_REVIEWER = [],
    REMOVE_REVIEWER = [],
    ...timestampEvents
  } of Object.values(groupedEvents)) {
    // Process label events
    if (ADD_LABEL.length || REMOVE_LABEL.length) {
      const labelEvents = [...ADD_LABEL, ...REMOVE_LABEL];

      const firstEvent = labelEvents[0];

      if (!firstEvent) {
        continue;
      }

      const action_details: Record<"added" | "removed", V2.Label[]> = {
        added: [],
        removed: [],
      };

      for (const labelEvent of labelEvents) {
        switch (labelEvent.action_type) {
          case "ADD_LABEL":
            action_details.added.push(labelEvent.action_details.label);
            break;
          case "REMOVE_LABEL":
            action_details.removed.push(labelEvent.action_details.label);
            break;
        }
      }

      processedEvents.push({
        id: firstEvent.id,
        action_type: "UPDATE_LABELS",
        created_at: firstEvent.created_at,
        user: firstEvent.user,
        change_request_id: firstEvent.change_request_id,
        action_details,
      });
    }

    // Process reviewer events
    if (ADD_REVIEWER.length || REMOVE_REVIEWER.length) {
      const reviewerEvents = [...ADD_REVIEWER, ...REMOVE_REVIEWER];

      const firstEvent = reviewerEvents[0];

      if (!firstEvent) {
        continue;
      }

      const action_details: Record<"added" | "removed", V2.Member[]> = {
        added: [],
        removed: [],
      };

      for (const reviewerEvent of reviewerEvents) {
        switch (reviewerEvent.action_type) {
          case "ADD_REVIEWER":
            action_details.added.push(reviewerEvent.action_details.reviewer);
            break;
          case "REMOVE_REVIEWER":
            action_details.removed.push(reviewerEvent.action_details.reviewer);
            break;
        }
      }

      processedEvents.push({
        id: firstEvent.id,
        action_type: "UPDATE_REVIEWERS",
        created_at: firstEvent.created_at,
        user: firstEvent.user,
        change_request_id: firstEvent.change_request_id,
        action_details: action_details,
      });
    }

    // Process the rest of the events
    processedEvents.push(...Object.values(timestampEvents).flat());
  }

  return processedEvents;
}

const INTENTS = {
  createChangeRequestComment: "createChangeRequestComment",
  deleteChangeRequestComment: "deleteChangeRequestComment",
  executeChangeRequest: "executeChangeRequest",
  updateChangeRequest: "updateChangeRequest",
  updateChangeRequestComment: "updateChangeRequestComment",
  updateChangeRequestLabels: "updateChangeRequestLabels",
  updateChangeRequestRelatedIssues: "updateChangeRequestRelatedIssues",
  updateChangeRequestReviewers: "updateChangeRequestReviewers",
  updateReview: "updateReview",
  createUndoChangeRequest: "createUndoChangeRequest",
} as const;

const schema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal(INTENTS.updateChangeRequest),
    title: z.string().min(1).optional(),
    description: z.string().min(1).nullable().default(null),
    status: z.enum(["open", "closed"]).optional(),
  }),
  z.object({
    intent: z.literal(INTENTS.updateChangeRequestLabels),
    labels: z.array(z.string().min(1)).optional().default([]),
  }),
  z.object({
    intent: z.literal(INTENTS.updateChangeRequestReviewers),
    reviewers: z.array(z.string().min(1)).optional().default([]),
  }),
  z.object({
    intent: z.literal(INTENTS.updateChangeRequestRelatedIssues),
    related_issues: z.array(z.number().positive()).optional().default([]),
  }),
  z.object({
    intent: z.literal(INTENTS.createChangeRequestComment),
    content: z.string().min(1),
    change_id: z.string().min(1).optional(),
  }),
  z.object({
    intent: z.literal(INTENTS.updateChangeRequestComment),
    comment_id: z.string().min(1),
    content: z.string().min(1),
  }),
  z.object({
    intent: z.literal(INTENTS.deleteChangeRequestComment),
    comment_id: z.string().min(1),
  }),
  z.object({
    intent: z.literal(INTENTS.updateReview),
    review_id: z.string().min(1),
    text: z.string().min(1).optional(),
  }),
  z.object({
    intent: z.literal(INTENTS.executeChangeRequest),
  }),
  z.object({
    intent: z.literal(INTENTS.createUndoChangeRequest),
  }),
]);

export async function loader({ request, params }: LoaderFunctionArgs) {
  const flags = await getFlags(request);
  assertResponse(flags.changeRequests, "Not Found", { status: 404 });
  assertResponseParams(params, [
    "org_slug",
    "database_slug",
    "change_request_number",
  ]);

  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );

  const [
    {
      payload: { labels },
    },
    {
      payload: { issues },
    },
  ] = await Promise.all([
    dataFnMiddleware(
      request,
      client.v2.listDatabaseLabels({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_database_labels")),
    dataFnMiddleware(
      request,
      client.v2.listIssues({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_issues")),
  ]);

  return {
    labels,
    issues,
  };
}

export async function action({ request, params }: ActionFunctionArgs) {
  assertResponseParams(params, [
    "org_slug",
    "database_slug",
    "change_request_number",
  ]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );
  const formData = await request.formData();
  await validateCsrf(formData, request.headers);

  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    return submission.reply();
  }

  switch (submission.value.intent) {
    case INTENTS.createChangeRequestComment: {
      const response = await dataFnMiddleware(
        request,
        client.v2.createChangeRequestComment({
          body: submission.value,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "create_change_request_comment") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Comment created successfully",
        }),
      });
    }
    case INTENTS.updateChangeRequestComment: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateChangeRequestComment({
          body: submission.value,
          headers,
          params: {
            ...params,
            comment_id: submission.value.comment_id,
          },
        }),
      );

      const message = await response.json();

      if (message.type !== "update_change_request_comment") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Comment updated successfully",
        }),
      });
    }
    case INTENTS.deleteChangeRequestComment: {
      const response = await dataFnMiddleware(
        request,
        client.v2.deleteChangeRequestComment({
          headers,
          params: {
            ...params,
            comment_id: submission.value.comment_id,
          },
        }),
      );

      const message = await response.json();

      if (message.type !== "success") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Comment deleted successfully",
        }),
      });
    }
    case INTENTS.updateChangeRequestLabels:
    case INTENTS.updateChangeRequestRelatedIssues:
    case INTENTS.updateChangeRequestReviewers:
    case INTENTS.updateChangeRequest: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateChangeRequest({
          body: submission.value,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "update_change_request") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Change Request updated successfully",
        }),
      });
    }
    case INTENTS.updateReview: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateReview({
          body: submission.value,
          headers,
          params: {
            ...params,
            review_id: submission.value.review_id,
          },
        }),
      );

      const message = await response.json();

      if (message.type !== "update_review") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Review updated successfully",
        }),
      });
    }
    case INTENTS.executeChangeRequest: {
      const response = await dataFnMiddleware(
        request,
        client.v2.executeChangeRequest({
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "success") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message:
            "Change Request execution started successfully. Please refresh the page soon to see the updated status.",
        }),
      });
    }
    case INTENTS.createUndoChangeRequest: {
      const response = await dataFnMiddleware(
        request,
        client.v2.createUndoChangeRequest({
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "create_undo_change_request") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirect(
        `/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${message.payload.change_request.change_request_number}`,
        {
          headers: await setFlashHeaders({
            type: "success",
            message: "Change Request created successfully",
          }),
        },
      );
    }
  }
}

function LabelTag({ label }: { label: V2.Label }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-sm border border-gray-200 px-2 py-1 text-sm"
      style={{
        backgroundColor: label.color,
        color: getTextColor(label.color),
      }}
    >
      {label.name}
    </span>
  );
}

function ChangeRequestDescriptionTimelineListItemForm({
  onCancel,
  onFinish,
  defaultValue,
}: {
  onCancel: () => void;
  onFinish: () => void;
  defaultValue: DefaultValue<z.input<typeof schema>>;
}) {
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm<
    z.input<typeof schema>,
    z.output<typeof schema>
  >({
    constraint: getZodConstraint(schema),
    defaultValue,
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data &&
      fetcher.data.status !== "error"
    ) {
      onFinish();
    }
  }, [fetcher.data, fetcher.state, onFinish]);

  return (
    <fetcher.Form
      {...getFormProps(form)}
      method="POST"
      className="flex grow flex-col gap-4"
    >
      <AuthenticityTokenInput />
      <ControlMarkdownFieldTextarea
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        autoComplete="off"
        field={fields.description}
        aria-label="Description"
        rows={19}
      />
      <div className="flex flex-row-reverse items-center gap-2">
        <Button
          type="submit"
          space="xs"
          name={fields.intent.name}
          value={INTENTS.updateChangeRequest}
          iconRight={
            fetcher.state !== "idle" ? (
              <Spinner
                aria-label="Loading..."
                className="size-3.5 animate-spin"
                role="status"
              />
            ) : undefined
          }
        >
          Update Description
        </Button>
        <Button type="button" space="xs" intent="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </fetcher.Form>
  );
}

function ChangeRequestDescriptionTimelineListItem() {
  const changeRequestLoaderData = useRouteLoaderData<
    typeof changeRequestLoader
  >(
    "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number",
  )!;
  const [isEditing, setEditing] = useState(false);
  const handleCancel = useCallback(() => setEditing(false), []);
  const handleFinish = useCallback(() => setEditing(false), []);

  return (
    <li className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-50 last:pb-0 last:before:bottom-auto">
      <div className="shrink-0 pt-4 text-gray-700">
        <IconUserCircle className="stroke-1.5 size-6" />
      </div>
      <div className="grow">
        <div className="flex flex-col rounded-lg border border-gray-300 text-sm text-gray-900">
          <header className="before:border-y-9.5 before:border-r-9.5 after:border-y-9.5 relative flex items-center gap-3 rounded-t-lg border-b border-gray-300 bg-gray-50 px-4 py-3 before:absolute before:top-2 before:left-[-9.5px] before:size-0 before:translate-y-1/2 before:border-y-transparent before:border-r-gray-300 after:absolute after:top-2 after:-left-2 after:size-0 after:translate-y-1/2 after:border-r-8 after:border-y-transparent after:border-r-gray-50">
            <p className="grow">
              <strong className="font-semibold">Description</strong>
            </p>
            {changeRequestLoaderData.change_request.permissions
              ?.edit_title_description.value ? (
              <DropDown
                position="center right"
                trigger={
                  <DropDownTrigger aria-label="Change Request Actions">
                    <IconDotsVertical className="stroke-1.5 size-4" />
                  </DropDownTrigger>
                }
              >
                <DropDownItem>
                  <button onClick={() => setEditing(true)}>
                    Edit Description
                  </button>
                </DropDownItem>
              </DropDown>
            ) : undefined}
          </header>
          <div className="flex items-center gap-4 rounded-b-lg bg-white p-4">
            {isEditing ? (
              <ChangeRequestDescriptionTimelineListItemForm
                defaultValue={{
                  description:
                    changeRequestLoaderData.change_request.description,
                }}
                onCancel={handleCancel}
                onFinish={handleFinish}
              />
            ) : (
              <div className="prose prose-sm max-w-none">
                <Markdown>
                  {changeRequestLoaderData.change_request.description}
                </Markdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function ChangeRequestTimelineListItem({
  processedTimelineItem,
  changeRequest,
}: {
  processedTimelineItem: ProcessedChangeRequestTimelineItem;
  changeRequest: V2.ChangeRequest;
}) {
  const id = `timeline-item-${processedTimelineItem.id}`;
  const params = useParams();
  const { user } = processedTimelineItem;

  switch (processedTimelineItem.action_type) {
    case "CREATE_CHANGE_REQUEST":
      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-50 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4 text-gray-700">
            <IconGitPullRequest className="stroke-1.5 size-6" />
          </div>
          <div className="grow">
            <header className="flex items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900">
              <Avatar title={user.username} src={user.picture ?? undefined} />
              <p>
                <strong className="font-semibold">{user.username}</strong>{" "}
                created a change request{" "}
                <LinkAnchor to={`#${id}`}>
                  <RelativeTime dateTime={processedTimelineItem.created_at} />
                </LinkAnchor>
              </p>
            </header>
          </div>
        </li>
      );
    case "REOPEN_CHANGE_REQUEST":
      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-50 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4 text-gray-700">
            <IconMaximize className="stroke-1.5 size-6" />{" "}
          </div>
          <div className="grow">
            <header className="flex items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900">
              <Avatar title={user.username} src={user.picture ?? undefined} />
              <p>
                <strong className="font-semibold">{user.username}</strong>{" "}
                reopened the change request{" "}
                <LinkAnchor to={`#${id}`}>
                  <RelativeTime dateTime={processedTimelineItem.created_at} />
                </LinkAnchor>
              </p>
            </header>
          </div>
        </li>
      );
    case "CLOSE_CHANGE_REQUEST":
      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-50 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4 text-gray-700">
            <IconMinimize className="stroke-1.5 size-6" />{" "}
          </div>
          <div className="grow">
            <header className="flex items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900">
              <Avatar title={user.username} src={user.picture ?? undefined} />
              <p>
                <strong className="font-semibold">{user.username}</strong>{" "}
                closed the change request{" "}
                <LinkAnchor to={`#${id}`}>
                  <RelativeTime dateTime={processedTimelineItem.created_at} />
                </LinkAnchor>
              </p>
            </header>
          </div>
        </li>
      );
    case "START_EXECUTE":
      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-50 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4 text-gray-700">
            <IconRefresh className="stroke-1.5 size-6" />
          </div>
          <div className="grow">
            <header className="flex items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900">
              <Avatar title={user.username} src={user.picture ?? undefined} />

              <p>
                <strong className="font-semibold">{user.username}</strong>{" "}
                started executing this change request{" "}
                <LinkAnchor to={`#${id}`}>
                  <RelativeTime dateTime={processedTimelineItem.created_at} />
                </LinkAnchor>
              </p>
            </header>
          </div>
        </li>
      );
    case "COMPLETE_EXECUTE":
      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-50 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4">
            <IconTable className="stroke-1.5 size-6 stroke-purple-600" />
          </div>
          <div className="grow">
            <header className="flex items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900">
              <Avatar title={user.username} src={user.picture ?? undefined} />
              <p className="grow">
                <strong className="font-semibold">{user.username}</strong>{" "}
                Change request execution completed successfully{" "}
                <LinkAnchor to={`#${id}`}>
                  <RelativeTime dateTime={processedTimelineItem.created_at} />
                </LinkAnchor>
              </p>
              <Link
                className="font-medium text-blue-500 hover:underline"
                to={`/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/data-changes`}
              >
                View Changes
              </Link>
              {changeRequest.status === "applied" ? (
                <ChangeRequestUndoForm />
              ) : undefined}
            </header>
          </div>
        </li>
      );
    case "FAIL_EXECUTE": {
      const { sql } = processedTimelineItem.action_details;
      const replaced = sql
        .replace(/VALUES|WHERE|SET/gim, "\n  $&")
        .replace(";", ";\n");
      const sqlMd = `\`\`\`sql\n${replaced}`;

      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-50 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4">
            <IconX className="stroke-1.5 size-5 stroke-red-600" />
          </div>
          <div className="grow">
            <div className="flex flex-col rounded-lg border border-gray-300 text-sm text-gray-900">
              <header className="relative flex items-center gap-3 rounded-t-lg border-b border-gray-300 bg-gray-50 px-4 py-3">
                <Avatar title={user.username} src={user.picture ?? undefined} />
                <p>
                  <strong className="font-semibold">{user.username}</strong>{" "}
                  Change request execution was unsuccessful{" "}
                  <LinkAnchor to={`#${id}`}>
                    <RelativeTime dateTime={processedTimelineItem.created_at} />
                  </LinkAnchor>
                </p>
              </header>
              <div className="p-4">
                <label htmlFor="reason">Reason:</label>
                <p
                  id="reason"
                  className="block p-4 pb-6 first-letter:uppercase"
                >
                  <pre>
                    <code>{processedTimelineItem.action_details.reason}</code>
                  </pre>
                </p>
                <label htmlFor="sql">SQL statement:</label>
                <div id="sql" className="prose block max-w-none p-4 text-sm">
                  <Markdown>{sqlMd}</Markdown>
                </div>
              </div>
            </div>
          </div>
        </li>
      );
    }
    case "UPDATE_TITLE":
      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-50 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4 text-gray-700">
            <IconEdit className="stroke-1.5 size-6" />
          </div>
          <div className="grow">
            <header className="flex items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900">
              <Avatar title={user.username} src={user.picture ?? undefined} />
              <p>
                <strong className="font-semibold">{user.username}</strong>{" "}
                updated title{" "}
                <LinkAnchor to={`#${id}`}>
                  <RelativeTime dateTime={processedTimelineItem.created_at} />
                </LinkAnchor>
              </p>
            </header>
          </div>
        </li>
      );
    case "UPDATE_DESCRIPTION":
      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-50 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4 text-gray-700">
            <IconEdit className="stroke-1.5 size-6" />
          </div>
          <div className="grow">
            <header className="flex items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900">
              <Avatar title={user.username} src={user.picture ?? undefined} />
              <p>
                <strong className="font-semibold">{user.username}</strong>{" "}
                updated description{" "}
                <LinkAnchor to={`#${id}`}>
                  <RelativeTime dateTime={processedTimelineItem.created_at} />
                </LinkAnchor>
              </p>
            </header>
          </div>
        </li>
      );
    case "UPDATE_LABELS": {
      const { added, removed } = processedTimelineItem.action_details;

      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-50 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4 text-gray-700">
            <IconLabel className="stroke-1.5 size-6" />
          </div>
          <div className="grow">
            <header className="flex items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900">
              <Avatar title={user.username} src={user.picture ?? undefined} />
              <div>
                <strong className="font-semibold">{user.username}</strong>{" "}
                {added.length ? (
                  <>
                    added{" "}
                    <ol className="inline-flex flex-wrap gap-2">
                      {added.map((label) => (
                        <li key={label.id}>
                          <LabelTag label={label} />
                        </li>
                      ))}
                    </ol>
                  </>
                ) : undefined}
                {added.length && removed.length ? " and " : undefined}
                {removed.length ? (
                  <>
                    removed{" "}
                    <ol className="inline-flex flex-wrap gap-2">
                      {removed.map((label) => (
                        <li key={label.id}>
                          <LabelTag label={label} />
                        </li>
                      ))}
                    </ol>
                  </>
                ) : undefined}{" "}
                {pluralize(added.length + removed.length, "label", "labels")}{" "}
                <LinkAnchor to={`#${id}`}>
                  <RelativeTime dateTime={processedTimelineItem.created_at} />
                </LinkAnchor>
              </div>
            </header>
          </div>
        </li>
      );
    }
    case "UPDATE_REVIEWERS": {
      const { added, removed } = processedTimelineItem.action_details;

      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-50 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4 text-gray-700">
            <IconUsersPlus />
          </div>
          <div className="grow">
            <header className="flex items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900">
              <Avatar title={user.username} src={user.picture ?? undefined} />
              <p>
                <strong className="font-semibold">{user.username}</strong>{" "}
                {added.length ? (
                  <>
                    added{" "}
                    {added.map((member) => (
                      <Avatar
                        key={member.user.id}
                        title={member.user.username}
                        src={member.user.picture ?? undefined}
                      />
                    ))}{" "}
                  </>
                ) : undefined}
                {added.length && removed.length ? " and " : undefined}
                {removed.length ? (
                  <>
                    removed{" "}
                    {removed.map((member) => (
                      <Avatar
                        key={member.user.id}
                        title={member.user.username}
                        src={member.user.picture ?? undefined}
                      />
                    ))}{" "}
                  </>
                ) : undefined}{" "}
                {pluralize(
                  added.length + removed.length,
                  "as a reviewer",
                  "as reviewers",
                )}{" "}
                <LinkAnchor to={`#${id}`}>
                  <RelativeTime dateTime={processedTimelineItem.created_at} />
                </LinkAnchor>
              </p>
            </header>
          </div>
        </li>
      );
    }
    case "UPDATE_COMMENT":
    case "ADD_COMMENT":
      return (
        <ChangeRequestTimelineListItemComment
          processedTimelineItem={processedTimelineItem}
        />
      );
    case "UPDATE_REVIEW":
    case "ADD_REVIEW":
      return (
        <ChangeRequestTimelineListItemReview
          processedTimelineItem={processedTimelineItem}
        />
      );
    default:
      return null;
  }
}

function ChangeRequestTimelineDeleteCommentForm({
  defaultValue,
  onFinish,
}: {
  defaultValue: DefaultValue<z.input<typeof schema>>;
  onFinish: () => void;
}) {
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm<
    z.input<typeof schema>,
    z.output<typeof schema>
  >({
    constraint: getZodConstraint(schema),
    defaultValue,
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data &&
      fetcher.data.status !== "error"
    ) {
      onFinish();
    }
  }, [fetcher.data, fetcher.state, onFinish]);

  return (
    <fetcher.Form {...getFormProps(form)} method="POST">
      <AuthenticityTokenInput />
      <input
        {...getInputProps(fields.comment_id, {
          type: "hidden",
        })}
      />
      <Button
        type="submit"
        space="xs"
        intent="destructive"
        name={fields.intent.name}
        value={INTENTS.deleteChangeRequestComment}
        onClick={(event) => {
          event.stopPropagation();
          if (
            !confirm(
              "Are you sure you want to delete this comment? This action cannot be undone.",
            )
          ) {
            event.preventDefault();
          }
        }}
        iconRight={
          fetcher.state !== "idle" ? (
            <Spinner
              aria-label="Loading..."
              className="size-3.5 animate-spin"
              role="status"
            />
          ) : undefined
        }
      >
        Delete Comment
      </Button>
    </fetcher.Form>
  );
}

function ChangeRequestTimelineListItemCommentForm({
  onCancel,
  onFinish,
  defaultValue,
}: {
  onCancel: () => void;
  onFinish: () => void;
  defaultValue: DefaultValue<z.input<typeof schema>>;
}) {
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm<
    z.input<typeof schema>,
    z.output<typeof schema>
  >({
    constraint: getZodConstraint(schema),
    defaultValue,
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data &&
      fetcher.data.status !== "error"
    ) {
      onFinish();
    }
  }, [fetcher.data, fetcher.state, onFinish]);

  return (
    <fetcher.Form
      {...getFormProps(form)}
      className="flex grow flex-col gap-4"
      method="POST"
    >
      <AuthenticityTokenInput />
      <input
        {...getInputProps(fields.comment_id, {
          type: "hidden",
        })}
      />
      <ControlMarkdownFieldTextarea
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        autoComplete="off"
        aria-label="Comment"
        field={fields.content}
      />
      <div className="flex flex-row-reverse items-center gap-2">
        <Button
          type="submit"
          space="xs"
          name={fields.intent.name}
          value={INTENTS.updateChangeRequestComment}
          iconRight={
            fetcher.state !== "idle" ? (
              <Spinner
                aria-label="Loading..."
                className="size-3.5 animate-spin"
                role="status"
              />
            ) : undefined
          }
        >
          Save
        </Button>
        <Button type="button" intent="secondary" space="xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </fetcher.Form>
  );
}

function ChangeRequestTimelineListItemComment({
  processedTimelineItem,
}: {
  processedTimelineItem: Extract<
    ProcessedChangeRequestTimelineItem,
    {
      action_type: "ADD_COMMENT" | "UPDATE_COMMENT";
    }
  >;
}) {
  const id = `timeline-item-${processedTimelineItem.id}`;
  const changeRequestLoaderData = useRouteLoaderData<
    typeof changeRequestLoader
  >(
    "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number",
  )!;
  const change = changeRequestLoaderData.change_request.changes.find(
    (change) => change.id === processedTimelineItem.action_details.change_id,
  );
  const { user } = processedTimelineItem;
  const [isEditing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const handleCancelEditing = useCallback(() => setEditing(false), []);
  const handleFinishEditing = useCallback(() => setEditing(false), []);
  const handleFinishDeleting = useCallback(() => setExpanded(false), []);
  const preventDefault = useCallback<React.ReactEventHandler<HTMLElement>>(
    (event) => event.preventDefault(),
    [],
  );

  return (
    <li
      id={id}
      className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-50 last:pb-0 last:before:bottom-auto"
    >
      <div className="shrink-0 pt-4 text-gray-700">
        <IconUserCircle className="stroke-1.5 size-6" />
      </div>
      <div className="flex w-0 grow flex-col rounded-lg border border-gray-300 text-sm text-gray-900">
        <header className="before:border-y-9.5 before:border-r-9.5 after:border-y-9.5 relative flex items-center gap-3 rounded-t-lg border-b border-gray-300 bg-gray-50 px-4 py-3 before:absolute before:top-2 before:left-[-9.5px] before:size-0 before:translate-y-1/2 before:border-y-transparent before:border-r-gray-300 after:absolute after:top-2 after:-left-2 after:size-0 after:translate-y-1/2 after:border-r-8 after:border-y-transparent after:border-r-gray-50">
          <Avatar title={user.username} src={user.picture ?? undefined} />
          <p className="grow">
            <strong className="font-semibold">{user.username}</strong> commented{" "}
            {processedTimelineItem.action_details.change_id && !change ? (
              <>
                on a <em className="text-red-300">deleted</em> change{" "}
              </>
            ) : undefined}
            <LinkAnchor to={`#${id}`}>
              <RelativeTime dateTime={processedTimelineItem.created_at} />
            </LinkAnchor>
          </p>
          {processedTimelineItem.permissions?.update_comment.value ||
          processedTimelineItem.permissions?.delete_comment.value ? (
            <DropDown
              expanded={expanded}
              setExpanded={setExpanded}
              position="center right"
              trigger={
                <DropDownTrigger aria-label="Comment Actions">
                  <IconDotsVertical className="stroke-1.5 size-4" />
                </DropDownTrigger>
              }
            >
              {processedTimelineItem.permissions?.update_comment.value ? (
                <DropDownItem>
                  <button onClick={() => setEditing(true)}>Edit Comment</button>
                </DropDownItem>
              ) : undefined}
              {processedTimelineItem.permissions?.delete_comment.value ? (
                <DropDownItem
                  onMouseDown={preventDefault}
                  onClick={preventDefault}
                >
                  <ChangeRequestTimelineDeleteCommentForm
                    defaultValue={{
                      comment_id:
                        processedTimelineItem.action_details.comment_id,
                    }}
                    onFinish={handleFinishDeleting}
                  />
                </DropDownItem>
              ) : undefined}
            </DropDown>
          ) : undefined}
        </header>
        {change ? (
          <div>
            <ChangeTable change={change} borderless />
          </div>
        ) : undefined}
        <div className="flex items-center gap-4 rounded-b-lg bg-white p-4">
          {isEditing ? (
            <ChangeRequestTimelineListItemCommentForm
              defaultValue={{
                content: processedTimelineItem.action_details.content,
                comment_id: processedTimelineItem.action_details.comment_id,
              }}
              onCancel={handleCancelEditing}
              onFinish={handleFinishEditing}
            />
          ) : (
            <div className="prose max-w-none text-sm">
              <Markdown>
                {processedTimelineItem.action_details.content}
              </Markdown>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function ChangeRequestTimelineListItemReviewForm({
  onCancel,
  onFinish,
  defaultValue,
}: {
  onCancel: () => void;
  onFinish: () => void;
  defaultValue: DefaultValue<z.input<typeof schema>>;
}) {
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm<
    z.input<typeof schema>,
    z.output<typeof schema>
  >({
    constraint: getZodConstraint(schema),
    defaultValue,
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data &&
      fetcher.data.status !== "error"
    ) {
      onFinish();
    }
  }, [fetcher.data, fetcher.state, onFinish]);

  return (
    <fetcher.Form
      {...getFormProps(form)}
      className="flex grow flex-col gap-4"
      method="POST"
    >
      <AuthenticityTokenInput />
      <input
        {...getInputProps(fields.review_id, {
          type: "hidden",
        })}
      />
      <ControlMarkdownFieldTextarea
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        autoComplete="off"
        aria-label="Text"
        field={fields.text}
      />
      <div className="flex flex-row-reverse items-center gap-2">
        <Button
          type="submit"
          space="xs"
          name={fields.intent.name}
          value={INTENTS.updateReview}
          iconRight={
            fetcher.state !== "idle" ? (
              <Spinner
                aria-label="Loading..."
                className="size-3.5 animate-spin"
                role="status"
              />
            ) : undefined
          }
        >
          Save
        </Button>
        <Button type="button" intent="secondary" space="xs" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </fetcher.Form>
  );
}

function ChangeRequestTimelineListItemReview({
  processedTimelineItem,
}: {
  processedTimelineItem: Extract<
    ProcessedChangeRequestTimelineItem,
    {
      action_type: "ADD_REVIEW" | "UPDATE_REVIEW";
    }
  >;
}) {
  const id = `timeline-item-${processedTimelineItem.id}`;
  const { user } = processedTimelineItem;
  const [isEditing, setEditing] = useState(false);
  const handleCancel = useCallback(() => setEditing(false), []);
  const handleFinish = useCallback(() => setEditing(false), []);

  return (
    <li
      id={id}
      className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-50 last:pb-0 last:before:bottom-auto"
    >
      <div className="shrink-0 pt-4 text-gray-700">
        {processedTimelineItem.action_details.event_type === "APPROVE" ? (
          <IconCheck className="stroke-1.5 size-6 stroke-green-600" />
        ) : (
          <IconUserCircle className="stroke-1.5 size-6" />
        )}
      </div>
      <div className="grow">
        <div className="flex flex-col rounded-lg border border-gray-300 text-sm text-gray-900">
          <header className="before:border-y-9.5 before:border-r-9.5 after:border-y-9.5 relative flex items-center gap-3 rounded-t-lg border-b border-gray-300 bg-gray-50 px-4 py-3 before:absolute before:top-2 before:left-[-9.5px] before:size-0 before:translate-y-1/2 before:border-y-transparent before:border-r-gray-300 after:absolute after:top-2 after:-left-2 after:size-0 after:translate-y-1/2 after:border-r-8 after:border-y-transparent after:border-r-gray-50">
            <Avatar title={user.username} src={user.picture ?? undefined} />
            <p className="grow">
              <strong className="font-semibold">{user.username}</strong> left a
              review
              {processedTimelineItem.action_details.event_type === "COMMENT"
                ? " comment "
                : " "}
              <LinkAnchor to={`#${id}`}>
                <RelativeTime dateTime={processedTimelineItem.created_at} />
              </LinkAnchor>{" "}
              {processedTimelineItem.action_details.event_type === "APPROVE" ? (
                <Tag intent="positive">Approved</Tag>
              ) : undefined}
            </p>
            {processedTimelineItem.permissions?.update_review.value ? (
              <DropDown
                position="center right"
                trigger={
                  <DropDownTrigger aria-label="Review Actions">
                    <IconDotsVertical className="stroke-1.5 size-4" />
                  </DropDownTrigger>
                }
              >
                <DropDownItem>
                  <button onClick={() => setEditing(true)}>Edit Review</button>
                </DropDownItem>
              </DropDown>
            ) : undefined}
          </header>
          <div className="flex items-center gap-4 rounded-b-lg bg-white p-4">
            {isEditing ? (
              <ChangeRequestTimelineListItemReviewForm
                onCancel={handleCancel}
                onFinish={handleFinish}
                defaultValue={{
                  review_id: processedTimelineItem.action_details.review_id,
                  text: processedTimelineItem.action_details.text,
                }}
              />
            ) : (
              <div className="prose prose-sm">
                <Markdown>{processedTimelineItem.action_details.text}</Markdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function ChangeRequestStatusForm({
  defaultValue,
}: {
  defaultValue: DefaultValue<z.input<typeof schema>>;
}) {
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm<
    z.input<typeof schema>,
    z.output<typeof schema>
  >({
    constraint: getZodConstraint(schema),
    defaultValue,
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  return (
    <fetcher.Form {...getFormProps(form)} method="POST">
      <AuthenticityTokenInput />
      <input
        {...getInputProps(fields.status, {
          type: "hidden",
        })}
      />
      <Button
        type="submit"
        iconLeft={
          fields.status.value === "open" ? (
            <IconMaximize className="size-4 stroke-green-600" />
          ) : (
            <IconMinimize className="size-4 stroke-red-600" />
          )
        }
        iconRight={
          fetcher.state !== "idle" ? (
            <Spinner
              aria-label="Loading..."
              className="size-4 animate-spin"
              role="status"
            />
          ) : undefined
        }
        intent="secondary"
        name={fields.intent.name}
        space="sm"
        value={INTENTS.updateChangeRequest}
        onClick={(event) => {
          if (
            !window.confirm(
              `Are you sure you want to ${
                fields.status.value === "open" ? "reopen" : "close"
              } this change request?`,
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        {fields.status.value === "open" ? "Reopen" : "Close"}
      </Button>
    </fetcher.Form>
  );
}

function ChangeRequestExecuteForm() {
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  return (
    <fetcher.Form {...getFormProps(form)} className="pl-8" method="POST">
      <AuthenticityTokenInput />
      <div className="rounded-lg border border-gray-300 p-4 pl-3">
        <div className="flex gap-2 pb-3">
          <IconCheck className="stroke-1.5 size-6 stroke-green-600" />
          <p>
            This change request has been <Tag intent="positive">Approved</Tag>{" "}
            by the reviewers. Click the Execute button below to apply the
            changes.
          </p>
        </div>
        <hr className="border-gray-300" />
        <div className="pt-4">
          <Button
            type="submit"
            name={fields.intent.name}
            space="sm"
            value={INTENTS.executeChangeRequest}
            iconRight={
              fetcher.state !== "idle" ? (
                <Spinner
                  aria-label="Loading..."
                  className="size-4 animate-spin"
                  role="status"
                />
              ) : undefined
            }
            onClick={(event) => {
              if (
                !window.confirm(
                  "Are you sure you want to apply this change request?",
                )
              ) {
                event.preventDefault();
              }
            }}
          >
            Execute
          </Button>
        </div>
      </div>
    </fetcher.Form>
  );
}

function ChangeRequestUndoForm() {
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  return (
    <fetcher.Form {...getFormProps(form)} className="pl-8" method="POST">
      <AuthenticityTokenInput />
      <Button
        type="submit"
        name={fields.intent.name}
        space="xs"
        intent="secondary"
        value={INTENTS.createUndoChangeRequest}
        iconRight={
          fetcher.state !== "idle" ? (
            <Spinner
              aria-label="Loading..."
              className="size-3.5 animate-spin"
              role="status"
            />
          ) : undefined
        }
      >
        Undo
      </Button>
    </fetcher.Form>
  );
}

function ChangeRequestCommentForm() {
  const changeRequestLoaderData = useRouteLoaderData<
    typeof changeRequestLoader
  >(
    "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number",
  )!;

  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  return (
    <div className="grow">
      {changeRequestLoaderData.change_request.permissions?.create_comment
        .value ? (
        <fetcher.Form
          {...getFormProps(form)}
          className="flex flex-col gap-4"
          method="POST"
        >
          <AuthenticityTokenInput />
          <ControlMarkdownFieldTextarea
            autoComplete="off"
            label="Comment"
            field={fields.content}
          />
        </fetcher.Form>
      ) : undefined}
      <div className="pt-4">
        <div className="flex flex-row-reverse items-center gap-2">
          {changeRequestLoaderData.change_request.permissions?.create_comment
            .value ? (
            <Button
              type="submit"
              form={form.id}
              intent="constructive"
              name={fields.intent.name}
              space="sm"
              value={INTENTS.createChangeRequestComment}
              iconRight={
                fetcher.state !== "idle" ? (
                  <Spinner
                    aria-label="Loading..."
                    className="size-4 animate-spin"
                    role="status"
                  />
                ) : undefined
              }
            >
              Add Comment
            </Button>
          ) : undefined}
          {!changeRequestLoaderData.change_request.permissions
            ?.open_close_change_request.value ||
          /executing|applied/.test(
            changeRequestLoaderData.change_request.status,
          ) ? undefined : (
            <ChangeRequestStatusForm
              defaultValue={{
                status:
                  changeRequestLoaderData.change_request.status === "closed"
                    ? "open"
                    : "closed",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ChangeRequestLabelsForm({
  onFinish,
  onCancel,
  defaultValue,
}: {
  onFinish: () => void;
  onCancel: () => void;
  defaultValue: DefaultValue<z.input<typeof schema>>;
}) {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm<
    z.input<typeof schema>,
    z.output<typeof schema>
  >({
    constraint: getZodConstraint(schema),
    defaultValue,
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data &&
      fetcher.data.status !== "error"
    ) {
      onFinish();
    }
  }, [fetcher.data, fetcher.state, onFinish]);

  const bodyLabelsProps = getCollectionProps(fields.labels, {
    type: "checkbox",
    options: loaderData.labels.map((label) => label.id),
  });

  return (
    <fetcher.Form {...getFormProps(form)} method="POST" className="contents">
      <AuthenticityTokenInput />
      <FormDrawerHeader>
        <h3 className="text-lg font-semibold">Edit Labels</h3>
      </FormDrawerHeader>
      <FormDrawerSection>
        <div className="flex flex-col gap-4">
          {loaderData.labels.map((label, index) => {
            const props =
              bodyLabelsProps[index] ??
              ({} as (typeof bodyLabelsProps)[number]);
            return (
              <InlineField
                key={label.id}
                label={
                  <InlineFieldLabel htmlFor={props.id}>
                    <LabelTag label={label} />
                  </InlineFieldLabel>
                }
              >
                <InlineFieldInput {...props} />
              </InlineField>
            );
          })}
        </div>
      </FormDrawerSection>
      <FormDrawerFooter>
        <div className="flex items-center gap-2">
          <Button
            space="sm"
            intent="constructive"
            fullWidth
            type="submit"
            name={fields.intent.name}
            value={INTENTS.updateChangeRequestLabels}
            iconRight={
              fetcher.state !== "idle" ? (
                <Spinner
                  aria-label="Loading..."
                  className="size-4 animate-spin"
                  role="status"
                />
              ) : undefined
            }
          >
            Add Labels
          </Button>
          <Button
            space="sm"
            type="button"
            intent="secondary"
            fullWidth
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </FormDrawerFooter>
    </fetcher.Form>
  );
}

function ChangeRequestReviewersForm({
  onFinish,
  onCancel,
}: {
  onFinish: () => void;
  onCancel: () => void;
}) {
  const changeRequestLoaderData = useRouteLoaderData<
    typeof changeRequestLoader
  >(
    "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number",
  )!;

  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    defaultValue: {
      reviewers: changeRequestLoaderData.change_request.reviewers.map(
        (reviewer) => reviewer.user.id,
      ),
    },
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data &&
      fetcher.data.status !== "error"
    ) {
      onFinish();
    }
  }, [fetcher.data, fetcher.state, onFinish]);

  const bodyLabelsProps = getCollectionProps(fields.reviewers, {
    type: "checkbox",
    options: changeRequestLoaderData.members.map((member) => member.user.id),
  });

  return (
    <fetcher.Form {...getFormProps(form)} method="POST" className="contents">
      <AuthenticityTokenInput />
      <FormDrawerHeader>
        <h3 className="text-lg font-semibold">Edit Reviewers</h3>
      </FormDrawerHeader>
      <FormDrawerSection>
        <div className="flex flex-col gap-4">
          {changeRequestLoaderData.members.map((member, index) => {
            const props =
              bodyLabelsProps[index] ??
              ({} as (typeof bodyLabelsProps)[number]);
            return (
              <InlineField
                key={member.user.id}
                label={
                  <InlineFieldLabel htmlFor={props.id}>
                    <Tag
                      intent="neutral"
                      iconLeft={
                        <Avatar
                          title={member.user.username}
                          src={member.user.picture ?? undefined}
                        />
                      }
                    >
                      {member.user.username}
                    </Tag>
                  </InlineFieldLabel>
                }
              >
                <InlineFieldInput {...props} />
              </InlineField>
            );
          })}
        </div>
      </FormDrawerSection>
      <FormDrawerFooter>
        <div className="flex items-center gap-2">
          <Button
            space="sm"
            intent="constructive"
            type="submit"
            name={fields.intent.name}
            value={INTENTS.updateChangeRequestReviewers}
            fullWidth
            iconRight={
              fetcher.state !== "idle" ? (
                <Spinner
                  aria-label="Loading..."
                  className="size-4 animate-spin"
                  role="status"
                />
              ) : undefined
            }
          >
            Add Reviewers
          </Button>
          <Button
            space="sm"
            type="button"
            intent="secondary"
            fullWidth
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </FormDrawerFooter>
    </fetcher.Form>
  );
}

function ChangeRequestRelatedIssuesForm({
  onFinish,
  onCancel,
}: {
  onFinish: () => void;
  onCancel: () => void;
}) {
  const changeRequestLoaderData = useRouteLoaderData<
    typeof changeRequestLoader
  >(
    "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number",
  )!;

  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    defaultValue: {
      related_issues: changeRequestLoaderData.change_request.related_issues.map(
        (issue) => issue.issue_number,
      ),
    },
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data &&
      fetcher.data.status !== "error"
    ) {
      onFinish();
    }
  }, [fetcher.data, fetcher.state, onFinish]);

  const bodyRelationsProps = getCollectionProps(fields.related_issues, {
    type: "checkbox",
    options: loaderData.issues.map((issue) => issue.issue_number.toString()),
  });

  return (
    <fetcher.Form {...getFormProps(form)} method="POST" className="contents">
      <AuthenticityTokenInput />
      <FormDrawerHeader>
        <h3 className="text-lg font-semibold">Edit Related Issues</h3>
      </FormDrawerHeader>

      <FormDrawerSection>
        <div className="flex flex-col gap-4">
          {loaderData.issues.map((issue, index) => {
            const props =
              bodyRelationsProps[index] ??
              ({} as (typeof bodyRelationsProps)[number]);
            return (
              <InlineField
                key={issue.issue_number}
                label={
                  <InlineFieldLabel htmlFor={props.id}>
                    <span className="inline-flex items-center justify-center rounded-sm border border-gray-200 px-2 py-1 text-sm">
                      #{issue.issue_number}: {issue.title}
                    </span>
                  </InlineFieldLabel>
                }
              >
                <InlineFieldInput {...props} />
              </InlineField>
            );
          })}
        </div>
      </FormDrawerSection>
      <FormDrawerFooter>
        <div className="flex items-center gap-2">
          <Button
            space="sm"
            intent="constructive"
            type="submit"
            name={fields.intent.name}
            value={INTENTS.updateChangeRequestRelatedIssues}
            fullWidth
            iconRight={
              fetcher.state !== "idle" ? (
                <Spinner
                  aria-label="Loading..."
                  className="size-4 animate-spin"
                  role="status"
                />
              ) : undefined
            }
          >
            Add Related Issues
          </Button>
          <Button
            space="sm"
            type="button"
            intent="secondary"
            fullWidth
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </FormDrawerFooter>
    </fetcher.Form>
  );
}

export default function Route() {
  const orgLoaderData = useRouteLoaderData<typeof orgLoader>(
    "routes/orgs/$org_slug",
  )!;

  const changeRequestLoaderData = useRouteLoaderData<
    typeof changeRequestLoader
  >(
    "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number",
  )!;
  const params = useParams();
  const processedChangeRequestTimeline = getProcessedChangeRequestTimeline(
    changeRequestLoaderData.change_request_timeline,
  );

  const [formDrawerState, setFormDrawerState] =
    useState<FormDrawerState>("closed");

  const handleClose = useCallback(() => setFormDrawerState("closed"), []);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-8">
      <div className="flex grow flex-col gap-4 md:gap-8">
        <ol className="flex grow flex-col">
          <ChangeRequestDescriptionTimelineListItem />
          {processedChangeRequestTimeline.map((processedTimelineItem) => (
            <ChangeRequestTimelineListItem
              key={processedTimelineItem.id}
              processedTimelineItem={processedTimelineItem}
              changeRequest={changeRequestLoaderData.change_request}
            />
          ))}
        </ol>
        <hr className="border-gray-300" />
        <div className="flex gap-2 pb-2">
          <div className="shrink-0 pt-4 text-gray-700">
            <IconUserCircle className="stroke-1.5 size-6" />
          </div>
          <ChangeRequestCommentForm />
        </div>
        {changeRequestLoaderData.change_request.status === "approved" &&
        orgLoaderData.organization.permissions?.is_owner.value ? (
          <ChangeRequestExecuteForm />
        ) : undefined}
      </div>
      <div className="flex shrink-0 flex-col gap-4 md:w-64 md:gap-8">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h3>Labels</h3>
            {changeRequestLoaderData.change_request.permissions?.edit_labels
              .value ? (
              <button
                className="flex items-center gap-2 text-gray-700"
                onClick={() => setFormDrawerState("editLabelsOpen")}
              >
                <IconEdit className="stroke-1.5 size-5" />
                <span>Edit</span>
              </button>
            ) : undefined}
          </div>
          {changeRequestLoaderData.change_request.labels.length ? (
            <ul className="flex flex-wrap gap-2">
              {changeRequestLoaderData.change_request.labels.map((label) => (
                <li key={label.id}>
                  <LabelTag label={label} />
                </li>
              ))}
            </ul>
          ) : undefined}
        </div>
        <FormDrawer
          onClose={handleClose}
          open={formDrawerState === "editLabelsOpen"}
        >
          <ChangeRequestLabelsForm
            onFinish={handleClose}
            onCancel={handleClose}
            defaultValue={{
              labels: changeRequestLoaderData.change_request.labels.map(
                (label) => label.id,
              ),
            }}
          />
        </FormDrawer>
        <hr className="border-gray-300" />

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h3>Reviewers</h3>
            {changeRequestLoaderData.change_request.permissions?.edit_reviewers
              .value ? (
              <button
                className="flex items-center gap-2 text-gray-700"
                onClick={() => setFormDrawerState("editReviewersOpen")}
              >
                <IconEdit className="stroke-1.5 size-5" />
                <span>Edit</span>
              </button>
            ) : undefined}
          </div>
          {changeRequestLoaderData.change_request.reviewers.length ? (
            <ul className="flex flex-wrap gap-2">
              {changeRequestLoaderData.change_request.reviewers.map(
                (member) => (
                  <li key={member.user.id}>
                    <Tag
                      intent="neutral"
                      iconLeft={
                        <Avatar
                          title={member.user.username}
                          src={member.user.picture ?? undefined}
                        />
                      }
                    >
                      {member.user.username}
                    </Tag>
                  </li>
                ),
              )}
            </ul>
          ) : undefined}
        </div>
        <FormDrawer
          onClose={handleClose}
          open={formDrawerState === "editReviewersOpen"}
        >
          <ChangeRequestReviewersForm
            onFinish={handleClose}
            onCancel={handleClose}
          />
        </FormDrawer>
        <hr className="border-gray-300" />
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h3>Related Issues</h3>
            {changeRequestLoaderData.change_request.permissions?.edit_relations
              .value ? (
              <button
                className="flex items-center gap-2 text-gray-700"
                onClick={() => setFormDrawerState("editRelatedIssuesOpen")}
              >
                <IconEdit className="stroke-1.5 size-5" />
                <span>Edit</span>
              </button>
            ) : undefined}
          </div>
          {changeRequestLoaderData.change_request.related_issues.length ? (
            <ul className="flex flex-wrap gap-2">
              {changeRequestLoaderData.change_request.related_issues.map(
                (issue) => (
                  <li key={issue.issue_id}>
                    <Link
                      to={`/orgs/${params.org_slug}/databases/${params.database_slug}/issues/${issue.issue_number}`}
                      className="inline-flex items-center justify-center rounded-sm border border-gray-200 px-2 py-1 text-sm"
                    >
                      #{issue.issue_number}: {issue.issue_title}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          ) : undefined}
        </div>
        <FormDrawer
          onClose={handleClose}
          open={formDrawerState === "editRelatedIssuesOpen"}
        >
          <ChangeRequestRelatedIssuesForm
            onFinish={handleClose}
            onCancel={handleClose}
          />
        </FormDrawer>
      </div>
    </div>
  );
}
