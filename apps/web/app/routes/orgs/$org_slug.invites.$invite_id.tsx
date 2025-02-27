import { getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { mergeHeaders } from "@sort/sdk";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  UIMatch,
} from "react-router";
import { redirect, useLoaderData } from "react-router";
import { z } from "zod";
import { ActionForm } from "~/components/action-form";
import { Article } from "~/components/article";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import { AnchorButton, Button } from "~/components/button";
import { FormError } from "~/components/form-error";
import {
  DefaultGenericStatusHandler,
  GeneralErrorBoundary,
} from "~/components/general-error-boundary";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUser,
  getRequiredUserHeaders,
} from "~/services/auth.server";
import { validateCsrf } from "~/utils/csrf.server";
import { setFlashHeaders } from "~/utils/flash";
import {
  errorMessageToReplyOptions,
  generalErrorMessage,
} from "~/utils/message";
import { dataFnMiddleware } from "~/utils/request.server";
import {
  assertResponse,
  assertResponseParams,
  extractMessageOrThrow,
} from "~/utils/response";

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug", "invite_id"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );
  const { sortProfile } = await getRequiredUser(request);

  assertResponse(sortProfile.email, "Something went wrong. Please try again.", {
    status: 500,
  });

  const {
    payload: { organization, organization_invite },
  } = await dataFnMiddleware(
    request,
    client.v2.getOrganizationInvite({
      headers,
      params,
      searchParams: new URLSearchParams({ email: sortProfile.email }),
    }),
  ).then(extractMessageOrThrow("get_organization_invite"));

  return {
    organization,
    organization_invite,
  };
}

const INTENTS = {
  update: "update",
} as const;

const schema = z.object({
  intent: z.literal(INTENTS.update),
});

export async function action({ request, params }: ActionFunctionArgs) {
  assertResponseParams(params, ["org_slug", "invite_id"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );
  const { sortProfile } = await getRequiredUser(request);
  const formData = await request.formData();
  await validateCsrf(formData, request.headers);

  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    return submission.reply();
  }

  switch (submission.value.intent) {
    case INTENTS.update: {
      if (!sortProfile.email) {
        return submission.reply({
          formErrors: ["Something went wrong. Please try again"],
        });
      }

      const response = await dataFnMiddleware(
        request,
        client.v2.updateOrganizationInvite({
          body: {
            email: sortProfile.email,
            status: "accepted",
          },
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "success") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirect(`/orgs/${params.org_slug}`, {
        headers: await setFlashHeaders({
          type: "success",
          message: "Invite accepted",
        }),
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
        Accept Invite
      </BreadcrumbNavLink>
    );
  },
};

export default function Route() {
  const loaderData = useLoaderData<typeof loader>();
  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  return (
    <Article>
      <div className="flex flex-col gap-3 rounded-md bg-gray-100 p-4">
        <h2 className="font-semibold md:text-xl">
          Good news! You&apos;ve been invited to join the &quot;
          {loaderData.organization.name}&quot; organization on Sort.
        </h2>
        <p>To accept your invite, please click the button below.</p>
        <ActionForm
          {...getFormProps(form, {
            ariaDescribedBy: form.valid ? undefined : form.errorId,
          })}
        >
          <FormError errors={form.errors} id={form.errorId} />
          <Button
            type="submit"
            name={fields.intent.name}
            value={INTENTS.update}
            space="sm"
          >
            Accept invite
          </Button>
        </ActionForm>
        <p className="text-xs text-gray-700">
          If you do not wish to join the &quot;{loaderData.organization.name}
          &quot; organization, no further action is necessary.
        </p>
      </div>
    </Article>
  );
}

export function ErrorBoundary() {
  return (
    <GeneralErrorBoundary
      statusHandlers={{
        404: ({ error, params }) => (
          <>
            <DefaultGenericStatusHandler error={error} params={params} />
            <p className="my-2">Hmm, that Invite does not exist.</p>
            <p className="my-2">
              Please check your invite email and try again. If you continue to
              have trouble, please contact the person who invited you.
            </p>
            <AnchorButton href="/" intent="secondary">
              Return Home
            </AnchorButton>
          </>
        ),
      }}
    />
  );
}
