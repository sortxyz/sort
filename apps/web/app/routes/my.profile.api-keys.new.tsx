import { getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { IconKey } from "@tabler/icons-react";
import type { ActionFunctionArgs } from "react-router";
import { ActionForm } from "~/components/action-form";
import { Article } from "~/components/article";
import { Button, LinkButton } from "~/components/button";
import { ControlFieldTextarea } from "~/components/control-field";
import { FormError } from "~/components/form-error";
import { csrf } from "~/utils/csrf.server";
import { errorMessageToReplyOptions } from "~/utils/message";
import { dataFnMiddleware } from "~/utils/request.server";

import { mergeHeaders } from "@sort/sdk";
import { useRef } from "react";
import { useActionData } from "react-router";
import { z } from "zod";
import type { ClipboardTextState } from "~/hooks/use-clipboard-text";
import { useClipboardText } from "~/hooks/use-clipboard-text";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUserHeaders,
} from "~/services/auth.server";

const INTENTS = {
  create: "create",
} as const;

const schema = z.object({
  intent: z.literal(INTENTS.create),
  key: z.object({
    summary: z.string().min(1).max(256).optional().nullable().default(null),
  }),
});

export async function action({ request }: ActionFunctionArgs) {
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );
  const formData = await request.formData();
  await csrf.validate(formData, request.headers);

  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    return {
      lastResult: submission.reply(),
      result: null,
    };
  }

  switch (submission.value.intent) {
    case INTENTS.create: {
      const response = await dataFnMiddleware(
        request,
        client.v2.createAPIKey({
          body: submission.value.key,
          headers,
        }),
      );

      const message = await response.json();

      if (message.type !== "create_api_key") {
        return {
          lastResult: submission.reply(errorMessageToReplyOptions(message)),
          result: null,
        };
      }

      return {
        lastResult: submission.reply(),
        result: message.payload,
      };
    }
  }
}

function copyButtonText(state: ClipboardTextState["state"]) {
  switch (state) {
    case "loading":
      return "Copying...";
    case "resolved":
      return "Copied!";
    case "rejected":
      return "Failed to copy";
    default:
      return "Copy";
  }
}

export default function Route() {
  const actionData = useActionData<typeof action>();

  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    lastResult: actionData?.lastResult,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const labelFieldset = fields.key.getFieldset();

  const apiKeyRef = useRef<HTMLInputElement>(null);

  const [clipboardState, writeText] = useClipboardText(3000);

  return (
    <Article>
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:text-3xl md:font-bold">
          <IconKey className="stroke-1.5 size-6" aria-hidden />
          New API Key
        </h3>
      </header>
      {actionData?.result ? (
        <div>
          <div className="bg-green-300/10 p-4">
            <p className="pb-2 font-bold">
              Make sure to copy your new API Key now as you will not be able to
              see this again.
            </p>
            <div>
              <span className="pr-2">
                <input
                  className="w-full max-w-[600px] rounded-sm border bg-gray-100 px-3 py-1 opacity-50"
                  ref={apiKeyRef}
                  type="text"
                  placeholder="API Key"
                  aria-label="API Key"
                  readOnly
                  value={actionData.result.api_key.api_key}
                />
              </span>
              <span className="">
                <Button
                  onClick={() =>
                    void writeText(actionData.result.api_key.api_key)
                  }
                  type="button"
                  space="xs"
                  intent="secondary"
                >
                  {copyButtonText(clipboardState.state)}
                </Button>
              </span>
            </div>
          </div>
          <div className="pt-10">
            <LinkButton to="/my/profile/api-keys">View all keys</LinkButton>
          </div>
        </div>
      ) : (
        <ActionForm
          {...getFormProps(form, {
            ariaDescribedBy: form.valid ? undefined : form.errorId,
          })}
          className="flex flex-col gap-3"
        >
          <FormError errors={form.errors} id={form.errorId} />
          <ControlFieldTextarea
            label="API key summary"
            field={labelFieldset.summary}
          />
          <div>
            <Button
              name={fields.intent.name}
              value={INTENTS.create}
              type="submit"
              space="sm"
            >
              Create API Key
            </Button>
          </div>
        </ActionForm>
      )}
    </Article>
  );
}
