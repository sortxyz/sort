import type { FormMetadata } from "@conform-to/react";
import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { mergeHeaders } from "@sort/sdk";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  UIMatch,
} from "react-router";
import {
  Link,
  redirect,
  useActionData,
  useLocation,
  useNavigation,
} from "react-router";
import { z } from "zod";
import { ActionForm } from "~/components/action-form";
import { Article } from "~/components/article";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import { Button } from "~/components/button";
import { ControlInlineFieldInput } from "~/components/control-inline-field";
import { FormError } from "~/components/form-error";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUser,
  getRequiredUserHeaders,
} from "~/services/auth.server";
import {
  commitSession,
  getSession,
  sessionKey,
} from "~/services/session.server";
import { validateCsrf } from "~/utils/csrf.server";
import { setFlashHeaders } from "~/utils/flash";
import {
  errorMessageToReplyOptions,
  generalErrorMessage,
} from "~/utils/message";
import { dataFnMiddleware } from "~/utils/request.server";

const INTENTS = {
  confirm: "confirm",
} as const;

const schema = z.object({
  intent: z.literal(INTENTS.confirm),
  subscribe: z.boolean().optional(),
  key: z.string(),
});

export async function loader({ request }: LoaderFunctionArgs) {
  await getRequiredUser(request);
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await getRequiredUser(request);
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
    case INTENTS.confirm: {
      const response = await dataFnMiddleware(
        request,
        client.v2.verifyEmail({
          body: {
            subscribe: !!submission.value.subscribe,
            key: submission.value.key,
          },
          headers,
        }),
      );

      const message = await response.json();

      if (message.type !== "success") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      const session = await getSession(request.headers.get("Cookie"));
      user.sortProfile.email_verified = true;
      session.set(sessionKey, user);
      const cookie = await commitSession(session);
      const cookieHeaders = new Headers({ "Set-Cookie": cookie });

      throw redirect("/my/profile", {
        headers: mergeHeaders(
          cookieHeaders,
          await setFlashHeaders({
            type: "success",
            message: "You have successfully confirmed your email address.",
          }),
        ),
      });
    }
    default: {
      return submission.reply(errorMessageToReplyOptions(generalErrorMessage));
    }
  }
}

export const handle = {
  breadcrumb(match: UIMatch) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        Confirm Email
      </BreadcrumbNavLink>
    );
  },
};

function FormErrors({
  form,
}: {
  form: FormMetadata<
    {
      key: string;
      intent: "confirm";
      subscribe?: boolean | undefined;
    },
    string[]
  >;
}) {
  if (form.errors?.some((error) => /expired/.test(error))) {
    return (
      <p>
        <span className="text-red-600">This email link expired. </span>
        <Link className="text-blue-500 underline" to="/my/profile">
          Please re-send a new email
        </Link>
        .
      </p>
    );
  }
  if (form.errors?.some((error) => /Invalid key/i.test(error))) {
    return (
      <p>
        <span className="text-red-600">This email link is invalid. </span>
        <Link className="text-blue-500 underline" to="/my/profile">
          Please re-send a new email
        </Link>
        .
      </p>
    );
  }
  return <FormError errors={form.errors} id={form.errorId} />;
}

export default function Route() {
  const location = useLocation();
  const navigation = useNavigation();
  const lastResult = useActionData<typeof action>();

  const [form, fields] = useForm({
    lastResult: navigation.state === "idle" ? lastResult : undefined,
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const key = new URLSearchParams(location.search).get("key") ?? "";

  return (
    <Article>
      <header>
        <h3 className="text-xl font-semibold text-gray-900 md:text-3xl md:font-bold">
          Confirm your Email
        </h3>
      </header>
      <ActionForm
        {...getFormProps(form, {
          ariaDescribedBy: form.valid ? undefined : form.errorId,
        })}
      >
        <p>
          Finish confirming your email address by clicking the &ldquo;Confirm
          your Email&rdquo; button below.
        </p>
        <div className="py-5">
          <ControlInlineFieldInput
            field={fields.subscribe}
            label="Keep me up to date with Sort promotions and product releases"
            type="checkbox"
          />
        </div>
        <input
          {...getInputProps(fields.key, {
            type: "hidden",
          })}
          aria-label="key"
          readOnly
          value={key}
        />
        {!form.errors ? (
          <div className="pt-1">
            <Button
              type="submit"
              name={fields.intent.name}
              value={INTENTS.confirm}
              space="sm"
            >
              Confirm your Email
            </Button>
          </div>
        ) : undefined}
        <FormErrors form={form} />
      </ActionForm>
    </Article>
  );
}
