import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaArgs,
  MetaDescriptor,
  UIMatch,
} from "react-router";
import { data, Link, useFetcher, useLoaderData, useParams } from "react-router";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

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
  IconDotsVertical,
  IconEdit,
  IconLabel,
  IconMaximize,
  IconMessage,
  IconMinimize,
  IconTicket,
  IconTicketOff,
  IconUserCircle,
  IconUsersGroup,
  IconX,
} from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { z } from "zod";
import { LinkAnchor } from "~/components/anchor";
import { Article } from "~/components/article";
import { Avatar } from "~/components/avatar";
import { Button, LinkButton } from "~/components/button";
import { ControlFieldInput } from "~/components/control-field";
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
import { client } from "~/sdk/client.server";
import { getTextColor } from "~/utils/color";
import { validateCsrf } from "~/utils/csrf.server";
import { setFlashHeaders } from "~/utils/flash";
import { errorMessageToReplyOptions } from "~/utils/message";
import { pluralize } from "~/utils/string";

type FormDrawerState =
  | "closed"
  | "editAssigneesOpen"
  | "editLabelsOpen"
  | "editRelatedChangeRequestsOpen";

const INTENTS = {
  createIssueComment: "createIssueComment",
  updateIssueComment: "updateIssueComment",
  deleteIssueComment: "deleteIssueComment",
  updateIssue: "updateIssue",
  updateIssueAssignees: "updateIssueAssignees",
  updateIssueLabels: "updateIssueLabels",
  updateIssueRelations: "updateIssueRelations",
} as const;

type ProcessedIssueTimelineItemUpdateAssignees = Omit<
  V2.IssueTimelineItem,
  "action_type" | "action_details"
> & {
  action_type: "UPDATE_ASSIGNEES";
  action_details: {
    added: V2.Member[];
    removed: V2.Member[];
  };
};

type ProcessedIssueTimelineItemUpdateLabels = Omit<
  V2.IssueTimelineItem,
  "action_type" | "action_details"
> & {
  action_type: "UPDATE_LABELS";
  action_details: {
    added: V2.Label[];
    removed: V2.Label[];
  };
};

type ProcessedIssueTimelineItem =
  | Exclude<
      V2.IssueTimelineItem,
      {
        action_type:
          | "ADD_ASSIGNEE"
          | "REMOVE_ASSIGNEE"
          | "ADD_LABEL"
          | "REMOVE_LABEL";
      }
    >
  | ProcessedIssueTimelineItemUpdateAssignees
  | ProcessedIssueTimelineItemUpdateLabels;

function groupItemsByTimeAndType(timelineData: V2.IssueTimelineItem[]) {
  const groupedEvents: Record<
    number,
    Record<string, V2.IssueTimelineItem[]>
  > = {};

  // Group all events by their exact timestamp
  timelineData.forEach((event) => {
    const timestamp = new Date(event.created_at).getTime();
    const type = event.action_type;

    const groupedEventsByTimestamp = (groupedEvents[timestamp] =
      groupedEvents[timestamp] ?? {});

    const processedIssueTimelineArray = (groupedEventsByTimestamp[type] =
      groupedEventsByTimestamp[type] ?? []);

    processedIssueTimelineArray.push(event);
  });

  return groupedEvents;
}

function getProcessedIssueTimeline(timelineData: V2.IssueTimelineItem[]) {
  const groupedEvents = groupItemsByTimeAndType(timelineData);

  const processedEvents: ProcessedIssueTimelineItem[] = [];

  // For each timestamp
  for (const {
    ADD_LABEL = [],
    REMOVE_LABEL = [],
    ADD_ASSIGNEE = [],
    REMOVE_ASSIGNEE = [],
    ...timestampEvents
  } of Object.values(groupedEvents)) {
    // Process label events
    if (ADD_LABEL.length || REMOVE_LABEL.length) {
      const labelEvents = [...ADD_LABEL, ...REMOVE_LABEL];

      const firstEvent = labelEvents[0];

      if (!firstEvent) {
        continue;
      }

      const action_details = labelEvents.reduce(
        (acc, labelEvent) => {
          switch (labelEvent.action_type) {
            case "ADD_LABEL":
              acc.added.push(labelEvent.action_details.label);
              break;
            case "REMOVE_LABEL":
              acc.removed.push(labelEvent.action_details.label);
              break;
          }
          return acc;
        },
        {
          added: [],
          removed: [],
        } as Record<"added" | "removed", V2.Label[]>,
      );

      processedEvents.push({
        id: firstEvent.id,
        action_type: "UPDATE_LABELS",
        created_at: firstEvent.created_at,
        user: firstEvent.user,
        issue_id: firstEvent.issue_id,
        action_details,
      });
    }

    // Process assignee events
    if (ADD_ASSIGNEE.length || REMOVE_ASSIGNEE.length) {
      const assigneeEvents = [...ADD_ASSIGNEE, ...REMOVE_ASSIGNEE];

      const firstEvent = assigneeEvents[0];

      if (!firstEvent) {
        continue;
      }

      processedEvents.push({
        id: firstEvent.id,
        action_type: "UPDATE_ASSIGNEES",
        created_at: firstEvent.created_at,
        user: firstEvent.user,
        issue_id: firstEvent.issue_id,
        action_details: assigneeEvents.reduce(
          (acc, assigneeEvent) => {
            switch (assigneeEvent.action_type) {
              case "ADD_ASSIGNEE":
                acc.added.push(assigneeEvent.action_details.assignee);
                break;
              case "REMOVE_ASSIGNEE":
                acc.removed.push(assigneeEvent.action_details.assignee);
                break;
            }
            return acc;
          },
          {
            added: [],
            removed: [],
          } as Record<"added" | "removed", V2.Member[]>,
        ),
      });
    }

    // Process the rest of the events
    processedEvents.push(
      ...(Object.values(
        timestampEvents,
      ).flat() as ProcessedIssueTimelineItem[]),
    );
  }

  return processedEvents;
}

const schema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal(INTENTS.updateIssue),
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    status: z.enum(["open", "closed"]).optional(),
  }),
  z.object({
    intent: z.literal(INTENTS.createIssueComment),
    content: z.string().min(1),
  }),
  z.object({
    intent: z.literal(INTENTS.updateIssueComment),
    comment_id: z.string(),
    content: z.string().min(1),
  }),
  z.object({
    intent: z.literal(INTENTS.deleteIssueComment),
    comment_id: z.string(),
  }),
  z.object({
    intent: z.literal(INTENTS.updateIssueLabels),
    labels: z.array(z.string().min(1)).default([]),
  }),
  z.object({
    intent: z.literal(INTENTS.updateIssueAssignees),
    assignees: z.array(z.string().min(1)).default([]),
  }),
  z.object({
    intent: z.literal(INTENTS.updateIssueRelations),
    related_change_requests: z.array(z.number().min(1)).default([]),
  }),
]);

export function meta({ data }: MetaArgs<typeof loader>) {
  return [
    {
      title: data?.issue.title,
    },
  ] satisfies MetaDescriptor[];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug", "issue_number"]);

  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );

  const [
    {
      payload: { issue },
    },
    {
      payload: { labels },
    },
    {
      payload: { members },
    },
    {
      payload: { issue_timeline },
    },
    {
      payload: { change_requests },
    },
  ] = await Promise.all([
    dataFnMiddleware(
      request,
      client.v2.getIssue({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("get_issue")),
    dataFnMiddleware(
      request,
      client.v2.listDatabaseLabels({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_database_labels")),
    dataFnMiddleware(
      request,
      client.v2.listOrganizationMembers({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_organization_members")),
    dataFnMiddleware(
      request,
      client.v2.listIssueTimeline({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_issue_timeline")),
    dataFnMiddleware(
      request,
      client.v2.listChangeRequests({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_change_requests")),
  ]);

  return {
    change_requests,
    issue,
    labels,
    members,
    processed_issue_timeline: getProcessedIssueTimeline(issue_timeline),
  };
}

export const handle = {
  breadcrumb(match: UIMatch<Awaited<ReturnType<typeof loader>>>) {
    const num = match.data?.issue?.issue_number;
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        {num ? `#${num}` : "Issue"}
      </BreadcrumbNavLink>
    );
  },
};

export async function action({ request, params }: ActionFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug", "issue_number"]);
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
    case INTENTS.createIssueComment: {
      const response = await dataFnMiddleware(
        request,
        client.v2.createIssueComment({
          body: submission.value,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "create_issue_comment") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Comment created successfully",
        }),
      });
    }
    case INTENTS.updateIssueComment: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateIssueComment({
          body: submission.value,
          headers,
          params: {
            ...params,
            comment_id: submission.value.comment_id,
          },
        }),
      );

      const message = await response.json();

      if (message.type !== "update_issue_comment") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Comment updated successfully",
        }),
      });
    }
    case INTENTS.deleteIssueComment: {
      const response = await dataFnMiddleware(
        request,
        client.v2.deleteIssueComment({
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
    case INTENTS.updateIssueAssignees: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateIssue({
          body: submission.value,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "update_issue") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Assignees updated successfully",
        }),
      });
    }
    case INTENTS.updateIssueLabels: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateIssue({
          body: submission.value,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "update_issue") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Labels updated successfully",
        }),
      });
    }
    case INTENTS.updateIssueRelations: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateIssue({
          body: submission.value,
          headers,
          params,
        }),
      );

      const message = await response.json();
      if (message.type !== "update_issue") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Related change requests updated successfully",
        }),
      });
    }
    case INTENTS.updateIssue: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateIssue({
          body: submission.value,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "update_issue") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Issue updated successfully",
        }),
      });
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

function IssueDescriptionTimelineListItemForm({
  defaultValue,
  onCancel,
  onFinish,
}: {
  onCancel: () => void;
  onFinish: () => void;
  defaultValue: DefaultValue<z.input<typeof schema>>;
}) {
  const fetcher = useFetcher<typeof action>();
  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data &&
      fetcher.data.status !== "error"
    ) {
      onFinish();
    }
  }, [fetcher.data, fetcher.state, onFinish]);
  const [form, fields] = useForm({
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue,
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  return (
    <fetcher.Form
      {...getFormProps(form)}
      className="flex grow flex-col gap-4"
      method="POST"
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
          intent="constructive"
          name={fields.intent.name}
          value={INTENTS.updateIssue}
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
        <Button type="button" space="xs" intent="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </fetcher.Form>
  );
}

function IssueDescriptionTimelineListItem() {
  const loaderData = useLoaderData<typeof loader>();
  const [isEditing, setEditing] = useState(false);

  const handleCancel = useCallback(() => setEditing(false), []);
  const handleFinish = useCallback(() => setEditing(false), []);

  return (
    <li className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-300 last:pb-0 last:before:bottom-auto">
      <div className="shrink-0 pt-4 text-gray-700">
        <IconUserCircle className="stroke-1.5 size-6" />
      </div>
      <div className="grow">
        <div className="flex flex-col rounded-lg border border-gray-300 text-sm text-gray-900">
          <header className="before:border-y-9.5 before:border-r-9.5 after:border-y-9.5 relative flex items-center gap-4 rounded-t-lg bg-gray-50 p-3 before:absolute before:top-2 before:left-[-9.5px] before:size-0 before:translate-y-1/2 before:border-y-transparent before:border-r-gray-300 after:absolute after:top-2 after:-left-2 after:size-0 after:translate-y-1/2 after:border-r-8 after:border-y-transparent after:border-r-gray-50">
            <p className="grow">
              <strong className="font-semibold">Description</strong>
            </p>
            {loaderData.issue.permissions?.edit_title_description.value ? (
              <DropDown
                trigger={
                  <DropDownTrigger aria-label="Issue Actions">
                    <IconDotsVertical className="stroke-1.5 size-4" />
                  </DropDownTrigger>
                }
              >
                <DropDownItem
                  onClick={() => {
                    setEditing(true);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      setEditing(true);
                    }
                  }}
                >
                  <div className="inline-flex flex-row items-center gap-2">
                    <IconEdit className="stroke-1.5 size-4" />
                    <span>Edit</span>
                  </div>
                </DropDownItem>
              </DropDown>
            ) : undefined}
          </header>
          <div className="flex items-center gap-4 rounded-b-lg bg-white p-3">
            {isEditing ? (
              <IssueDescriptionTimelineListItemForm
                onCancel={handleCancel}
                onFinish={handleFinish}
                defaultValue={{
                  description: loaderData.issue.description,
                }}
              />
            ) : (
              <div className="prose prose-sm">
                <Markdown>{loaderData.issue.description}</Markdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function IssueTimelineListItem({
  processedTimelineItem,
}: {
  processedTimelineItem: ProcessedIssueTimelineItem;
}) {
  const id = `timeline-item-${processedTimelineItem.id}`;
  const { user } = processedTimelineItem;

  switch (processedTimelineItem.action_type) {
    case "CREATE_ISSUE":
      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-300 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4 text-gray-700">
            <IconTicket className="stroke-1.5 size-6" />
          </div>
          <div className="grow">
            <div className="flex items-center gap-4 rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900">
              <Avatar title={user.username} src={user.picture ?? undefined} />

              <p>
                <strong className="font-semibold">{user.username}</strong>{" "}
                created an issue{" "}
                <LinkAnchor to={`#${id}`}>
                  <RelativeTime dateTime={processedTimelineItem.created_at} />
                </LinkAnchor>
              </p>
            </div>
          </div>
        </li>
      );
    case "REOPEN_ISSUE":
      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-300 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4 text-gray-700">
            <IconTicket className="stroke-1.5 size-6" />
          </div>
          <div className="grow">
            <div className="flex items-center gap-4 rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900">
              <Avatar title={user.username} src={user.picture ?? undefined} />
              <p>
                <strong className="font-semibold">{user.username}</strong>{" "}
                reopened the issue{" "}
                <LinkAnchor to={`#${id}`}>
                  <RelativeTime dateTime={processedTimelineItem.created_at} />
                </LinkAnchor>
              </p>
            </div>
          </div>
        </li>
      );
    case "CLOSE_ISSUE":
      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-300 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4 text-gray-700">
            <IconTicketOff className="stroke-1.5 size-6" />
          </div>
          <div className="grow">
            <div className="flex items-center gap-4 rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900">
              <Avatar title={user.username} src={user.picture ?? undefined} />
              <p>
                <strong className="font-semibold">{user.username}</strong>{" "}
                closed the issue{" "}
                <LinkAnchor to={`#${id}`}>
                  <RelativeTime dateTime={processedTimelineItem.created_at} />
                </LinkAnchor>
              </p>
            </div>
          </div>
        </li>
      );

    case "UPDATE_TITLE":
      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-300 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4 text-gray-700">
            <IconEdit className="stroke-1.5 size-6" />
          </div>
          <div className="grow">
            <div className="flex items-center gap-4 rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900">
              <Avatar title={user.username} src={user.picture ?? undefined} />
              <p>
                <strong className="font-semibold">{user.username}</strong>{" "}
                updated title{" "}
                <LinkAnchor to={`#${id}`}>
                  <RelativeTime dateTime={processedTimelineItem.created_at} />
                </LinkAnchor>
              </p>
            </div>
          </div>
        </li>
      );
    case "UPDATE_DESCRIPTION":
      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-300 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4 text-gray-700">
            <IconEdit className="stroke-1.5 size-6" />
          </div>
          <div className="grow">
            <div className="flex items-center gap-4 rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900">
              <Avatar title={user.username} src={user.picture ?? undefined} />
              <p>
                <strong className="font-semibold">{user.username}</strong>{" "}
                updated description{" "}
                <LinkAnchor to={`#${id}`}>
                  <RelativeTime dateTime={processedTimelineItem.created_at} />
                </LinkAnchor>
              </p>
            </div>
          </div>
        </li>
      );
    case "UPDATE_LABELS": {
      const { added, removed } = processedTimelineItem.action_details;

      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-300 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4 text-gray-700">
            <IconLabel className="stroke-1.5 size-6" />
          </div>
          <div className="grow">
            <div className="flex items-center gap-4 rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900">
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
            </div>
          </div>
        </li>
      );
    }
    case "UPDATE_ASSIGNEES": {
      const { added, removed } = processedTimelineItem.action_details;

      return (
        <li
          id={id}
          className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-300 last:pb-0 last:before:bottom-auto"
        >
          <div className="shrink-0 pt-4 text-gray-700">
            <IconUsersGroup className="stroke-1.5 size-6" />
          </div>
          <div className="grow">
            <div className="flex items-center gap-4 rounded-lg border border-gray-300 bg-gray-50 p-3 text-sm text-gray-900">
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
                  "as an assignee",
                  "as assignees",
                )}{" "}
                <LinkAnchor to={`#${id}`}>
                  <RelativeTime dateTime={processedTimelineItem.created_at} />
                </LinkAnchor>
              </p>
            </div>
          </div>
        </li>
      );
    }
    case "UPDATE_COMMENT":
    case "ADD_COMMENT":
      return (
        <IssueTimelineListItemComment
          processedTimelineItem={processedTimelineItem}
        />
      );
    default:
      return null;
  }
}

function DeleteCommentForm({
  processedTimelineItem,
}: {
  processedTimelineItem: Extract<
    ProcessedIssueTimelineItem,
    { action_type: "ADD_COMMENT" | "UPDATE_COMMENT" }
  >;
}) {
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    defaultValue: {
      comment_id: processedTimelineItem.action_details.comment_id,
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  return (
    <fetcher.Form {...getFormProps(form)} method="POST">
      <AuthenticityTokenInput />
      <input
        {...getInputProps(fields.comment_id, {
          type: "hidden",
        })}
      />
      <button
        className="inline-flex flex-row items-center gap-2"
        name={fields.intent.name}
        value={INTENTS.deleteIssueComment}
        onClick={(event) => {
          if (
            !confirm(
              "Are you sure you want to delete this comment? This action cannot be undone.",
            )
          ) {
            event.preventDefault();
          }
        }}
      >
        <IconX className="stroke-1.5 size-4 stroke-red-600" />
        <span>Delete</span>
      </button>
    </fetcher.Form>
  );
}

function IssueTimelineListItemCommentForm({
  onCancel,
  onFinish,
  defaultValue,
}: {
  onCancel: () => void;
  onFinish: () => void;
  defaultValue: DefaultValue<z.input<typeof schema>>;
}) {
  const fetcher = useFetcher<typeof action>();
  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data &&
      fetcher.data.status !== "error"
    ) {
      onFinish();
    }
  }, [fetcher.data, fetcher.state, onFinish]);
  const [form, fields] = useForm<z.input<typeof schema>>({
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    defaultValue,
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });
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
          intent="constructive"
          space="xs"
          name={fields.intent.name}
          value={INTENTS.updateIssueComment}
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

function IssueTimelineListItemComment({
  processedTimelineItem,
}: {
  processedTimelineItem: Extract<
    ProcessedIssueTimelineItem,
    { action_type: "ADD_COMMENT" | "UPDATE_COMMENT" }
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
      className="relative flex gap-2.5 pb-4 before:absolute before:top-10 before:-bottom-4 before:left-3 before:w-0.5 before:-translate-x-1/2 before:bg-gray-300 last:pb-0 last:before:bottom-auto"
    >
      <div className="shrink-0 pt-4 text-gray-700">
        <IconMessage className="stroke-1.5 size-6" />
      </div>
      <div className="grow">
        <div className="flex flex-col rounded-lg border border-gray-300 text-sm text-gray-900">
          <header className="before:border-y-9.5 before:border-r-9.5 after:border-y-9.5 relative flex items-center gap-4 rounded-t-lg bg-gray-50 p-3 before:absolute before:top-2 before:left-[-9.5px] before:size-0 before:translate-y-1/2 before:border-y-transparent before:border-r-gray-300 after:absolute after:top-2 after:-left-2 after:size-0 after:translate-y-1/2 after:border-r-8 after:border-y-transparent after:border-r-gray-50">
            <Avatar title={user.username} src={user.picture ?? undefined} />
            <p className="grow">
              <strong className="font-semibold">{user.username}</strong>{" "}
              commented{" "}
              <LinkAnchor to={`#${id}`}>
                <RelativeTime dateTime={processedTimelineItem.created_at} />
              </LinkAnchor>
            </p>
            {processedTimelineItem.permissions?.update_comment.value ||
            processedTimelineItem.permissions?.delete_comment.value ? (
              <DropDown
                trigger={
                  <DropDownTrigger aria-label="Comment Actions">
                    <IconDotsVertical className="stroke-1.5 size-4" />
                  </DropDownTrigger>
                }
              >
                {processedTimelineItem.permissions?.update_comment.value ? (
                  <DropDownItem
                    onClick={() => {
                      setEditing(true);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        setEditing(true);
                      }
                    }}
                  >
                    <div className="inline-flex flex-row items-center gap-2">
                      <IconEdit className="stroke-1.5 size-4" />
                      <span>Edit</span>
                    </div>
                  </DropDownItem>
                ) : undefined}
                {processedTimelineItem.permissions?.delete_comment.value ? (
                  <DropDownItem>
                    <DeleteCommentForm
                      processedTimelineItem={processedTimelineItem}
                    />
                  </DropDownItem>
                ) : undefined}
              </DropDown>
            ) : undefined}
          </header>
          <div className="flex items-center gap-4 rounded-b-lg bg-white p-3">
            {isEditing ? (
              <IssueTimelineListItemCommentForm
                onCancel={handleCancel}
                onFinish={handleFinish}
                defaultValue={{
                  content: processedTimelineItem.action_details.content,
                  comment_id: processedTimelineItem.action_details.comment_id,
                }}
              />
            ) : (
              <div className="prose prose-sm">
                <Markdown>
                  {processedTimelineItem.action_details.content}
                </Markdown>
              </div>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function IssueTitleForm({
  defaultValue,
  onCancel,
  onFinish,
}: {
  defaultValue: DefaultValue<z.input<typeof schema>>;
  onCancel: () => void;
  onFinish: () => void;
}) {
  const fetcher = useFetcher<typeof action>();

  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data &&
      fetcher.data.status !== "error"
    ) {
      onFinish();
    }
  }, [fetcher.data, fetcher.state, onFinish]);
  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    defaultValue,
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  return (
    <fetcher.Form
      {...getFormProps(form)}
      className="flex items-end justify-between gap-3"
      method="POST"
    >
      <AuthenticityTokenInput />
      <ControlFieldInput
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        autoComplete="off"
        fullWidth
        aria-label="Title"
        field={fields.title}
        type="text"
      />
      <div className="flex flex-row-reverse items-center gap-2">
        <Button
          type="submit"
          space="sm"
          name={fields.intent.name}
          value={INTENTS.updateIssue}
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
          Save
        </Button>
        <Button intent="secondary" onClick={onCancel} type="button">
          Cancel
        </Button>
      </div>
    </fetcher.Form>
  );
}

function IssueTitle() {
  const loaderData = useLoaderData<typeof loader>();
  const params = useParams();
  const [isEditing, setEditing] = useState(false);
  const handleCancel = useCallback(() => setEditing(false), []);
  const handleFinish = useCallback(() => setEditing(false), []);

  if (isEditing) {
    return (
      <IssueTitleForm
        onCancel={handleCancel}
        onFinish={handleFinish}
        defaultValue={{
          title: loaderData.issue.title,
        }}
      />
    );
  }

  return (
    <div className="flex items-end justify-between gap-3">
      <h2 className="text-2xl font-semibold text-gray-900">
        {loaderData.issue.title}
      </h2>
      {loaderData.issue.permissions?.edit_title_description.value ? (
        <div className="flex flex-row-reverse items-center gap-2">
          <LinkButton
            space="sm"
            intent="secondary"
            to={`/orgs/${params.org_slug}/databases/${params.database_slug}/issues/new`}
          >
            New Issue
          </LinkButton>
          <Button
            type="button"
            intent="secondary"
            space="sm"
            onClick={() => setEditing(true)}
          >
            Edit
          </Button>
        </div>
      ) : undefined}
    </div>
  );
}

function IssueStatusForm() {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue: {
      status: loaderData.issue.status === "closed" ? "open" : "closed",
    },
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
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
            <IconMaximize className="stroke-1.5 size-4 stroke-green-600" />
          ) : (
            <IconMinimize className="stroke-1.5 size-4 stroke-red-600" />
          )
        }
        intent="secondary"
        name={fields.intent.name}
        space="sm"
        value={INTENTS.updateIssue}
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
              `Are you sure you want to ${
                fields.status.value === "open" ? "reopen" : "close"
              } this issue?`,
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

function CommentForm() {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  return (
    <div className="grow">
      {loaderData.issue.permissions?.create_comment.value ? (
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
          {loaderData.issue.permissions?.create_comment.value ? (
            <Button
              type="submit"
              form={form.id}
              intent="constructive"
              name={fields.intent.name}
              space="sm"
              value={INTENTS.createIssueComment}
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
          {loaderData.issue.permissions?.open_close_issue.value ? (
            <IssueStatusForm />
          ) : undefined}
        </div>
      </div>
    </div>
  );
}

function LabelsForm({ onFinish }: { onFinish: () => void }) {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue: {
      labels: loaderData.issue.labels.map((label) => label.id),
    },
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
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

  const labelsProps = getCollectionProps(fields.labels, {
    type: "checkbox",
    options: loaderData.labels.map((label) => label.id),
  });

  return (
    <fetcher.Form {...getFormProps(form)} className="contents" method="POST">
      <AuthenticityTokenInput />
      <FormDrawerHeader>
        <h3 className="text-lg font-semibold">Edit Labels</h3>
      </FormDrawerHeader>
      <FormDrawerSection>
        <div className="flex flex-col gap-4">
          {loaderData.labels.map((label, index) => {
            const props =
              labelsProps[index] ?? ({} as (typeof labelsProps)[number]);
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
            type="submit"
            intent="constructive"
            space="sm"
            name={fields.intent.name}
            value={INTENTS.updateIssueLabels}
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
            Add Labels
          </Button>
          <Button
            type="button"
            space="sm"
            intent="secondary"
            fullWidth
            onClick={onFinish}
          >
            Cancel
          </Button>
        </div>
      </FormDrawerFooter>
    </fetcher.Form>
  );
}

function AssigneesForm({ onFinish }: { onFinish: () => void }) {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    defaultValue: {
      assignees: loaderData.issue.assignees.map((assignee) => assignee.user.id),
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

  const assigneesProps = getCollectionProps(fields.assignees, {
    type: "checkbox",
    options: loaderData.members.map((member) => member.user.id),
  });

  return (
    <fetcher.Form {...getFormProps(form)} className="contents" method="POST">
      <AuthenticityTokenInput />
      <FormDrawerHeader>
        <h3 className="text-lg font-semibold">Edit Assignees</h3>
      </FormDrawerHeader>
      <FormDrawerSection>
        <div className="flex flex-col gap-4">
          {loaderData.members.map((member, index) => {
            const props =
              assigneesProps[index] ?? ({} as (typeof assigneesProps)[number]);
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
            value={INTENTS.updateIssueAssignees}
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
            Add Assignees
          </Button>
          <Button
            type="button"
            space="sm"
            intent="secondary"
            fullWidth
            onClick={onFinish}
          >
            Cancel
          </Button>
        </div>
      </FormDrawerFooter>
    </fetcher.Form>
  );
}

function RelatedChangeRequestsForm({ onFinish }: { onFinish: () => void }) {
  const loaderData = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue: {
      related_change_requests: loaderData.issue.related_change_requests.map(
        (changeRequest) => changeRequest.change_request_number,
      ),
    },
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
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

  const relatedChangeRequestsProps = getCollectionProps(
    fields.related_change_requests,
    {
      type: "checkbox",
      options: loaderData.change_requests.map((changeRequest) =>
        changeRequest.change_request_number.toString(),
      ),
    },
  );

  return (
    <fetcher.Form {...getFormProps(form)} className="contents" method="POST">
      <AuthenticityTokenInput />
      <FormDrawerHeader>
        <h3 className="text-lg font-semibold">Edit Change Requests</h3>
      </FormDrawerHeader>
      <FormDrawerSection>
        <div className="flex flex-col gap-4">
          {loaderData.change_requests.map((changeRequest, index) => {
            const props =
              relatedChangeRequestsProps[index] ??
              ({} as (typeof relatedChangeRequestsProps)[number]);
            return (
              <InlineField
                key={changeRequest.id}
                label={
                  <InlineFieldLabel htmlFor={props.id}>
                    <span className="inline-flex items-center justify-center rounded-sm border border-gray-200 px-2 py-1 text-sm">
                      #{changeRequest.change_request_number}:{" "}
                      {changeRequest.title}
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
            type="submit"
            name={fields.intent.name}
            value={INTENTS.updateIssueRelations}
            space="sm"
            intent="constructive"
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
            Add Change Requests
          </Button>
          <Button
            type="button"
            space="sm"
            intent="secondary"
            fullWidth
            onClick={onFinish}
          >
            Cancel
          </Button>
        </div>
      </FormDrawerFooter>
    </fetcher.Form>
  );
}

export default function Route() {
  const loaderData = useLoaderData<typeof loader>();
  const params = useParams();
  const [formDrawerState, setFormDrawerState] =
    useState<FormDrawerState>("closed");
  const createdByMember = loaderData.processed_issue_timeline[0]?.user;

  const handleClose = useCallback(() => setFormDrawerState("closed"), []);

  return (
    <Article>
      <div className="flex flex-col gap-4 md:flex-1 md:flex-row md:gap-8">
        <header className="flex flex-col gap-4 md:flex-1 md:gap-8">
          <IssueTitle key={loaderData.issue.title} />
          <p className="flex flex-wrap items-center gap-2 text-gray-700">
            <Tag
              iconLeft={<IconTicket className="stroke-1.5 size-4" />}
              intent={
                loaderData.issue.status === "open"
                  ? "positive"
                  : loaderData.issue.status === "closed"
                    ? "negative"
                    : "neutral"
              }
            >
              {loaderData.issue.status === "open" ? "Open" : "Closed"}
            </Tag>
            #{loaderData.issue.issue_number} opened{" "}
            <RelativeTime dateTime={loaderData.issue.created_at} /> by{" "}
            {createdByMember?.username}
          </p>
          <ol className="flex flex-col">
            <IssueDescriptionTimelineListItem
              key={loaderData.issue.description}
            />
            {loaderData.processed_issue_timeline.map(
              (processedTimelineItem) => (
                <IssueTimelineListItem
                  key={processedTimelineItem.id}
                  processedTimelineItem={processedTimelineItem}
                />
              ),
            )}
          </ol>
          <hr className="border-gray-300" />
          <div className="flex gap-2">
            <div className="shrink-0 pt-4 text-gray-700">
              <IconUserCircle className="stroke-1.5 size-6" />
            </div>
            <CommentForm />
          </div>
        </header>
        <div className="flex w-full flex-col gap-4 md:w-64 md:gap-8">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h3>Labels</h3>
              {loaderData.issue.permissions?.edit_labels.value ? (
                <button
                  className="flex items-center gap-2 text-gray-700"
                  onClick={() => setFormDrawerState("editLabelsOpen")}
                >
                  <IconEdit className="stroke-1.5 size-5" />
                  <span>Edit</span>
                </button>
              ) : undefined}
            </div>
            {loaderData.issue.labels.length ? (
              <ul className="flex flex-wrap gap-2">
                {loaderData.issue.labels.map((label) => (
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
            <LabelsForm onFinish={handleClose} />
          </FormDrawer>
          <hr className="border-gray-300" />
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h3>Assignees</h3>
              {loaderData.issue.permissions?.edit_labels.value ? (
                <button
                  className="flex items-center gap-2 text-gray-700"
                  onClick={() => setFormDrawerState("editAssigneesOpen")}
                >
                  <IconEdit className="stroke-1.5 size-5" />
                  <span>Edit</span>
                </button>
              ) : undefined}
            </div>
            {loaderData.issue.assignees.length ? (
              <ul className="flex flex-wrap gap-2">
                {loaderData.issue.assignees.map((member) => (
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
                ))}
              </ul>
            ) : undefined}
          </div>
          <FormDrawer
            onClose={handleClose}
            open={formDrawerState === "editAssigneesOpen"}
          >
            <AssigneesForm onFinish={handleClose} />
          </FormDrawer>
          <hr className="border-gray-300" />
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <h3>Change Requests</h3>
              {loaderData.issue.permissions?.edit_labels.value ? (
                <button
                  className="flex items-center gap-2 text-gray-700"
                  onClick={() =>
                    setFormDrawerState("editRelatedChangeRequestsOpen")
                  }
                >
                  <IconEdit className="stroke-1.5 size-5" />
                  <span>Edit</span>
                </button>
              ) : undefined}
            </div>
            {loaderData.issue.related_change_requests.length ? (
              <ul className="flex flex-wrap gap-2">
                {loaderData.issue.related_change_requests.map(
                  (changeRequest) => (
                    <li key={changeRequest.change_request_id}>
                      <Link
                        to={`/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${changeRequest.change_request_number}`}
                        className="inline-flex items-center justify-center rounded-sm border border-gray-200 px-2 py-1 text-sm"
                      >
                        #{changeRequest.change_request_number}:{" "}
                        {changeRequest.change_request_title}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            ) : undefined}
          </div>
          <FormDrawer
            onClose={handleClose}
            open={formDrawerState === "editRelatedChangeRequestsOpen"}
          >
            <RelatedChangeRequestsForm onFinish={handleClose} />
          </FormDrawer>
        </div>
      </div>
    </Article>
  );
}
