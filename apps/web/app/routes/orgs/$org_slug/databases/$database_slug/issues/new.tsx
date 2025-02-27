import {
  getCollectionProps,
  getFieldsetProps,
  getFormProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { mergeHeaders } from "@sort/sdk";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaDescriptor,
  UIMatch,
} from "react-router";
import {
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { z } from "zod";
import { ActionForm } from "~/components/action-form";
import { Article } from "~/components/article";
import { Avatar } from "~/components/avatar";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import { Button } from "~/components/button";
import { ControlFieldInput } from "~/components/control-field";
import { ControlMarkdownFieldTextarea } from "~/components/control-markdown-field";
import { FormError } from "~/components/form-error";
import {
  InlineField,
  InlineFieldInput,
  InlineFieldLabel,
} from "~/components/inline-field";
import { Tag } from "~/components/tag";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUserHeaders,
} from "~/services/auth.server";
import { getTextColor } from "~/utils/color";
import { csrf } from "~/utils/csrf.server";
import { setFlashHeaders } from "~/utils/flash";
import {
  errorMessageToReplyOptions,
  generalErrorMessage,
} from "~/utils/message";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export function meta() {
  return [{ title: "Create New Issue" }] satisfies MetaDescriptor[];
}

export const handle = {
  breadcrumb(match: UIMatch) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        New
      </BreadcrumbNavLink>
    );
  },
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug"]);

  const url = new URL(request.url);
  const title = url.searchParams.get("title") ?? "";
  const description = url.searchParams.get("description") ?? "";

  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );

  const [
    {
      payload: { labels },
    },
    {
      payload: { members },
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
      client.v2.listOrganizationMembers({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("list_organization_members")),
  ]);

  return { labels, members, title, description };
}

const INTENTS = {
  create: "create",
} as const;

const schema = z.object({
  intent: z.literal(INTENTS.create),
  issue: z.object({
    title: z.string().min(1),
    description: z.string().min(1).nullable().default(null),
    labels: z.array(z.string().min(1)),
    assignees: z.array(z.string().min(1)),
  }),
});

export async function action({ request, params }: ActionFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug"]);
  const formData = await request.formData();
  await csrf.validate(formData, request.headers);

  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    return submission.reply();
  }
  switch (submission.value.intent) {
    case INTENTS.create: {
      const response = await dataFnMiddleware(
        request,
        client.v2.createIssue({
          body: submission.value.issue,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "create_issue") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirect(
        `/orgs/${params.org_slug}/databases/${params.database_slug}/issues/${message.payload.issue.issue_number}`,
        {
          headers: await setFlashHeaders({
            type: "success",
            message: `Successfully created issue #${message.payload.issue.issue_number}`,
          }),
        },
      );
    }
    default: {
      return submission.reply(errorMessageToReplyOptions(generalErrorMessage));
    }
  }
}

export default function Route() {
  const loaderData = useLoaderData<typeof loader>();
  const lastResult = useActionData<typeof action>();
  const navigation = useNavigation();

  const [searchParams] = useSearchParams();

  const [form, fields] = useForm({
    lastResult: navigation.state === "idle" ? lastResult : undefined,
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue: {
      intent: INTENTS.create,
      issue: {
        title: loaderData.title,
        description: loaderData.description,
        labels: [],
        assignees: [],
      },
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const issueFieldset = fields.issue.getFieldset();
  const issueLabelsProps = getCollectionProps(issueFieldset.labels, {
    type: "checkbox",
    options: loaderData.labels.map((label) => label.id),
  });
  const issueAssigneesProps = getCollectionProps(issueFieldset.assignees, {
    type: "checkbox",
    options: loaderData.members.map((member) => member.user.id),
  });

  return (
    <Article>
      <h2 className="text-3xl font-medium">Create a new Issue</h2>
      <div>
        <ActionForm
          {...getFormProps(form, {
            ariaDescribedBy: form.valid ? undefined : form.errorId,
          })}
          className="flex flex-col gap-3 md:gap-6"
        >
          {searchParams.has("deleteModal") ? undefined : (
            <FormError errors={form.errors} id={form.errorId} />
          )}
          <ControlFieldInput
            field={issueFieldset.title}
            label="Title"
            type="text"
            autoComplete="off"
          />

          <ControlMarkdownFieldTextarea
            field={issueFieldset.description}
            label="Description"
            rows={10}
          />

          <fieldset
            {...getFieldsetProps(issueFieldset.labels)}
            className="flex flex-col gap-1"
          >
            <legend>Labels</legend>
            {loaderData.labels.map((label, index) => {
              const props =
                issueLabelsProps[index] ??
                ({} as (typeof issueLabelsProps)[number]);
              return (
                <InlineField
                  key={label.id}
                  label={
                    <InlineFieldLabel htmlFor={props.id}>
                      <div
                        className="inline-flex rounded-sm border border-gray-200 px-2 py-1"
                        style={{
                          backgroundColor: label.color,
                          color: getTextColor(label.color),
                        }}
                      >
                        {label.name}
                      </div>
                    </InlineFieldLabel>
                  }
                  fullWidth
                >
                  <InlineFieldInput {...props} />
                </InlineField>
              );
            })}
          </fieldset>

          <fieldset
            {...getFieldsetProps(issueFieldset.assignees)}
            className="flex flex-col gap-1"
          >
            <legend>Assignees</legend>
            {loaderData.members.map((member, index) => {
              const props =
                issueAssigneesProps[index] ??
                ({} as (typeof issueAssigneesProps)[number]);

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
                  fullWidth
                >
                  <InlineFieldInput {...props} />
                </InlineField>
              );
            })}
          </fieldset>

          <div className="flex pt-2">
            <Button
              space="sm"
              type="submit"
              name={fields.intent.name}
              value={INTENTS.create}
            >
              Submit new issue
            </Button>
          </div>
        </ActionForm>
      </div>
    </Article>
  );
}
