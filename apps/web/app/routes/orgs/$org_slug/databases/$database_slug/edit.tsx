import { getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { mergeHeaders } from "@sort/sdk";
import { IconSettings } from "@tabler/icons-react";
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
  useParams,
} from "react-router";
import { z } from "zod";
import { ActionForm } from "~/components/action-form";
import { Article } from "~/components/article";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import { Button, LinkButton } from "~/components/button";
import {
  ControlFieldInput,
  ControlFieldTextarea,
} from "~/components/control-field";
import { ControlMarkdownFieldTextarea } from "~/components/control-markdown-field";
import { Field, FieldInput, FieldLabel } from "~/components/field";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUserHeaders,
} from "~/services/auth.server";
import { validateCsrf } from "~/utils/csrf.server";
import { setFlashHeaders } from "~/utils/flash";
import {
  errorMessageToReplyOptions,
  generalErrorMessage,
} from "~/utils/message";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export function meta() {
  return [
    {
      title: "Edit Database",
    },
  ] satisfies MetaDescriptor[];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );
  const [
    {
      payload: { organization },
    },
    {
      payload: { database },
    },
  ] = await Promise.all([
    dataFnMiddleware(
      request,
      client.v2.getOrganization({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("get_organization")),
    dataFnMiddleware(
      request,
      client.v2.getDatabase({
        headers,
        params,
      }),
    ).then(extractMessageOrThrow("get_database")),
  ]);

  return { organization, database };
}

const INTENTS = {
  update: "update",
} as const;

const schema = z.object({
  intent: z.literal(INTENTS.update),
  database: z.object({
    display_name: z.string().min(1),
    summary: z.string().min(1).nullable().default(null),
    description: z.string().min(1).nullable().default(null),
  }),
});

export async function action({ request, params }: ActionFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );
  const formData = await request.formData();
  await validateCsrf(formData, request.headers);
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    return submission.reply();
  }

  switch (submission.value.intent) {
    case INTENTS.update: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateDatabase({
          body: submission.value.database,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "update_database") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirect(
        `/orgs/${params.org_slug}/databases/${params.database_slug}`,
        {
          headers: await setFlashHeaders({
            type: "success",
            message: "Database updated successfully",
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

  const canViewSettings =
    !!loaderData.organization.permissions?.view_database_settings?.value;

  const params = useParams();

  const [form, fields] = useForm({
    lastResult: navigation.state === "idle" ? lastResult : undefined,
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue: {
      database: loaderData.database,
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const databaseFieldset = fields.database.getFieldset();

  return (
    <Article>
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
          <IconSettings className="stroke-1.5 size-6" aria-hidden />
          Database Settings
        </h3>
        <LinkButton
          space="sm"
          to={`/orgs/${params.org_slug}/databases/${params.database_slug}`}
          intent="secondary"
        >
          View Database
        </LinkButton>
      </header>
      <div>Settings</div>

      {canViewSettings ? (
        <ActionForm
          {...getFormProps(form, {
            ariaDescribedBy: form.valid ? undefined : form.errorId,
          })}
          className="flex flex-col gap-3 md:gap-6"
        >
          <Field label={<FieldLabel>Name</FieldLabel>}>
            <FieldInput
              type="text"
              defaultValue={loaderData.database.raw_name}
              disabled
            />
          </Field>

          <ControlFieldInput
            field={databaseFieldset.display_name}
            label="Display Name"
            type="text"
          />

          <ControlFieldTextarea
            field={databaseFieldset.summary}
            label="Brief Summary"
            rows={2}
            helperText={<p>Displayed on the database listing page</p>}
          />

          <ControlMarkdownFieldTextarea
            field={databaseFieldset.description}
            label="Description"
            rows={19}
          />

          <div className="float-right mt-5 flex gap-2 py-2">
            <div className="flex py-2">
              <Button
                space="sm"
                type="submit"
                name={fields.intent.name}
                value={INTENTS.update}
              >
                Update Database
              </Button>
            </div>
          </div>
        </ActionForm>
      ) : undefined}
    </Article>
  );
}

export const handle = {
  breadcrumb(match: UIMatch) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        Database Settings
      </BreadcrumbNavLink>
    );
  },
};
