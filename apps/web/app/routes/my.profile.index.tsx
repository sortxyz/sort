import { getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { mergeHeaders } from "@sort/sdk";
import { IconCheck, IconSettings } from "@tabler/icons-react";
import { useCallback, useRef } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaArgs,
  MetaDescriptor,
} from "react-router";
import {
  data,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";
import { z } from "zod";
import { ActionForm } from "~/components/action-form";
import { Article } from "~/components/article";
import { Button } from "~/components/button";
import { ControlFieldInput } from "~/components/control-field";
import { FormError } from "~/components/form-error";
import { slugSchema } from "~/schemas/organization";
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
import { dataFnMiddleware, logout } from "~/utils/request.server";
import { extractMessageOrThrow } from "~/utils/response";

export function meta({ data }: MetaArgs<typeof loader>) {
  return [
    {
      title: data?.profile.name ?? data?.profile.username ?? "My Profile",
    },
  ] satisfies MetaDescriptor[];
}

const INTENTS = {
  update: "update",
  remove: "remove",
  verify: "verify",
} as const;

const schema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal(INTENTS.update),
    body: z.object({
      user: z.object({
        name: z.string(),
        email: z.string().email().optional(),
        picture: z.string().max(180).optional(),
        username: slugSchema,
      }),
    }),
  }),
  z.object({
    intent: z.literal(INTENTS.verify),
  }),
  z.object({
    intent: z.literal(INTENTS.remove),
    body: z
      .object({
        usernameConfirmation: slugSchema,
        user: z.object({
          username: slugSchema,
        }),
      })
      .superRefine((body, ctx) => {
        if (body.user.username !== body.usernameConfirmation) {
          return ctx.addIssue({
            code: "invalid_string",
            validation: "regex",
            message: "Usernames do not match",
            path: ["usernameConfirmation"],
          });
        }
      }),
  }),
]);

export async function loader({ request }: LoaderFunctionArgs) {
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );

  const {
    payload: { profile },
  } = await dataFnMiddleware(
    request,
    client.v2.getMyProfile({
      headers,
    }),
  ).then(extractMessageOrThrow("get_my_profile"));

  return { profile };
}

export async function action({ request }: ActionFunctionArgs) {
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );
  const user = await getRequiredUser(request);
  const formData = await request.formData();
  await validateCsrf(formData, request.headers);

  const submission = parseWithZod(formData, {
    schema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  switch (submission.value.intent) {
    case INTENTS.remove: {
      const response = await dataFnMiddleware(
        request,
        client.v2.removeMyProfile({
          headers,
        }),
      );

      const message = await response.json();

      if (message.type !== "success") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return await logout(request);
    }
    case INTENTS.verify: {
      const response = await dataFnMiddleware(
        request,
        client.v2.sendVerificationEmail({
          body: { email: user.sortProfile.email },
          headers,
        }),
      );

      const message = await response.json();

      if (message.type !== "success") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: mergeHeaders(
          await setFlashHeaders({
            type: "success",
            message:
              "Please check your email for a message containing steps to confirm your email address.",
          }),
        ),
      });
    }
    case INTENTS.update: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateMyProfile({
          body: submission.value.body.user,
          headers,
        }),
      );

      const message = await response.json();

      if (message.type !== "update_my_profile") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      const session = await getSession(request.headers.get("Cookie"));
      user.sortProfile = message.payload.profile;

      session.set(sessionKey, user);
      const cookie = await commitSession(session);
      const cookieHeaders = new Headers({ "Set-Cookie": cookie });

      return data(submission.reply({ resetForm: true }), {
        headers: mergeHeaders(
          cookieHeaders,
          await setFlashHeaders({
            type: "success",
            message: "Profile updated successfully",
          }),
        ),
      });
    }
    default: {
      return submission.reply(errorMessageToReplyOptions(generalErrorMessage));
    }
  }
}

export default function Route() {
  const navigation = useNavigation();
  const lastResult = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();
  const pictureRef = useRef<HTMLImageElement>(null);

  const handlePictureChange = useCallback<
    React.ChangeEventHandler<HTMLInputElement>
  >((event) => {
    if (event.defaultPrevented) {
      return;
    }
    if (!pictureRef.current) {
      return;
    }
    pictureRef.current.src = event.currentTarget.value;
  }, []);

  const [form, fields] = useForm({
    lastResult: navigation.state === "idle" ? lastResult : undefined,
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema: schema });
    },
    defaultValue: {
      body: {
        user: loaderData.profile,
      },
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const bodyFieldset = fields.body.getFieldset();

  const bodyUserFieldset = bodyFieldset.user.getFieldset();

  return (
    <Article>
      <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:text-3xl md:font-bold">
        <IconSettings className="stroke-1.5 size-6" aria-hidden />
        Account Settings
      </h3>
      <div>
        <ActionForm
          {...getFormProps(form, {
            ariaDescribedBy: form.valid ? undefined : form.errorId,
          })}
          className="flex flex-col gap-3 md:gap-6"
        >
          <FormError errors={form.errors} id={form.errorId} />
          <ControlFieldInput
            autoComplete="off"
            field={bodyUserFieldset.name}
            label="Name"
            type="text"
          />
          <ControlFieldInput
            autoCapitalize="none"
            autoComplete="off"
            field={bodyUserFieldset.username}
            label="Username"
            type="text"
          />
          <ControlFieldInput
            autoCapitalize="none"
            autoComplete="off"
            field={bodyUserFieldset.email}
            label="Email"
            type="email"
          />
          {loaderData.profile.email ? (
            <div className="mt-[-8px] text-sm md:mt-[-16px]">
              {loaderData.profile.email_verified ? (
                <>
                  <IconCheck className="stroke-1.5 mr-2 inline size-4 stroke-green-600" />
                  <span className="text-green-500">Verified</span>
                </>
              ) : (
                <>
                  <span className="mr-4 text-red-500">Unverified</span>
                  <Button
                    name={fields.intent.name}
                    type="submit"
                    value={INTENTS.verify}
                    intent="secondary"
                    space="xs"
                  >
                    Re-send Email
                  </Button>
                </>
              )}
            </div>
          ) : undefined}
          <ControlFieldInput
            autoCapitalize="none"
            autoComplete="off"
            field={bodyUserFieldset.picture}
            label="Profile picture"
            onChange={handlePictureChange}
            placeholder="https://sort.xyz/image.png"
            type="url"
          />
          <img
            ref={pictureRef}
            src={loaderData.profile.picture}
            alt={loaderData.profile.name}
            width={60}
            height={60}
            className="mt-2 rounded-full"
          />

          <div className="flex pt-2">
            <Button
              name={fields.intent.name}
              type="submit"
              value={INTENTS.update}
              space="sm"
            >
              Update Profile
            </Button>
          </div>
        </ActionForm>
      </div>
    </Article>
  );
}
