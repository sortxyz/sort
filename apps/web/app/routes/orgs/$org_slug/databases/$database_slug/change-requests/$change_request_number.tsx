import type { DefaultValue } from "@conform-to/react";
import { getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import type { V2 } from "@sort/sdk";
import { mergeHeaders } from "@sort/sdk";
import { IconGitPullRequest } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaArgs,
  MetaDescriptor,
  UIMatch,
} from "react-router";
import {
  data,
  Outlet,
  useFetcher,
  useLoaderData,
  useMatch,
  useParams,
  useRouteLoaderData,
} from "react-router";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { z } from "zod";
import { Article } from "~/components/article";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import { Button, LinkButton } from "~/components/button";
import { ControlFieldInput } from "~/components/control-field";
import { FlashMessage } from "~/components/flash-message";
import { Indicator } from "~/components/indicator";
import { RelativeTime } from "~/components/relative-time";
import { Spinner } from "~/components/spinner";
import {
  Tabs,
  TabsList,
  TabsListNavLinkTab,
  TabsPanel,
} from "~/components/tabs";
import { Tag } from "~/components/tag";
import type { loader as rootLoader } from "~/root";
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
import { capitalizeWord } from "~/utils/string";

const INTENTS = {
  updateChangeRequest: "updateChangeRequest",
} as const;

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
      payload: { change_request },
    },
    {
      payload: { members },
    },
    {
      payload: { change_request_timeline },
    },
    {
      payload: { schemas },
    },
  ] = await Promise.all([
    dataFnMiddleware(
      request,
      client.v2.getChangeRequest({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("get_change_request")),
    dataFnMiddleware(
      request,
      client.v2.listOrganizationMembers({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_organization_members")),
    dataFnMiddleware(
      request,
      client.v2.listChangeRequestTimeline({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_change_request_timeline")),
    dataFnMiddleware(
      request,
      client.v2.listDatabaseSchemas({
        headers,
        params,
        searchParams: new URLSearchParams({ include: "columns" }),
      }),
    ).then(extractMessageOrThrow("list_database_schemas")),
  ]);

  return {
    change_request,
    change_request_timeline,
    members,
    schemas,
  };
}

export function meta({ data }: MetaArgs<typeof loader>) {
  return [
    {
      title: data?.change_request.title,
    },
  ] satisfies MetaDescriptor[];
}

export const handle = {
  banner: function Banner(match: UIMatch<Awaited<ReturnType<typeof loader>>>) {
    const { org_slug, database_slug, change_request_number } = match.params;

    const rootLoaderData = useRouteLoaderData<typeof rootLoader>("root");
    const sortProfile = rootLoaderData?.sortProfile;

    if (
      !org_slug ||
      !database_slug ||
      !change_request_number ||
      match.data?.change_request.status !== "open"
    ) {
      return undefined;
    }

    if (!sortProfile) {
      return undefined;
    }

    const isReviewer = userIsReviewer(match.data.change_request, sortProfile);
    const hasReview = hasActiveReview(
      match.data.change_request_timeline,
      sortProfile,
    );

    if (!sortProfile || !isReviewer || hasReview) {
      return undefined;
    }

    return (
      <FlashMessage
        category="neutralCouldHappen"
        title="Review Requested"
        description="You have been asked to review this Change Request."
        buttonGroup={
          <div>
            <LinkButton
              space="xs"
              to={`/orgs/${org_slug}/databases/${database_slug}/change-requests/${change_request_number}/data-changes`}
            >
              Add your review
            </LinkButton>
          </div>
        }
      />
    );
  },
  breadcrumb(match: UIMatch<Awaited<ReturnType<typeof loader>>>) {
    const num = match.data?.change_request?.change_request_number;
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        {num ? `#${num}` : "Change Request"}
      </BreadcrumbNavLink>
    );
  },
};

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
  }
}

const schema = z.object({
  intent: z.literal(INTENTS.updateChangeRequest),
  title: z.string().min(1),
});

function ChangeRequestTitleForm({
  onFinish,
  onCancel,
  defaultValue,
}: {
  onFinish: () => void;
  onCancel: () => void;
  defaultValue: DefaultValue<z.input<typeof schema>>;
}) {
  const fetcher = useFetcher<typeof action>();
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

  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data &&
      fetcher.data.status !== "error"
    ) {
      onFinish();
    }
  }, [fetcher.state, fetcher.data, onFinish]);

  return (
    <fetcher.Form
      {...getFormProps(form)}
      method="POST"
      className="flex items-end justify-between gap-3"
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
          value={INTENTS.updateChangeRequest}
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
        <Button intent="secondary" onClick={onCancel} space="sm" type="button">
          Cancel
        </Button>
      </div>
    </fetcher.Form>
  );
}

function isOpen(
  status: V2.ChangeRequest["status"],
): status is "open" | "approved" | "executing" {
  return /open|approved|executing/.test(status);
}

function ActionStatus({ capitalize = false }: { capitalize?: boolean }) {
  const loaderData = useLoaderData<typeof loader>();
  const value =
    loaderData.change_request.status === "closed"
      ? "closed"
      : loaderData.change_request.status === "applied"
        ? "applied"
        : "opened";

  return capitalize ? capitalizeWord(value) : value;
}

function StatusDate() {
  const loaderData = useLoaderData<typeof loader>();

  if (isOpen(loaderData.change_request.status)) {
    return <RelativeTime dateTime={loaderData.change_request.created_at} />;
  }

  return <RelativeTime dateTime={loaderData.change_request.updated_at} />;
}

function userIsReviewer(changeRequest: V2.ChangeRequest, profile: V2.Profile) {
  return (
    changeRequest.reviewers.length > 0 &&
    changeRequest.reviewers.some((reviewer) => reviewer.user.id === profile.id)
  );
}

function hasActiveReview(
  timeline: V2.ChangeRequestTimelineItem[],
  profile: V2.Profile,
) {
  for (let i = timeline.length - 1; i >= 0; i--) {
    const item = timeline[i];
    if (!item) {
      continue;
    }
    switch (item.action_type) {
      case "ADD_REVIEW":
        return item.user.id === profile.id;
      case "REOPEN_CHANGE_REQUEST":
        return false;
    }
  }

  return false;
}

const tabs = [
  {
    splat: "",
    title: "Conversation",
  },
  {
    splat: "data-changes",
    title: "Data Changes",
  },
] as const;

export default function Route() {
  const loaderData = useLoaderData<typeof loader>();
  const params = useParams();
  const [isEditing, setEditing] = useState(false);
  const handleFinishEditing = useCallback(() => setEditing(false), []);
  const handleCancelEditing = useCallback(() => setEditing(false), []);
  const createdByMember = loaderData.change_request_timeline[0]?.user;
  const match = useMatch({
    path: "/orgs/:org_slug/databases/:database_slug/change-requests/:change_request_number/*",
  });

  const splat = match?.params["*"] ?? "";

  const selectedIndex = tabs.findIndex((tab) => tab.splat === splat);

  return (
    <Article>
      <header className="flex flex-col gap-4 md:flex-1">
        {isEditing ? (
          <ChangeRequestTitleForm
            onFinish={handleFinishEditing}
            onCancel={handleCancelEditing}
            defaultValue={{
              title: loaderData.change_request.title,
            }}
          />
        ) : (
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-2xl font-semibold text-gray-900">
              {loaderData.change_request.title}
            </h2>
            {loaderData.change_request.permissions?.edit_title_description
              .value ||
            loaderData.change_request.permissions?.edit_changes.value ? (
              <div className="flex flex-row items-center gap-2">
                {loaderData.change_request.permissions?.edit_title_description
                  .value ? (
                  <Button
                    type="button"
                    intent="secondary"
                    space="sm"
                    onClick={() => setEditing((prev) => !prev)}
                  >
                    Edit
                  </Button>
                ) : undefined}
                {loaderData.change_request.permissions?.edit_changes.value ? (
                  <LinkButton
                    intent="secondary"
                    space="sm"
                    to={`/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}/explorer`}
                  >
                    Add Changes
                  </LinkButton>
                ) : undefined}
              </div>
            ) : undefined}
          </div>
        )}
        <p className="flex flex-wrap items-center gap-2 text-gray-700">
          <Tag
            iconLeft={<IconGitPullRequest className="stroke-1.5 size-4" />}
            intent={
              loaderData.change_request.status === "closed"
                ? "negative"
                : isOpen(loaderData.change_request.status)
                  ? "positive"
                  : loaderData.change_request.status === "applied"
                    ? "terminal"
                    : "neutral"
            }
          >
            <ActionStatus capitalize />
          </Tag>
          #{loaderData.change_request.change_request_number} <ActionStatus />
          <StatusDate />
          by {createdByMember?.username}
        </p>
      </header>
      <Tabs category="underlined" selectedIndex={selectedIndex}>
        <TabsList aria-label="Change Request">
          {tabs.map((tab, index) => (
            <TabsListNavLinkTab
              key={tab.splat}
              index={index}
              end
              to={`/orgs/${params.org_slug}/databases/${params.database_slug}/change-requests/${params.change_request_number}${tab.splat.length ? `/${tab.splat}` : tab.splat}`}
            >
              {tab.title}
              {tab.splat === "data-changes" ? (
                <>
                  {" "}
                  <Indicator intent="secondary" space="xs">
                    {loaderData.change_request.changes.length}
                  </Indicator>
                </>
              ) : undefined}
            </TabsListNavLinkTab>
          ))}
        </TabsList>
        {tabs.map((tab, index) => (
          <TabsPanel key={tab.splat} index={index} className="gap-4 py-4">
            {index === selectedIndex ? <Outlet /> : undefined}
          </TabsPanel>
        ))}
      </Tabs>
    </Article>
  );
}
