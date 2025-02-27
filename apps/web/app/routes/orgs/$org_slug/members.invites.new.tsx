import { getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { mergeHeaders } from "@sort/sdk";
import { IconX } from "@tabler/icons-react";
import type { ActionFunctionArgs } from "react-router";
import {
  redirect,
  useActionData,
  useNavigate,
  useNavigation,
  useParams,
  useSearchParams,
} from "react-router";
import { z } from "zod";
import { ActionForm } from "~/components/action-form";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogDescription,
  AlertDialogTitle,
} from "~/components/alert-dialog";
import { Button } from "~/components/button";
import {
  ControlFieldInput,
  ControlFieldSelect,
} from "~/components/control-field";
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
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams } from "~/utils/response";

const INTENTS = {
  create: "create",
} as const;

const schema = z.object({
  intent: z.literal(INTENTS.create),
  organizationInvite: z.object({
    name: z.string().min(1),
    email: z.string().min(1).email(),
    role_id: z.number().int().min(0).max(1),
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
    case INTENTS.create: {
      const response = await dataFnMiddleware(
        request,
        client.v2.createOrganizationInvite({
          body: submission.value.organizationInvite,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "create_organization_invite") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirect(`/orgs/${params.org_slug}/members/invites`, {
        headers: await setFlashHeaders({
          type: "success",
          message: `You have successfully invited ${submission.value.organizationInvite.name} to your organization.`,
        }),
      });
    }
    default: {
      return submission.reply(errorMessageToReplyOptions(generalErrorMessage));
    }
  }
}

export default function Route() {
  const lastResult = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams();

  const [form, fields] = useForm({
    lastResult: navigation.state === "idle" ? lastResult : undefined,
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue: {
      organizationInvite: {
        email: searchParams.get("email"),
      },
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });

  const organizationInviteFieldset = fields.organizationInvite.getFieldset();

  return (
    <AlertDialog
      open
      onClose={() =>
        void navigate(`/orgs/${params.org_slug}/members/invites`, {
          replace: true,
        })
      }
    >
      <AlertDialogCloseButton aria-label="Close">
        <IconX className="stroke-1.5 size-5" />
      </AlertDialogCloseButton>

      <AlertDialogTitle>New Invite</AlertDialogTitle>
      <AlertDialogDescription>
        Invite a new member to your organization.
      </AlertDialogDescription>

      <ActionForm
        {...getFormProps(form, {
          ariaDescribedBy: form.valid ? undefined : form.errorId,
        })}
        className="flex flex-col gap-3 md:gap-6"
      >
        <FormError errors={form.errors} id={form.errorId} />
        <ControlFieldInput
          field={organizationInviteFieldset.name}
          label="Name"
          type="text"
        />
        <ControlFieldInput
          label="Email"
          field={organizationInviteFieldset.email}
          type="email"
        />

        <ControlFieldSelect
          label="Role"
          field={organizationInviteFieldset.role_id}
        >
          <option value={0}>Owner</option>
          <option value={1}>Member</option>
        </ControlFieldSelect>

        <Button
          name={fields.intent.name}
          space="sm"
          type="submit"
          value={INTENTS.create}
        >
          Create Invite
        </Button>
      </ActionForm>
    </AlertDialog>
  );
}
