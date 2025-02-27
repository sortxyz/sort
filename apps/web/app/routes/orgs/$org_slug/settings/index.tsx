import { getFormProps, useForm } from "@conform-to/react";
import {
  conformZodMessage,
  getZodConstraint,
  parseWithZod,
} from "@conform-to/zod";
import { mergeHeaders } from "@sort/sdk";
import { IconSettings, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaDescriptor,
} from "react-router";
import {
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useParams,
  useRouteLoaderData,
} from "react-router";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { z } from "zod";
import { ActionForm } from "~/components/action-form";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogDescription,
  AlertDialogTitle,
} from "~/components/alert-dialog";
import { Article } from "~/components/article";
import { Button, LinkButton } from "~/components/button";
import { ControlFieldInput } from "~/components/control-field";
import { ControlMarkdownFieldTextarea } from "~/components/control-markdown-field";
import { FormError } from "~/components/form-error";
import { Spinner } from "~/components/spinner";
import type { loader as rootLoader } from "~/root";
import type { loader as orgLoader } from "~/routes/orgs/$org_slug";
import { slugSchema } from "~/schemas/organization";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUserHeaders,
} from "~/services/auth.server";
import { reAuthCookie, returnToCookie } from "~/services/cookies.server";
import { getSession } from "~/services/session.server";
import { validateCsrf } from "~/utils/csrf.server";
import { serverEnv } from "~/utils/env.server";
import { setFlashHeaders } from "~/utils/flash";
import {
  errorMessageToReplyOptions,
  generalErrorMessage,
} from "~/utils/message";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams } from "~/utils/response";

export function meta() {
  return [{ title: "Settings" }] satisfies MetaDescriptor[];
}

const INTENTS = {
  update: "update",
  remove: "remove",
  reauth: "reauth",
} as const;

const createSchema = (options?: { isSlugEqual(slug: string): boolean }) =>
  z.discriminatedUnion("intent", [
    z.object({
      intent: z.literal(INTENTS.reauth),
    }),
    z.object({
      intent: z.literal(INTENTS.update),
      body: z.object({
        organization: z.object({
          name: z.string().min(2),
          link: z.string().url().optional().nullable().default(null),
          description: z.string().min(1).nullable().default(null),
          banner: z.string().min(1).nullable().default(null),
          discord_webhook_url: z
            .string()
            .url()
            .optional()
            .nullable()
            .default(null),
          slack_webhook_url: z
            .string()
            .url()
            .optional()
            .nullable()
            .default(null),
          slug: slugSchema,
        }),
      }),
    }),
    z.object({
      intent: z.literal(INTENTS.remove),
      body: z.object({
        slugConfirmation: slugSchema.superRefine((value, ctx) => {
          if (options?.isSlugEqual === undefined) {
            return ctx.addIssue({
              code: "custom",
              message: conformZodMessage.VALIDATION_UNDEFINED,
              fatal: true,
            });
          }

          if (!options.isSlugEqual(value)) {
            return ctx.addIssue({
              code: "custom",
              message: "Slug does not match",
            });
          }
        }),
      }),
    }),
  ]);

const isDeleteable = async ({
  request,
  params,
}: Pick<LoaderFunctionArgs, "request" | "params">) => {
  const cookie = request.headers.get("Cookie");
  const reAuth = (await reAuthCookie.parse(cookie)) as null | {
    deleteOrg: { slug: string };
  };
  const isDeleteFlow = reAuth?.deleteOrg;

  if (!isDeleteFlow) {
    return {
      success: false,
      message: "You must re-authenticate before deleting the organization.",
    };
  }

  const session = await getSession(cookie);
  const user = session.get("user");

  const isReAuthMatch = reAuth?.deleteOrg?.slug === params.org_slug;

  if (isReAuthMatch) {
    const now = Date.now();
    const authTime = Number(user?.auth_time) * 1000;
    if (authTime > now - 60_000) {
      return {
        success: true,
        message: "Success",
      };
    } else {
      return {
        success: false,
        message:
          "It has been more than 60 seconds since you authenticated. Please re-authenticate.",
      };
    }
  } else {
    return {
      success: false,
      message: "Hmm.. something went wrong. Please re-authenticate.",
    };
  }
};

export async function loader({ request, params }: LoaderFunctionArgs) {
  const isDeleteableResult = await isDeleteable({ request, params });
  return { isDeleting: isDeleteableResult.success };
}

export async function action({ request, params }: ActionFunctionArgs) {
  assertResponseParams(params, ["org_slug"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );
  const formData = await request.formData();
  await validateCsrf(formData, request.headers);
  const submission = parseWithZod(formData, {
    schema: createSchema({
      isSlugEqual(slug) {
        return slug === params.org_slug;
      },
    }),
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  switch (submission.value.intent) {
    case INTENTS.reauth: {
      /**
       * SRT-001: Require the user to re-authenticate before deleting the Org.
       * We must include ?prompt=login in the querystring e.g. /api/auth/login?prompt=login
       * to cause Auth0 to return the auth_time parameter which is required to confirm
       * the customer logged-in within the past 60 seconds.
       * https://auth0.com/docs/authenticate/login/max-age-reauthentication
       *
       * The flow:
       * 1. User clicks "Remove Organization"
       * 2. Inform them they must first re-authenticate
       * 3. Customer re-authenticates
       * 4. When they return from re-authentication, confirm the `auth_time` is beneath the threshold
       * 5. If checks pass, allow org deletion
       */
      const cookieHeaders = new Headers();

      const cookieReAuth = await reAuthCookie.serialize({
        deleteOrg: {
          slug: params.org_slug,
        },
      });
      cookieHeaders.append("Set-Cookie", cookieReAuth);

      const curURL = new URL(request.url);
      const returnToAfterLogin = `${curURL.pathname}${curURL.search}`;
      const cookieReturnTo = await returnToCookie.serialize(returnToAfterLogin);
      cookieHeaders.append("Set-Cookie", cookieReturnTo);

      const url = new URL("/api/auth/login", new URL(request.url).origin);
      url.search = new URLSearchParams({
        prompt: "login", // force the user to re-login
        returnTo: request.url,
      }).toString();

      throw redirect(url.toString(), {
        headers: mergeHeaders(cookieHeaders, {
          "Set-Cookie": `oauth2=; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT${
            serverEnv.NODE_ENV === "production" ? "; Secure" : ""
          }`,
        }),
      });
    }
    case INTENTS.remove: {
      const isDeleteableResult = await isDeleteable({ request, params });
      if (!isDeleteableResult.success) {
        return submission.reply({ formErrors: [isDeleteableResult.message] });
      }

      const response = await dataFnMiddleware(
        request,
        client.v2.removeOrganization({
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "success") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirect("/my/orgs", {
        headers: await setFlashHeaders({
          type: "success",
          message: "Organization removed successfully",
        }),
      });
    }
    case INTENTS.update: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateOrganization({
          body: submission.value.body.organization,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "update_organization") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      const slug = submission.value.body.organization.slug;

      throw redirect(`/orgs/${slug}`, {
        headers: await setFlashHeaders({
          type: "success",
          message: "Organization updated successfully",
        }),
      });
    }
    default: {
      return submission.reply(errorMessageToReplyOptions(generalErrorMessage));
    }
  }
}

export function RemoveOrganizationForm({ onFinish }: { onFinish: () => void }) {
  const fetcher = useFetcher<typeof action>();
  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data &&
      fetcher.data.status !== "error"
    ) {
      onFinish();
    }
  }, [fetcher.state, fetcher.data, onFinish]);
  const [form, fields] = useForm({
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    constraint: getZodConstraint(createSchema()),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createSchema() });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  const bodyFieldset = fields.body.getFieldset();

  return (
    <fetcher.Form
      {...getFormProps(form, {
        ariaDescribedBy: form.valid ? undefined : form.errorId,
      })}
      method="POST"
      className="flex flex-col gap-3 md:gap-6"
    >
      <AuthenticityTokenInput />
      <FormError errors={form.errors} id={form.errorId} />
      <ControlFieldInput
        autoCapitalize="none"
        autoComplete="off"
        field={bodyFieldset.slugConfirmation}
        fullWidth
        label="Slug"
        type="text"
      />
      <Button
        type="submit"
        name={fields.intent.name}
        value={INTENTS.remove}
        space="sm"
        intent="destructive"
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
        Remove Organization
      </Button>
    </fetcher.Form>
  );
}

export function ReAuthForm({ onFinish }: { onFinish: () => void }) {
  const fetcher = useFetcher<typeof action>();
  useEffect(() => {
    if (
      fetcher.state === "idle" &&
      fetcher.data &&
      fetcher.data.status !== "error"
    ) {
      onFinish();
    }
  }, [fetcher.state, fetcher.data, onFinish]);
  const [form, fields] = useForm({
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    constraint: getZodConstraint(createSchema()),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createSchema() });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  return (
    <fetcher.Form
      {...getFormProps(form, {
        ariaDescribedBy: form.valid ? undefined : form.errorId,
      })}
      method="POST"
      className="flex flex-col gap-3 md:gap-6"
    >
      <AuthenticityTokenInput />
      <FormError errors={form.errors} id={form.errorId} />
      <Button
        type="submit"
        name={fields.intent.name}
        value={INTENTS.reauth}
        space="sm"
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
        Continue
      </Button>
    </fetcher.Form>
  );
}

export default function Route() {
  const orgLoaderData = useRouteLoaderData<typeof orgLoader>(
    "routes/orgs/$org_slug",
  );
  const rootLoaderData = useRouteLoaderData<typeof rootLoader>("root");
  const sortProfile = rootLoaderData?.sortProfile;
  const loaderData = useLoaderData<typeof loader>();
  const lastResult = useActionData<typeof action>();
  const navigation = useNavigation();
  const [openReAuthenticate, setOpenReAuthenticate] = useState(false);
  const [openRemoveOrganization, setOpenRemoveOrganization] = useState(
    loaderData.isDeleting,
  );
  const canViewSettings =
    !!orgLoaderData?.organization.permissions?.view_settings?.value;

  const handleCloseReAuthenticate = useCallback(
    () => setOpenReAuthenticate(false),
    [],
  );
  const handleFinishReAuth = useCallback(
    () => setOpenReAuthenticate(false),
    [],
  );
  const handleCloseRemoveOrganization = useCallback(
    () => setOpenRemoveOrganization(false),
    [],
  );
  const handleFinishRemoveOrganization = useCallback(
    () => setOpenRemoveOrganization(false),
    [],
  );

  const params = useParams();
  const [form, fields] = useForm({
    lastResult: navigation.state === "idle" ? lastResult : undefined,
    constraint: getZodConstraint(createSchema()),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: createSchema() });
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    defaultValue: {
      body: {
        organization: orgLoaderData?.organization,
      },
    },
  });

  const bodyFieldset = fields.body.getFieldset();
  const bodyOrganizationFieldset = bodyFieldset.organization.getFieldset();

  return (
    <Article>
      <header className="flex items-start justify-between">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
          <IconSettings className="stroke-1.5 size-6" aria-hidden />
          Organization Settings
        </h3>
        <LinkButton
          space="sm"
          to={`/orgs/${params.org_slug}/settings/connections`}
          intent="secondary"
        >
          Connections
        </LinkButton>
      </header>
      {canViewSettings ? (
        <div>
          <ActionForm
            {...getFormProps(form, {
              ariaDescribedBy: form.valid ? undefined : form.errorId,
            })}
            className="flex flex-col gap-3 md:gap-6"
          >
            <FormError errors={form.errors} id={form.errorId} />
            <ControlFieldInput
              field={bodyOrganizationFieldset.name}
              label="Name"
              type="text"
              helperText={<p>The public name of your organization on Sort</p>}
            />
            <ControlFieldInput
              autoCapitalize="none"
              autoComplete="off"
              field={bodyOrganizationFieldset.slug}
              helperText={
                <p>
                  Your public organization url will be: https://sort.xyz/orgs/
                  {bodyOrganizationFieldset.slug.value
                    ? bodyOrganizationFieldset.slug.value
                    : undefined}
                </p>
              }
              label="Slug"
              type="text"
            />
            <ControlFieldInput
              autoCapitalize="none"
              field={bodyOrganizationFieldset.link}
              label="Link"
              type="url"
              placeholder="https://example.com"
              helperText={
                <p>
                  Add an optional link for your organization documentation or
                  website.
                </p>
              }
            />
            <ControlMarkdownFieldTextarea
              field={bodyOrganizationFieldset.description}
              label="Description"
              rows={19}
            />
            <ControlMarkdownFieldTextarea
              autoCapitalize="none"
              autoComplete="off"
              field={bodyOrganizationFieldset.banner}
              label="Banner"
              rows={2}
              placeholder="Announcing ..."
              helperText={
                <p>Add an optional banner to your Organization dashboard.</p>
              }
            />
            <ControlFieldInput
              autoCapitalize="none"
              field={bodyOrganizationFieldset.discord_webhook_url}
              type="url"
              label="Discord Webhook URL"
              placeholder="https://discord.com/api/webhooks/..."
              helperText={
                <p>
                  Add an optional Discord webhook to which organization
                  notifications will be sent.
                </p>
              }
            />
            <ControlFieldInput
              autoCapitalize="none"
              field={bodyOrganizationFieldset.slack_webhook_url}
              type="url"
              label="Slack Webhook URL"
              placeholder="https://hooks.slack.com/services/..."
              helperText={
                <p>
                  Add an optional Slack webhook to which organization
                  notifications will be sent.
                </p>
              }
            />
            <div className="flex flex-col items-start gap-2 md:flex-row">
              <Button
                type="submit"
                name={fields.intent.name}
                value={INTENTS.update}
                space="sm"
                iconRight={
                  navigation.state === "submitting" &&
                  navigation.formData?.get("intent") === INTENTS.update ? (
                    <Spinner
                      aria-label="Loading..."
                      className="size-4 animate-spin"
                      role="status"
                    />
                  ) : undefined
                }
              >
                Update Organization
              </Button>
              <Button
                type="button"
                intent="secondary"
                space="sm"
                onClick={() => setOpenReAuthenticate(true)}
              >
                Remove Organization
              </Button>
            </div>
          </ActionForm>

          <AlertDialog
            open={openReAuthenticate}
            onClose={handleCloseReAuthenticate}
          >
            <AlertDialogCloseButton aria-label="Close">
              <IconX className="stroke-1.5 size-5" />
            </AlertDialogCloseButton>

            <AlertDialogTitle>Re-authenticate account</AlertDialogTitle>
            <AlertDialogDescription>
              <p>
                For your security, you must first confirm ownership of your
                account (<strong>{sortProfile?.email}</strong>) before removing
                this Organization.
              </p>
              <p className="py-4">
                Please click Continue to re-authenticate your account.
              </p>
            </AlertDialogDescription>

            <ReAuthForm onFinish={handleFinishReAuth} />
          </AlertDialog>

          <AlertDialog
            open={openRemoveOrganization}
            onClose={handleCloseRemoveOrganization}
          >
            <AlertDialogCloseButton aria-label="Close">
              <IconX className="stroke-1.5 size-5" />
            </AlertDialogCloseButton>

            <AlertDialogTitle>Remove Organization</AlertDialogTitle>
            <AlertDialogDescription>
              To confirm removal of this organization, including all of
              it&apos;s database connections, queries, metadata, and users, type
              &quot;
              <strong className="font-bold">
                {orgLoaderData?.organization.slug}
              </strong>
              &quot; in the textbox below.
            </AlertDialogDescription>
            <RemoveOrganizationForm onFinish={handleFinishRemoveOrganization} />
          </AlertDialog>
        </div>
      ) : undefined}
    </Article>
  );
}
