import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { mergeHeaders } from "@sort/sdk";
import { IconChevronLeft, IconPlus } from "@tabler/icons-react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaDescriptor,
  UIMatch,
} from "react-router";
import {
  redirect,
  useActionData,
  useNavigation,
  useSearchParams,
} from "react-router";
import { z } from "zod";
import { ActionForm } from "~/components/action-form";
import { Article } from "~/components/article";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import { Button } from "~/components/button";
import { ControlFieldInput } from "~/components/control-field";
import { ControlMarkdownFieldTextarea } from "~/components/control-markdown-field";
import { FormError } from "~/components/form-error";
import {
  GlobalSidebarMenu,
  GlobalSidebarMenuNavLinkItem,
} from "~/components/global-sidebar";
import { slugSchema } from "~/schemas/organization";
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
import { DEFAULT_ORG_DESCRIPTION, toSlugString } from "~/utils/organization";
import { dataFnMiddleware } from "~/utils/request.server";

export function meta() {
  return [{ title: "Add Organization" }] satisfies MetaDescriptor[];
}

const INTENTS = {
  create: "create",
} as const;

const schema = z.object({
  intent: z.literal(INTENTS.create),
  organization: z.object({
    name: z.string().min(2),
    link: z.string().url().nullable().default(null),
    description: z.string().min(1).nullable().default(null),
    slug: slugSchema,
  }),
});

export async function action({ request }: ActionFunctionArgs) {
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
    case INTENTS.create: {
      const response = await dataFnMiddleware(
        request,
        client.v2.createOrganization({
          body: submission.value.organization,
          headers,
        }),
      );

      const message = await response.json();

      if (message.type !== "create_organization") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirect(
        `/orgs/${message.payload.organization.slug}/settings/connections/add-connection`,
        {
          headers: await setFlashHeaders({
            type: "success",
            message: `Successfully created organization "${message.payload.organization.name}"`,
          }),
        },
      );
    }
    default: {
      return submission.reply(errorMessageToReplyOptions(generalErrorMessage));
    }
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  await getRequiredUser(request);

  return null;
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
        title="Add Organization"
        iconLeft={<IconPlus className="stroke-1.5 size-6" />}
        end
        to="/orgs/new"
      >
        Add Organization
      </GlobalSidebarMenuNavLinkItem>
    </GlobalSidebarMenu>
  );
}

export const handle = {
  breadcrumb(match: UIMatch) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        New
      </BreadcrumbNavLink>
    );
  },
  menu: <Menu />,
};

export default function Route() {
  const lastResult = useActionData<typeof action>();
  const navigation = useNavigation();

  const [searchParams] = useSearchParams();
  const org_slug = searchParams.get("org_slug") ?? "";
  const [form, fields] = useForm({
    lastResult: navigation.state === "idle" ? lastResult : undefined,
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue: {
      organization: {
        name: org_slug,
        slug: toSlugString(org_slug),
        description: DEFAULT_ORG_DESCRIPTION,
      },
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const organizationFieldset = fields.organization.getFieldset();

  return (
    <Article>
      <h2 className="text-2xl font-bold">Set up your new organization</h2>
      <div>
        <ActionForm
          {...getFormProps(form, {
            ariaDescribedBy: form.valid ? undefined : form.errorId,
          })}
          className="flex flex-col gap-3 md:gap-6"
        >
          {searchParams.has("deleteModal") ? undefined : (
            <FormError errors={form.errors} id={form.errorId} />
          )}
          <ControlFieldInput
            {...getInputProps(organizationFieldset.name, { type: "text" })}
            autoComplete="off"
            field={organizationFieldset.name}
            helperText={
              <>
                <p>
                  This will be the public name of your organization on Sort.
                </p>
                <p>
                  Your url will be: https://sort.xyz/orgs/
                  {organizationFieldset.name.value
                    ? toSlugString(organizationFieldset.name.value)
                    : undefined}
                </p>
              </>
            }
            label="Name"
            type="text"
          />
          <input
            {...getInputProps(organizationFieldset.slug, {
              type: "hidden",
              value: false,
            })}
            aria-label="Slug"
            readOnly
            value={
              organizationFieldset.name.value
                ? toSlugString(organizationFieldset.name.value)
                : undefined
            }
          />
          <ControlFieldInput
            autoCapitalize="none"
            autoComplete="off"
            field={organizationFieldset.link}
            helperText={
              <>
                This optional link will be displayed on your public organization
                page.
              </>
            }
            label="Link"
            placeholder="https://sort.xyz"
            type="url"
          />

          <ControlMarkdownFieldTextarea
            label="Description"
            field={organizationFieldset.description}
            rows={19}
          />

          <div className="flex pt-2">
            <Button
              space="sm"
              type="submit"
              name={fields.intent.name}
              value={INTENTS.create}
            >
              Create Organization
            </Button>
          </div>
        </ActionForm>
      </div>
    </Article>
  );
}
