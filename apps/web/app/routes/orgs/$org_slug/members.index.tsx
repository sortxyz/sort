import type { DefaultValue } from "@conform-to/react";
import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import type { V2 } from "@sort/sdk";
import { mergeHeaders } from "@sort/sdk";
import { IconUsers, IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaArgs,
  MetaDescriptor,
} from "react-router";
import {
  data,
  useFetcher,
  useLoaderData,
  useRouteLoaderData,
} from "react-router";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogDescription,
  AlertDialogTitle,
} from "~/components/alert-dialog";
import { Article } from "~/components/article";
import { Avatar } from "~/components/avatar";
import { Button, LinkButton } from "~/components/button";
import {
  ControlFieldInput,
  ControlFieldSelect,
} from "~/components/control-field";
import { FormError } from "~/components/form-error";
import { Spinner } from "~/components/spinner";
import { Tag } from "~/components/tag";
import type { loader as orgLoader } from "~/routes/orgs/$org_slug";
import { slugSchema } from "~/schemas/organization";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUserHeaders,
  getUserOrServiceAccountHeaders,
} from "~/services/auth.server";
import { validateCsrf } from "~/utils/csrf.server";
import { setFlashHeaders } from "~/utils/flash";
import {
  errorMessageToReplyOptions,
  generalErrorMessage,
} from "~/utils/message";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";
import { getNonBlankStringOrDefault } from "~/utils/string";

export function meta({ data }: MetaArgs<typeof loader>) {
  const count = data?.members.length;

  return [
    { title: count ? `Members (${count})` : "Members" },
  ] satisfies MetaDescriptor[];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getUserOrServiceAccountHeaders(request),
  );

  const {
    payload: { members },
  } = await dataFnMiddleware(
    request,
    client.v2.listOrganizationMembers({
      headers,
      params,
    }),
  ).then(extractMessageOrThrow("list_organization_members"));

  return { members };
}

const INTENTS = {
  update: "update",
  remove: "remove",
} as const;

const schema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal(INTENTS.update),
    body: z.object({
      member: z.object({
        username: slugSchema,
        role_id: z.number().int().min(0).max(1),
      }),
    }),
  }),
  z.object({
    intent: z.literal(INTENTS.remove),
    body: z
      .object({
        member: z.object({
          username: slugSchema,
        }),
        usernameConfirmation: slugSchema,
      })
      .superRefine((body, ctx) => {
        if (body.member.username !== body.usernameConfirmation) {
          ctx.addIssue({
            code: "custom",
            message: "Username confirmation does not match.",
            path: ["usernameConfirmation"],
          });
        }
      }),
  }),
]);

export async function action({ request, params }: ActionFunctionArgs) {
  assertResponseParams(params, ["org_slug"]);
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
    case INTENTS.update: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateOrganizationMember({
          body: { role_id: submission.value.body.member.role_id },
          headers,
          params: {
            ...params,
            member_username: submission.value.body.member.username,
          },
        }),
      );

      const message = await response.json();

      if (message.type !== "update_organization_member") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply(), {
        headers: await setFlashHeaders({
          type: "success",
          message: `Member ${message.payload.member.user.username} updated to ${message.payload.member.role.name} successfully.`,
        }),
      });
    }
    case INTENTS.remove: {
      const response = await dataFnMiddleware(
        request,
        client.v2.removeOrganizationMember({
          headers,
          params: {
            ...params,
            member_username: submission.value.body.member.username,
          },
        }),
      );

      const message = await response.json();

      if (message.type !== "success") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply(), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Member removed successfully.",
        }),
      });
    }
    default: {
      return submission.reply(errorMessageToReplyOptions(generalErrorMessage));
    }
  }
}

function MemberRow({
  member,
  canManageRoles,
}: {
  member: V2.Member;
  canManageRoles: boolean;
}) {
  const [intent, setIntent] = useState<string | undefined>(undefined);
  const handleClose = useCallback(() => setIntent(undefined), []);
  const handleFinish = useCallback(() => setIntent(undefined), []);
  const handleClick = useCallback<React.MouseEventHandler<HTMLButtonElement>>(
    (event) => setIntent(event.currentTarget.value),
    [],
  );
  return (
    <li
      key={member.user.id}
      className="flex flex-col gap-2 rounded-lg border border-gray-300 p-4"
    >
      <div className="flex grow justify-between overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="shrink-0">
            <Avatar
              alt={getNonBlankStringOrDefault(
                member.user.name,
                member.user.username,
              )}
              space="lg"
              src={member.user.picture ?? undefined}
            />
          </span>
          <div className="overflow-hidden">
            <p className="truncate font-semibold text-gray-900">
              {member.user.name}
            </p>
            <p className="truncate text-gray-600">{member.user.username}</p>
          </div>
        </div>
        {member.role.id === 0 ? (
          <span className="shrink-0">
            <Tag intent="neutral">{member.role.name}</Tag>
          </span>
        ) : undefined}
      </div>
      {canManageRoles ? (
        <nav className="flex flex-row justify-end gap-2">
          <Button
            space="sm"
            intent="secondary"
            type="button"
            value="update"
            onClick={handleClick}
          >
            Update Role
          </Button>
          <Button
            space="sm"
            type="button"
            intent="secondary"
            value="remove"
            onClick={handleClick}
          >
            Remove Member
          </Button>
        </nav>
      ) : undefined}
      <AlertDialog open={intent === INTENTS.update} onClose={handleClose}>
        <AlertDialogCloseButton aria-label="Close">
          <IconX className="stroke-1.5 size-5" />
        </AlertDialogCloseButton>

        <AlertDialogTitle>Update Member Role</AlertDialogTitle>
        <AlertDialogDescription>
          You are about to update the role of a member.
        </AlertDialogDescription>
        <UpdateMemberForm
          onFinish={handleFinish}
          defaultValue={{
            body: {
              member: {
                role_id: member.role.id,
                username: member.user.username,
              },
            },
          }}
        />
      </AlertDialog>
      <AlertDialog open={intent === INTENTS.remove} onClose={handleClose}>
        <AlertDialogCloseButton aria-label="Close">
          <IconX className="stroke-1.5 size-5" />
        </AlertDialogCloseButton>

        <AlertDialogTitle>Remove Member</AlertDialogTitle>
        <AlertDialogDescription>
          You are about to remove a member from this organization.
        </AlertDialogDescription>
        <RemoveMemberForm
          onFinish={handleFinish}
          defaultValue={{
            body: {
              member: {
                role_id: member.role.id,
                username: member.user.username,
              },
            },
          }}
        />
      </AlertDialog>
    </li>
  );
}

function UpdateMemberForm({
  defaultValue,
  onFinish,
}: {
  defaultValue: DefaultValue<z.input<typeof schema>>;
  onFinish: () => void;
}) {
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
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue,
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const bodyFieldset = fields.body.getFieldset();
  const bodyMemberFieldset = bodyFieldset.member.getFieldset();

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
      <ControlFieldSelect
        fullWidth
        label="Role"
        field={bodyMemberFieldset.role_id}
      >
        <option value={0}>Owner</option>
        <option value={1}>Member</option>
      </ControlFieldSelect>

      <input
        {...getInputProps(bodyMemberFieldset.username, {
          type: "hidden",
        })}
      />

      <Button
        type="submit"
        value={INTENTS.update}
        name={fields.intent.name}
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
        Update Member
      </Button>
    </fetcher.Form>
  );
}

function RemoveMemberForm({
  defaultValue,
  onFinish,
}: {
  defaultValue: DefaultValue<z.input<typeof schema>>;
  onFinish: () => void;
}) {
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
  const [form, fields] = useForm<
    z.input<typeof schema>,
    z.output<typeof schema>
  >({
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue,
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const bodyFieldset = fields.body.getFieldset();
  const bodyMemberFieldset = bodyFieldset.member.getFieldset();

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
        field={bodyFieldset.usernameConfirmation}
        fullWidth
        helperText={
          <>
            To confirm, type &quot;
            <strong className="font-bold">
              {bodyMemberFieldset.username.value}
            </strong>
            &quot; in the textbox below to remove this member from the
            organization.
          </>
        }
        label="Username confirmation"
        type="text"
      />
      <input
        {...getInputProps(bodyMemberFieldset.username, {
          type: "hidden",
        })}
      />

      <Button
        type="submit"
        space="sm"
        intent="destructive"
        name={fields.intent.name}
        value={INTENTS.remove}
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
        Remove Member
      </Button>
    </fetcher.Form>
  );
}

export default function Route() {
  const orgLoaderData = useRouteLoaderData<typeof orgLoader>(
    "routes/orgs/$org_slug",
  );
  const loaderData = useLoaderData<typeof loader>();

  const canManageRoles =
    !!orgLoaderData?.organization.permissions?.manage_roles.value;

  return (
    <Article>
      <header className="flex items-start justify-between">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900">
          <IconUsers className="stroke-1.5 size-6" aria-hidden />
          Members
        </h3>
        {orgLoaderData?.organization.permissions?.view_invites.value ? (
          <LinkButton
            to={`/orgs/${orgLoaderData.organization.slug}/members/invites`}
            intent="secondary"
            space="sm"
          >
            Manage Invites
          </LinkButton>
        ) : undefined}
      </header>
      <ul className="grid grid-cols-1 gap-4 md:gap-8 2xl:grid-cols-2">
        {loaderData.members.map((member) => (
          <MemberRow
            key={member.user.id}
            member={member}
            canManageRoles={canManageRoles}
          />
        ))}
      </ul>
    </Article>
  );
}
