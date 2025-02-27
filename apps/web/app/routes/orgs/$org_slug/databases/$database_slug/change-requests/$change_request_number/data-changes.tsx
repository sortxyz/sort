import type { DefaultValue } from "@conform-to/react";
import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import type { Json, V2 } from "@sort/sdk";
import { mergeHeaders } from "@sort/sdk";
import {
  IconChevronDown,
  IconChevronUp,
  IconDotsVertical,
  IconMessageCircle,
  IconTable,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  UIMatch,
} from "react-router";
import {
  data,
  redirect,
  useFetcher,
  useLoaderData,
  useParams,
  useRouteLoaderData,
} from "react-router";
import { Fragment } from "react/jsx-runtime";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { z } from "zod";
import { LinkAnchor } from "~/components/anchor";
import { Avatar } from "~/components/avatar";
import { Badge } from "~/components/badge";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import { Button } from "~/components/button";
import {
  ControlGroupField,
  ControlGroupFieldInput,
} from "~/components/control-group-field";
import { ControlMarkdownFieldTextarea } from "~/components/control-markdown-field";
import { DiffView } from "~/components/diff-view";
import {
  DropDown,
  DropDownItem,
  DropDownTrigger,
} from "~/components/drop-down";
import { Markdown } from "~/components/markdown";
import { RelativeTime } from "~/components/relative-time";
import { Spinner } from "~/components/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadRow,
  TableHeader,
  TableRow,
} from "~/components/table";
import type { loader as orgLoader } from "~/routes/orgs/$org_slug";
import type { loader as changeRequestLoader } from "~/routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { getFlags } from "~/services/flags.server";
import { validateCsrf } from "~/utils/csrf.server";
import { setFlashHeaders } from "~/utils/flash";
import { errorMessageToReplyOptions } from "~/utils/message";
import { dataFnMiddleware } from "~/utils/request.server";
import {
  assertResponse,
  assertResponseParams,
  extractMessageOrThrow,
} from "~/utils/response";
import { pluralize } from "~/utils/string";

const INTENTS = {
  createApproveReview: "createApproveReview",
  createChangeRequestComment: "createChangeRequestComment",
  deleteChangeRequestChange: "deleteChangeRequestChange",
  deleteChangeRequestComment: "deleteChangeRequestComment",
  updateChangeRequestComment: "updateChangeRequestComment",
} as const;

const schema = z
  .discriminatedUnion("intent", [
    z.object({
      intent: z.literal(INTENTS.createChangeRequestComment),
      content: z.string().min(1),
      change_id: z.string(),
    }),
    z.object({
      intent: z.literal(INTENTS.updateChangeRequestComment),
      comment_id: z.string(),
      content: z.string().min(1),
      change_id: z.string(),
    }),
    z.object({
      intent: z.literal(INTENTS.deleteChangeRequestComment),
      comment_id: z.string(),
    }),
    z.object({
      intent: z.literal(INTENTS.createApproveReview),
      text: z.string().min(1).optional(),
      event_type: z.enum(["APPROVE", "COMMENT", "APPROVE_EXECUTE"]),
    }),
    z.object({
      intent: z.literal(INTENTS.deleteChangeRequestChange),
      change_id: z.string(),
    }),
  ])
  .superRefine((arg, ctx) => {
    if (arg.intent === INTENTS.createApproveReview) {
      if (
        arg.event_type === "COMMENT" &&
        (typeof arg.text !== "string" || arg.text.trim() === "")
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Comment is required",
          path: ["text"],
        });
      }
    }
  });

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

  const {
    payload: { changes },
  } = await dataFnMiddleware(
    request,
    client.v2.listChanges({
      headers,
      params,
    }),
  ).then(extractMessageOrThrow("list_changes"));

  return { changes };
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

      return submission.reply({ resetForm: true });
    }
    case INTENTS.updateChangeRequestComment: {
      const { comment_id, ...body } = submission.value;
      const response = await dataFnMiddleware(
        request,
        client.v2.updateChangeRequestComment({
          body,
          headers,
          params: {
            ...params,
            comment_id,
          },
        }),
      );

      const message = await response.json();

      if (message.type !== "update_change_request_comment") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return submission.reply({ resetForm: true });
    }
    case INTENTS.deleteChangeRequestChange: {
      const response = await dataFnMiddleware(
        request,
        client.v2.deleteChange({
          headers,
          params: {
            ...params,
            change_id: submission.value.change_id,
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
          message: "Change deleted successfully",
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
    case INTENTS.createApproveReview: {
      const bodySubmissionValue = {
        event_type:
          submission.value.event_type === "APPROVE_EXECUTE"
            ? "APPROVE"
            : submission.value.event_type,
        text: submission.value.text,
      };

      const response = await dataFnMiddleware(
        request,
        client.v2.createApproveReview({
          body: bodySubmissionValue,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "create_review") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      let successMessage = "Review created successfully";

      if (submission.value.event_type === "APPROVE_EXECUTE") {
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

        successMessage =
          "Change Request execution started successfully. Please refresh the page soon to see the updated status.";
      }

      throw redirect(
        `/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}`,
        {
          headers: await setFlashHeaders({
            type: "success",
            message: successMessage,
          }),
        },
      );
    }
  }
}

export const handle = {
  breadcrumb(match: UIMatch<typeof loader>) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        Data Changes
      </BreadcrumbNavLink>
    );
  },
};

function diffFromChange(change: V2.Change): [Json, Json][] {
  switch (change.action) {
    case "ADD": {
      const values = change.fields.map((field) => field.value);
      return Array.from(values, (v) => ["", v]);
    }
    case "MODIFY": {
      const previous = change.previous_fields.map((field) => field.value);
      const values = change.fields.map((field) => field.value);
      return Array.from(values, (v, i) => [
        previous[i] === undefined ? "" : previous[i],
        v,
      ]);
    }
    case "DELETE": {
      return Array.from(change.previous_fields, (field) => [field.value, ""]);
    }
  }
}

function augmentChangeWithColumns(
  change: V2.Change,
  columns: V2.Column[],
): V2.Change {
  switch (change.action) {
    case "ADD": {
      const fields = columns.map((column) => {
        const field =
          change.fields.find((field) => field.column_name === column.name) ??
          ({
            column_name: column.name,
            value: null,
            type: column.type,
          } as V2.ChangeField);
        return field;
      });
      return {
        ...change,
        fields,
      };
    }
    case "MODIFY": {
      // make sure fields and previous_fields are in the same order as columns
      const { fields, previous_fields } = columns.reduce(
        (acc, column) => {
          const field = change.fields.find(
            (field) => field.column_name === column.name,
          );
          const previous_field =
            change.previous_fields.find(
              (field) => field.column_name === column.name,
            ) ??
            ({
              column_name: column.name,
              value: null,
              type: column.type,
            } as V2.ChangeField);

          acc.fields.push(field ?? previous_field);
          acc.previous_fields.push(previous_field);
          return acc;
        },
        {
          fields: [] as V2.ChangeField[],
          previous_fields: [] as V2.ChangeField[],
        },
      );

      return {
        ...change,
        fields,
        previous_fields,
      };
    }
    case "DELETE": {
      return change;
    }
  }
}

function groupChangesBySchema(changes: V2.Change[], schemas: V2.Schema[]) {
  const result: {
    schema_name: string;
    table_name: string;
    columns: V2.Column[];
    changes: V2.Change[];
  }[] = [];
  for (const schema of schemas) {
    for (const table of schema.tables ?? []) {
      const tableChanges: V2.Change[] = [];
      const columns: V2.Column[] = table.columns ?? [];
      for (const change of changes) {
        if (
          change.schema_name === schema.name &&
          change.table_name === table.name
        ) {
          tableChanges.push(augmentChangeWithColumns(change, columns));
        }
      }
      if (tableChanges.length) {
        result.push({
          schema_name: schema.name,
          table_name: table.name,
          columns,
          changes: tableChanges,
        });
      }
    }
  }

  return result;
}

function AddCommentForChangeForm({
  onFinish,
  onCancel,
  defaultValue,
}: {
  onFinish: () => void;
  onCancel: () => void;
  defaultValue: DefaultValue<z.input<typeof schema>>;
}) {
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm<
    z.input<typeof schema>,
    z.output<typeof schema>
  >({
    constraint: getZodConstraint(schema),
    defaultValue,
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
        {...getInputProps(fields.change_id, {
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
          value={INTENTS.createChangeRequestComment}
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

function EditCommentForChangeForm({
  onFinish,
  onCancel,
  defaultValue,
}: {
  onFinish: () => void;
  onCancel: () => void;
  defaultValue: DefaultValue<z.input<typeof schema>>;
}) {
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm<
    z.input<typeof schema>,
    z.output<typeof schema>
  >({
    constraint: getZodConstraint(schema),
    defaultValue,
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
      <input
        {...getInputProps(fields.change_id, {
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

function DeleteCommentForChangeForm({
  onFinish,
  defaultValue,
}: {
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
    <fetcher.Form {...getFormProps(form)} className="contents" method="POST">
      <AuthenticityTokenInput />
      <input
        {...getInputProps(fields.comment_id, {
          type: "hidden",
        })}
      />
      <input
        {...getInputProps(fields.change_id, {
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
        Remove Comment
      </Button>
    </fetcher.Form>
  );
}

function DeleteChangeForm({
  onFinish,
  defaultValue,
}: {
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
    <fetcher.Form {...getFormProps(form)} className="contents" method="POST">
      <AuthenticityTokenInput />
      <input
        {...getInputProps(fields.change_id, {
          type: "hidden",
        })}
      />
      <Button
        type="submit"
        space="xs"
        intent="destructive"
        name={fields.intent.name}
        value={INTENTS.deleteChangeRequestChange}
        onClick={(event) => {
          event.stopPropagation();
          if (
            !confirm(
              "Are you sure you want to delete this change? This action cannot be undone.",
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
        Remove Change
      </Button>
    </fetcher.Form>
  );
}

function CommentForChange({
  change,
  changeRequestTimelineItem,
}: {
  change: V2.Change;
  changeRequestTimelineItem: Extract<
    V2.ChangeRequestTimelineItem,
    { action_type: "ADD_COMMENT" | "UPDATE_COMMENT" }
  >;
}) {
  const [expanded, setExpanded] = useState(false);
  const [state, setState] = useState<"initial" | "edit-comment">("initial");
  const handleReset = useCallback(() => setState("initial"), [setState]);
  const preventDefault = useCallback<React.ReactEventHandler<HTMLElement>>(
    (event) => event.preventDefault(),
    [],
  );

  const id = `timeline-item-${changeRequestTimelineItem.id}`;

  return (
    <div
      id={id}
      className="rounded-lg border border-gray-300 text-sm text-gray-900"
    >
      <header className="flex items-center gap-3 rounded-t-lg bg-gray-50 px-4 py-3">
        <Avatar
          title={changeRequestTimelineItem.user.name}
          src={changeRequestTimelineItem.user.picture ?? undefined}
        />
        <p className="grow">
          <strong className="font-semibold">
            {changeRequestTimelineItem.user.name}
          </strong>{" "}
          commented{" "}
          <LinkAnchor to={`#${id}`}>
            <RelativeTime dateTime={changeRequestTimelineItem.created_at} />
          </LinkAnchor>
        </p>
        {changeRequestTimelineItem.permissions?.update_comment.value ||
        changeRequestTimelineItem.permissions?.delete_comment.value ? (
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
            {changeRequestTimelineItem.permissions.update_comment.value ? (
              <DropDownItem>
                <button onClick={() => setState("edit-comment")}>
                  Edit Comment
                </button>
              </DropDownItem>
            ) : undefined}
            {changeRequestTimelineItem.permissions.delete_comment.value ? (
              <DropDownItem onKeyDown={preventDefault} onClick={preventDefault}>
                <DeleteCommentForChangeForm
                  defaultValue={{
                    change_id: change.id,
                    comment_id:
                      changeRequestTimelineItem.action_details.comment_id,
                  }}
                  onFinish={() => setExpanded(false)}
                />
              </DropDownItem>
            ) : undefined}
          </DropDown>
        ) : undefined}
      </header>
      <div className="flex items-center gap-4 rounded-b-lg bg-white p-4">
        {state === "edit-comment" ? (
          <EditCommentForChangeForm
            defaultValue={{
              change_id: change.id,
              comment_id: changeRequestTimelineItem.action_details.comment_id,
              content: changeRequestTimelineItem.action_details.content,
            }}
            onCancel={handleReset}
            onFinish={handleReset}
          />
        ) : (
          <div className="prose prose-sm max-w-none">
            <Markdown>
              {changeRequestTimelineItem.action_details.content}
            </Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

function ChangeForSchema({
  change,
  columns,
  commentsExpanded,
  setCommentsExpanded,
}: {
  change: V2.Change;
  columns: V2.Column[];
  commentsExpanded: boolean;
  setCommentsExpanded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const changeRequestLoaderData = useRouteLoaderData<
    typeof changeRequestLoader
  >(
    "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number",
  )!;
  const diff = useMemo(() => diffFromChange(change), [change]);
  const timelineCommentsForChange = useMemo(
    () =>
      changeRequestLoaderData.change_request_timeline.filter(
        (
          item,
        ): item is Extract<
          V2.ChangeRequestTimelineItem,
          { action_type: "ADD_COMMENT" | "UPDATE_COMMENT" }
        > =>
          (item.action_type === "ADD_COMMENT" ||
            item.action_type === "UPDATE_COMMENT") &&
          item.action_details.change_id === change.id,
      ),
    [changeRequestLoaderData.change_request_timeline, change.id],
  );
  const [state, setState] = useState<"initial" | "add-comment">("initial");
  const handleReset = useCallback(() => setState("initial"), []);
  const handleFinish = useCallback(() => {
    setState("initial");
    setCommentsExpanded(true);
  }, [setCommentsExpanded]);
  const [expanded, setExpanded] = useState(false);
  const preventDefault = useCallback<React.ReactEventHandler<HTMLElement>>(
    (event) => event.preventDefault(),
    [],
  );

  return (
    <Fragment>
      <TableRow>
        {changeRequestLoaderData.change_request.permissions?.create_comment
          .value ? (
          <TableCell layout="dropdown" collapseBorder>
            <DropDown
              expanded={expanded}
              setExpanded={setExpanded}
              position="center left"
              trigger={
                <DropDownTrigger aria-label="Change Actions">
                  <IconDotsVertical className="stroke-1.5 size-4" />
                </DropDownTrigger>
              }
            >
              <DropDownItem>
                <button onClick={() => setState("add-comment")}>
                  Add Comment
                </button>
              </DropDownItem>
              <DropDownItem
                onClick={preventDefault}
                onMouseDown={preventDefault}
              >
                <DeleteChangeForm
                  defaultValue={{ change_id: change.id }}
                  onFinish={() => setExpanded(false)}
                />
              </DropDownItem>
            </DropDown>
          </TableCell>
        ) : undefined}
        {diff.map(([oldValue, newValue], index) => (
          <TableCell key={index}>
            <DiffView oldValue={oldValue} newValue={newValue} />
          </TableCell>
        ))}
      </TableRow>
      {timelineCommentsForChange.length && commentsExpanded ? (
        <TableRow>
          <TableCell colSpan={columns.length + 1}>
            <div className="flex max-w-[min(1380px,100vw-109px)] flex-col gap-4 md:max-w-[min(1380px,100vw-169px)] lg:max-w-[min(1380px,100vw-409px)]">
              {timelineCommentsForChange.map((changeRequestTimelineItem) => (
                <CommentForChange
                  key={changeRequestTimelineItem.action_details.comment_id}
                  change={change}
                  changeRequestTimelineItem={changeRequestTimelineItem}
                />
              ))}
            </div>
          </TableCell>
        </TableRow>
      ) : undefined}
      {state === "add-comment" ? (
        <TableRow>
          <TableCell colSpan={columns.length + 1}>
            <div className="flex max-w-[min(1380px,100vw-109px)] flex-col gap-4 md:max-w-[min(1380px,100vw-169px)] lg:max-w-[min(1380px,100vw-409px)]">
              <AddCommentForChangeForm
                defaultValue={{
                  change_id: change.id,
                }}
                onCancel={handleReset}
                onFinish={handleFinish}
              />
            </div>
          </TableCell>
        </TableRow>
      ) : undefined}
    </Fragment>
  );
}

function ChangesForSchema({
  schema_name,
  table_name,
  columns,
  changes,
}: {
  schema_name: string;
  table_name: string;
  columns: V2.Column[];
  changes: V2.Change[];
}) {
  const params = useParams();
  const changeRequestLoaderData = useRouteLoaderData<
    typeof changeRequestLoader
  >(
    "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number",
  )!;
  const timelineCommentsCountForTable = useMemo(
    () =>
      changes
        .map((change) =>
          changeRequestLoaderData.change_request_timeline.filter(
            (
              item,
            ): item is Extract<
              V2.ChangeRequestTimelineItem,
              { action_type: "ADD_COMMENT" | "UPDATE_COMMENT" }
            > =>
              (item.action_type === "ADD_COMMENT" ||
                item.action_type === "UPDATE_COMMENT") &&
              item.action_details.change_id === change.id,
          ),
        )
        .flat().length,
    [changeRequestLoaderData.change_request_timeline, changes],
  );

  const [commentsExpanded, setCommentsExpanded] = useState(true);

  return (
    <li className="flex flex-col gap-4 rounded-md border border-gray-300 p-4">
      <header className="-mx-4 -mt-4 flex items-center justify-between gap-3 rounded-t-lg border-b border-gray-300 bg-gray-50 px-4 py-3">
        <LinkAnchor
          to={
            changeRequestLoaderData.change_request.status === "applied"
              ? `/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/schemas/${schema_name}/tables/${table_name}`
              : `/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/explorer/schemas/${schema_name}/tables/${table_name}`
          }
          iconLeft={<IconTable className="stroke-1.5 size-6" />}
        >
          {schema_name}.{table_name}
        </LinkAnchor>
        {timelineCommentsCountForTable ? (
          <Badge
            text={timelineCommentsCountForTable.toString()}
            intent="neutral"
            aria-label={`There are ${timelineCommentsCountForTable} ${pluralize(timelineCommentsCountForTable, "comment", "comments")} for the ${table_name} table`}
          >
            <button
              className="inline-flex aspect-auto shrink-0 cursor-pointer items-center justify-center rounded-sm border border-gray-300 bg-gray-50 text-gray-700 select-none hover:border-gray-400 hover:bg-gray-100 focus:ring-2 focus:ring-gray-900 active:border-gray-400 active:bg-gray-200 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 aria-disabled:border-gray-200 aria-disabled:bg-gray-50 aria-disabled:text-gray-400 aria-expanded:border-gray-400 aria-expanded:bg-gray-200"
              aria-label="Toggle Comments"
              aria-expanded={commentsExpanded}
              onClick={() => setCommentsExpanded((prev) => !prev)}
            >
              <IconMessageCircle className="stroke-1.5 size-6" role="none" />
            </button>
          </Badge>
        ) : undefined}
      </header>
      <section>
        <Table>
          <TableHead>
            <TableHeadRow>
              <TableHeader collapseBorder />
              {columns.map((column) => (
                <TableHeader key={column.name}>{column.name}</TableHeader>
              ))}
            </TableHeadRow>
          </TableHead>
          <TableBody>
            {changes.map((change) => (
              <ChangeForSchema
                change={change}
                columns={columns}
                key={change.id}
                commentsExpanded={commentsExpanded}
                setCommentsExpanded={setCommentsExpanded}
              />
            ))}
          </TableBody>
        </Table>
      </section>
    </li>
  );
}

function ReviewForm({
  onFinish,
  onCancel,
  defaultValue,
  isOrgAdmin,
}: {
  onFinish: () => void;
  onCancel: () => void;
  defaultValue: DefaultValue<z.input<typeof schema>>;
  isOrgAdmin: boolean;
}) {
  const fetcher = useFetcher<typeof action>();
  const [form, fields] = useForm<
    z.input<typeof schema>,
    z.output<typeof schema>
  >({
    constraint: getZodConstraint(schema),
    defaultValue,
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
      className="flex flex-col gap-4"
      method="POST"
    >
      <AuthenticityTokenInput />
      <ControlMarkdownFieldTextarea
        autoComplete="off"
        aria-label="Comment"
        placeholder="Leave a comment"
        field={fields.text}
      />
      <ControlGroupField field={fields.event_type} aria-label="Review Type">
        <ControlGroupFieldInput
          field={fields.event_type}
          type="radio"
          label="Comment"
          helperText="Comment on the changes"
          defaultValue="COMMENT"
        />
        <ControlGroupFieldInput
          field={fields.event_type}
          type="radio"
          label="Approve"
          helperText="Approve the changes"
          defaultValue="APPROVE"
        />
        {isOrgAdmin ? (
          <ControlGroupFieldInput
            field={fields.event_type}
            type="radio"
            label="Approve and Execute"
            helperText="Approve the changes and execute"
            defaultValue="APPROVE_EXECUTE"
          />
        ) : undefined}
      </ControlGroupField>
      <div className="flex flex-row-reverse items-center gap-2">
        <Button
          type="submit"
          form={form.id}
          intent="constructive"
          name={fields.intent.name}
          space="xs"
          value={INTENTS.createApproveReview}
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
          Add Review
        </Button>
        <Button type="button" space="xs" intent="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </fetcher.Form>
  );
}

export default function Route() {
  const loaderData = useLoaderData<typeof loader>();
  const orgLoaderData = useRouteLoaderData<typeof orgLoader>(
    "routes/orgs/$org_slug",
  );
  const changeRequestLoaderData = useRouteLoaderData<
    typeof changeRequestLoader
  >(
    "routes/orgs/$org_slug/databases/$database_slug/change-requests/$change_request_number",
  )!;

  const changesBySchema = groupChangesBySchema(
    loaderData.changes,
    changeRequestLoaderData.schemas,
  );

  const [isReviewing, setIsReviewing] = useState(false);

  const isOrgAdmin =
    orgLoaderData?.organization.permissions?.is_owner.value ?? false;

  return (
    <section className="flex flex-col gap-4">
      <header className="flex justify-end">
        <Button
          intent="secondary"
          type="button"
          iconRight={
            isReviewing ? (
              <IconChevronUp className="stroke-1.5 size-4" />
            ) : (
              <IconChevronDown className="stroke-1.5 size-4" />
            )
          }
          space="sm"
          onClick={() => setIsReviewing((prev) => !prev)}
        >
          Review Changes
        </Button>
      </header>
      {isReviewing ? (
        <div className="flex flex-col rounded-lg border border-gray-300 text-sm text-gray-900">
          <header className="relative flex items-center gap-3 rounded-t-lg border-b border-gray-200 bg-gray-50 px-4 py-3">
            <p className="grow">
              <strong className="font-semibold">Finish your review</strong>{" "}
            </p>
          </header>
          <div className="flex flex-col gap-4 rounded-b-lg bg-white p-4">
            <ReviewForm
              defaultValue={{ event_type: "COMMENT" }}
              onCancel={() => setIsReviewing(false)}
              onFinish={() => setIsReviewing(false)}
              isOrgAdmin={isOrgAdmin}
            />
          </div>
        </div>
      ) : undefined}
      <ul className="flex flex-col gap-4">
        {changesBySchema.map(
          ({ changes, columns, schema_name, table_name }, index) => (
            <ChangesForSchema
              changes={changes}
              columns={columns}
              key={index}
              schema_name={schema_name}
              table_name={table_name}
            />
          ),
        )}
      </ul>
    </section>
  );
}
