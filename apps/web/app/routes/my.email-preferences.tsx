import {
  IconChevronLeft,
  IconLock,
  IconMail,
  IconSettings,
} from "@tabler/icons-react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaDescriptor,
} from "react-router";
import {
  data,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
  useRouteLoaderData,
} from "react-router";
import { z } from "zod";
import { ActionForm } from "~/components/action-form";
import { Article } from "~/components/article";
import {
  GlobalSidebarMenu,
  GlobalSidebarMenuNavLinkItem,
} from "~/components/global-sidebar";
import type { loader as rootLoader } from "~/root";
import { dataFnMiddleware } from "~/utils/request.server";

import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { mergeHeaders } from "@sort/sdk";
import { Button } from "~/components/button";
import { ControlInlineFieldInput } from "~/components/control-inline-field";
import { FormError } from "~/components/form-error";
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
import { extractMessageOrThrow } from "~/utils/response";

export function meta() {
  return [
    {
      title: "Email Preferences",
    },
  ] satisfies MetaDescriptor[];
}

function Menu() {
  return (
    <GlobalSidebarMenu>
      <GlobalSidebarMenuNavLinkItem
        end
        iconLeft={<IconChevronLeft className="stroke-1.5 size-6" />}
        title="My Organizations"
        to="/my/orgs"
      >
        My Organizations
      </GlobalSidebarMenuNavLinkItem>
      <GlobalSidebarMenuNavLinkItem
        title="Account Settings"
        iconLeft={<IconSettings className="stroke-1.5 size-6" />}
        end
        to="/my/profile"
      >
        Account Settings
      </GlobalSidebarMenuNavLinkItem>
      <GlobalSidebarMenuNavLinkItem
        key="api-keys"
        title="API Keys"
        iconLeft={<IconLock className="stroke-1.5 size-6" />}
        end
        to="/my/profile/api-keys"
      >
        API Keys
      </GlobalSidebarMenuNavLinkItem>
      <GlobalSidebarMenuNavLinkItem
        key="email-preferences"
        title="Email preferences"
        iconLeft={<IconMail className="stroke-1.5 size-6" />}
        end
        to="/my/email-preferences"
      >
        Email Preferences
      </GlobalSidebarMenuNavLinkItem>
    </GlobalSidebarMenu>
  );
}

export const handle = {
  menu: <Menu />,
};

const INTENTS = {
  save: "save",
} as const;

const schema = z.object({
  intent: z.literal(INTENTS.save),
  subscriptions: z.array(
    z.object({
      email: z.string(),
      name: z.string(),
      subscribed: z.boolean().optional().default(false),
    }),
  ),
});

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );

  const {
    payload: { subscriptions },
  } = await dataFnMiddleware(
    request,
    client.v2.listEmailSubscriptions({
      headers,
    }),
  ).then(extractMessageOrThrow("list_email_subscriptions"));

  return { subscriptions };
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  await validateCsrf(formData, request.headers);
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );

  switch (submission.value.intent) {
    case INTENTS.save: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateEmailSubscriptions({
          body: {
            subscriptions: submission.value.subscriptions,
          },
          headers,
        }),
      );

      const message = await response.json();

      if (message.type !== "update_email_subscriptions") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply(), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Email subscriptions updated successfully",
        }),
      });
    }

    default: {
      return submission.reply(errorMessageToReplyOptions(generalErrorMessage));
    }
  }
}

export default function Route() {
  const navigation = useNavigation();
  const rootLoaderData = useRouteLoaderData<typeof rootLoader>("root");
  const loaderData = useLoaderData<typeof loader>();
  const lastResult = useActionData<typeof action>();

  const [form, fields] = useForm({
    lastResult: navigation.state === "idle" ? lastResult : undefined,
    constraint: getZodConstraint(schema),
    defaultValue: { intent: "save", subscriptions: loaderData.subscriptions },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const subscriptions = fields.subscriptions.getFieldList();

  return (
    <Article>
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:text-3xl md:font-bold">
          <IconMail className="stroke-1.5 size-6" aria-hidden />
          Email Preferences
        </h3>
      </header>
      <div>
        {rootLoaderData?.sortProfile?.email_verified ? (
          <ActionForm
            {...getFormProps(form, {
              ariaDescribedBy: form.valid ? undefined : form.errorId,
            })}
          >
            <p>
              Manage your email preferences by selecting the notifications you
              would like to receive.
            </p>
            <FormError errors={form.errors} id={form.errorId} />
            <ul className="mt-4 rounded-sm border p-4">
              {subscriptions.length === 0 ? (
                <li>
                  <span>No available subscriptions</span>
                </li>
              ) : undefined}
              {subscriptions.map((subscription) => {
                const sub = subscription.getFieldset();
                return (
                  <li key={subscription.key}>
                    <span className="inline-block w-40 pr-3 capitalize">
                      {sub.name.value}
                    </span>
                    <ControlInlineFieldInput
                      field={sub.subscribed}
                      label="Subscribed"
                      type="checkbox"
                    />
                    <input
                      {...getInputProps(sub.name, {
                        type: "hidden",
                      })}
                    />
                    <input
                      {...getInputProps(sub.email, {
                        type: "hidden",
                      })}
                    />
                  </li>
                );
              })}
            </ul>
            <div className="pt-4">
              {subscriptions.length === 0 ? undefined : (
                <Button
                  type="submit"
                  name={fields.intent.name}
                  value={INTENTS.save}
                  space="sm"
                >
                  Save
                </Button>
              )}
            </div>
          </ActionForm>
        ) : (
          <p>
            Your email address is not yet verified.{" "}
            <Link className="text-blue-500 underline" to="/my/profile">
              Please verify your email address
            </Link>{" "}
            to receive notifications.
          </p>
        )}
      </div>
    </Article>
  );
}
