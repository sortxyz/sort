import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import type { V2 } from "@sort/sdk";
import { mergeHeaders } from "@sort/sdk";
import { IconMail, IconPlus } from "@tabler/icons-react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaArgs,
  MetaDescriptor,
  UIMatch,
} from "react-router";
import {
  Outlet,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "~/components/table";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUserHeaders,
} from "~/services/auth.server";
import { validateCsrf } from "~/utils/csrf.server";
import {
  errorMessageToReplyOptions,
  generalErrorMessage,
} from "~/utils/message";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export function meta({ data }: MetaArgs<typeof loader>) {
  const count = data?.organization_invites.length;

  return [
    { title: count ? `Invites (${count})` : "Invites" },
  ] satisfies MetaDescriptor[];
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );
  const {
    payload: { organization_invites },
  } = await dataFnMiddleware(
    request,
    client.v2.listOrganizationInvites({
      headers,
      params,
    }),
  ).then(extractMessageOrThrow("list_organization_invites"));

  return { organization_invites };
}

export const handle = {
  breadcrumb(match: UIMatch) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        Invites
      </BreadcrumbNavLink>
    );
  },
};

const INTENTS = {
  update: "update",
} as const;

const schema = z.object({
  intent: z.literal(INTENTS.update),
  invite_id: z.string(),
  organizationInvite: z.object({
    status: z.literal("rescinded"),
    email: z.string().min(1).email(),
  }),
});

export async function action({ request, params }: ActionFunctionArgs) {
  assertResponseParams(params, ["org_slug"]);
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
        client.v2.updateOrganizationInvite({
          body: submission.value.organizationInvite,
          headers,
          params: {
            ...params,
            invite_id: submission.value.invite_id,
          },
        }),
      );

      const message = await response.json();

      if (message.type !== "success") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirect(`/orgs/${params.org_slug}/members/invites`);
    }
    default: {
      return submission.reply(errorMessageToReplyOptions(generalErrorMessage));
    }
  }
}

function OrganizationInviteRow({
  organizationInvite,
}: {
  organizationInvite: V2.OrganizationInvite;
}) {
  const lastResult = useActionData<typeof action>();
  const navigation = useNavigation();
  const [form, fields] = useForm({
    lastResult: navigation.state === "idle" ? lastResult : undefined,
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue: {
      invite_id: organizationInvite.id,
      intent: INTENTS.update,
      organizationInvite: {
        status: "rescinded",
        email: organizationInvite.email,
      },
    },
  });
  const organizationInviteFieldset = fields.organizationInvite.getFieldset();

  return (
    <TableRow>
      <TableCell>{organizationInvite.name}</TableCell>
      <TableCell textAlign="center">{organizationInvite.status}</TableCell>
      <TableCell textAlign="right">
        <ActionForm {...getFormProps(form)} navigate={false}>
          <input
            {...getInputProps(organizationInviteFieldset.status, {
              type: "hidden",
            })}
          />
          <input {...getInputProps(fields.invite_id, { type: "hidden" })} />
          <input
            {...getInputProps(organizationInviteFieldset.email, {
              type: "hidden",
            })}
          />
          <Button
            type="submit"
            space="sm"
            intent="destructive"
            name={fields.intent.name}
            value={INTENTS.update}
            onClick={(event) => {
              if (!confirm("Are you sure you want to rescind this invite?")) {
                event.preventDefault();
              }
            }}
          >
            Rescind Invite
          </Button>
        </ActionForm>
      </TableCell>
    </TableRow>
  );
}

export default function Route() {
  const params = useParams();
  const loaderData = useLoaderData<typeof loader>();

  return (
    <Article>
      {loaderData.organization_invites.length ? (
        <div className="flex flex-col gap-4 md:gap-8">
          <header className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
            <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
              <IconMail className="stroke-1.5 size-6" aria-hidden />
              Invites
            </h3>
            <LinkButton
              intent="secondary"
              space="sm"
              to={`/orgs/${params.org_slug}/members/invites/new`}
            >
              Invite Member
            </LinkButton>
          </header>
          <Table>
            <TableHead>
              <TableHeadRow>
                <TableHeader>Name</TableHeader>
                <TableHeader textAlign="center">Status</TableHeader>
                <TableHeader textAlign="right">Actions</TableHeader>
              </TableHeadRow>
            </TableHead>
            <TableBody>
              {loaderData.organization_invites.map((organizationInvite) => (
                <OrganizationInviteRow
                  key={organizationInvite.id}
                  organizationInvite={organizationInvite}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center">
          <h3 className="text-xl font-semibold text-gray-900 md:text-2xl md:font-bold">
            Invite New Organization Member
          </h3>
          <p className="max-w-prose pt-8 pb-5 text-center">
            There are no organization invites to display. Invite a new member to
            your organization by entering their email address and permissions.
          </p>
          <LinkButton
            to={`/orgs/${params.org_slug}/members/invites/new`}
            iconLeft={<IconPlus className="stroke-1.5 size-6" />}
          >
            Invite Member
          </LinkButton>
        </div>
      )}
      <Outlet />
    </Article>
  );
}
