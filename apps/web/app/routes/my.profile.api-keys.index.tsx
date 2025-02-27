import { IconKey } from "@tabler/icons-react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, data } from "react-router";
import { Article } from "~/components/article";
import { Button, LinkButton } from "~/components/button";
import { ControlFieldTextarea } from "~/components/control-field";
import { dataFnMiddleware } from "~/utils/request.server";

import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import type { V2 } from "@sort/sdk";
import { mergeHeaders } from "@sort/sdk";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { z } from "zod";
import { FormError } from "~/components/form-error";
import { Spinner } from "~/components/spinner";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUserHeaders,
} from "~/services/auth.server";
import { csrf } from "~/utils/csrf.server";
import { setFlashHeaders } from "~/utils/flash";
import {
  errorMessageToReplyOptions,
  generalErrorMessage,
} from "~/utils/message";
import { extractMessageOrThrow } from "~/utils/response";

const INTENTS = {
  update: "update",
  delete: "delete",
} as const;

const schema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal(INTENTS.update),
    apiKey: z.object({
      id: z.string().min(1),
      summary: z.string().min(1).max(256).optional().nullable().default(null),
    }),
  }),
  z.object({
    intent: z.literal(INTENTS.delete),
    apiKey: z.object({
      id: z.string().min(1),
      summary: z.string().min(1).max(256).optional().nullable().default(null),
    }),
  }),
]);

export async function action({ request }: ActionFunctionArgs) {
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );
  const formData = await request.formData();
  await csrf.validate(formData, request.headers);
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    return submission.reply();
  }

  switch (submission.value.intent) {
    case INTENTS.update: {
      const { id, summary } = submission.value.apiKey;
      const response = await dataFnMiddleware(
        request,
        client.v2.updateAPIKey({
          body: { summary },
          headers,
          params: { id },
        }),
      );

      const message = await response.json();

      if (message.type !== "update_api_key") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Successfully updated API key",
        }),
      });
    }
    case "delete": {
      const { id } = submission.value.apiKey;
      const response = await dataFnMiddleware(
        request,
        client.v2.deleteAPIKey({
          params: { id },
          headers,
        }),
      );

      const message = await response.json();

      if (message.type !== "success") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Successfully deleted API key",
        }),
      });
    }
    default: {
      return submission.reply(errorMessageToReplyOptions(generalErrorMessage));
    }
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );

  const {
    payload: { api_keys },
  } = await dataFnMiddleware(
    request,
    client.v2.listApiKeys({
      headers,
    }),
  ).then(extractMessageOrThrow("list_api_keys"));

  const keys = api_keys.sort((a, b) => {
    if (a.created_at < b.created_at) {
      return 1;
    } else if (a.created_at > b.created_at) {
      return -1;
    } else {
      return 0;
    }
  });

  return { keys };
}

function ApiKeyForm({ apiKey }: { apiKey: V2.APIKey }) {
  const fetcher = useFetcher<typeof action>();

  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      const s = parseWithZod(formData, { schema });
      return s;
    },
    defaultValue: { apiKey },
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const fieldSet = fields.apiKey.getFieldset();

  return (
    <fetcher.Form method="POST" {...getFormProps(form)}>
      <AuthenticityTokenInput />
      <input
        {...getInputProps(fieldSet.id, {
          type: "hidden",
        })}
      />
      <div className="flex">
        <div className="flex w-full flex-wrap items-baseline gap-2">
          <div className="w-full rounded-sm border border-gray-200 p-4">
            <FormError errors={form.errors} id={form.errorId} />
            <div>
              <ControlFieldTextarea
                field={fieldSet.summary}
                label="Summary"
                fullWidth
                rows={1}
              />
            </div>
            <div className="flex w-full pt-2">
              <div className="flex gap-3 pt-2">
                <Button
                  space="xs"
                  name={fields.intent.name}
                  value={INTENTS.update}
                  type="submit"
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
                  Update
                </Button>
                <Button
                  space="xs"
                  intent="destructive"
                  name={fields.intent.name}
                  value={INTENTS.delete}
                  type="submit"
                  onClick={(event) => {
                    if (
                      !confirm(
                        "Are you sure you want to delete this API key? This action cannot be undone.",
                      )
                    ) {
                      event.preventDefault();
                    }
                  }}
                >
                  Delete
                </Button>
              </div>
              <em className="ml-auto text-xs text-slate-700">
                Created at {new Date(apiKey.created_at).toLocaleString()}
              </em>
            </div>
          </div>
        </div>
      </div>
    </fetcher.Form>
  );
}

export default function Route() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <Article>
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:text-3xl md:font-bold">
          <IconKey className="stroke-1.5 size-6" aria-hidden />
          API Keys
        </h3>
      </header>
      <div className="space-y-6 sm:space-y-4">
        <div className="flex">
          <div className="ml-auto">
            <LinkButton intent="secondary" to="/my/profile/api-keys/new">
              New API Key
            </LinkButton>
          </div>
        </div>
        {loaderData.keys.length
          ? loaderData.keys.map((api_key) => (
              <ApiKeyForm key={api_key.id} apiKey={api_key} />
            ))
          : undefined}
      </div>
    </Article>
  );
}
