import { getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { mergeHeaders } from "@sort/sdk";
import { IconLabel } from "@tabler/icons-react";
import type { ActionFunctionArgs, UIMatch } from "react-router";
import {
  data,
  redirect,
  useActionData,
  useNavigation,
  useRouteLoaderData,
} from "react-router";
import { z } from "zod";
import { ActionForm } from "~/components/action-form";
import { Article } from "~/components/article";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import { Button } from "~/components/button";
import {
  ControlFieldInput,
  ControlFieldTextarea,
} from "~/components/control-field";
import { FormError } from "~/components/form-error";
import type { loader as orgLoader } from "~/routes/orgs/$org_slug";
import type { loader as labelLoader } from "~/routes/orgs/$org_slug/databases/$database_slug/labels/$label_id";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUserHeaders,
} from "~/services/auth.server";
import { csrf } from "~/utils/csrf.server";
import { setFlashHeaders } from "~/utils/flash";
import {
  errorMessageToReplyOptions,
  generalErrorMessage,
} from "~/utils/message";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams } from "~/utils/response";

export const handle = {
  breadcrumb(match: UIMatch) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        Edit
      </BreadcrumbNavLink>
    );
  },
};

const INTENTS = {
  update: "update",
  delete: "delete",
} as const;

const schema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal(INTENTS.update),
    label: z.object({
      color: z.string(),
      name: z
        .string()
        .min(1)
        .max(16)
        .regex(/[^"]{1,16}/),
      description: z.string().min(1).nullable().default(null),
    }),
  }),
  z.object({
    intent: z.literal(INTENTS.delete),
  }),
]);

export async function action({ request, params }: ActionFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug", "label_id"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );
  const formData = await request.formData();
  await csrf.validate(formData, request.headers);
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    return submission.reply();
  }

  switch (submission.value.intent) {
    case INTENTS.update: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateLabel({
          body: submission.value.label,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "update_database_label") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Successfully updated label",
        }),
      });
    }
    case INTENTS.delete: {
      const response = await dataFnMiddleware(
        request,
        client.v2.deleteLabel({
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "success") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirect(
        `/orgs/${params.org_slug}/databases/${params.database_slug}/labels`,
        {
          headers: await setFlashHeaders({
            type: "success",
            message: "Successfully deleted label",
          }),
        },
      );
    }
    default: {
      return submission.reply(errorMessageToReplyOptions(generalErrorMessage));
    }
  }
}

export default function Route() {
  const orgLoaderData = useRouteLoaderData<typeof orgLoader>(
    "routes/orgs/$org_slug",
  );
  const labelLoaderData = useRouteLoaderData<typeof labelLoader>(
    "routes/orgs/$org_slug/databases/$database_slug/labels/$label_id",
  );

  const lastResult = useActionData<typeof action>();
  const navigation = useNavigation();

  const [form, fields] = useForm({
    lastResult: navigation.state === "idle" ? lastResult : undefined,
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue: {
      label: labelLoaderData?.label,
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const labelFieldset = fields.label.getFieldset();

  return (
    <Article>
      <header className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
          <IconLabel className="stroke-1.5 size-6" aria-hidden />
          Edit Label
        </h3>
      </header>
      <ActionForm
        {...getFormProps(form, {
          ariaDescribedBy: form.valid ? undefined : form.errorId,
        })}
        className="flex flex-col gap-3"
      >
        <FormError errors={form.errors} id={form.errorId} />
        <div className="flex gap-3">
          <ControlFieldInput
            fullWidth
            autoComplete="off"
            field={labelFieldset.name}
            label="Name"
            type="text"
          />
          <ControlFieldInput
            label="Color"
            field={labelFieldset.color}
            type="color"
          />
        </div>
        <ControlFieldTextarea
          field={labelFieldset.description}
          label="Description"
        />
        {orgLoaderData?.organization.permissions?.is_member.value ? (
          <div className="inline-flex items-center gap-2">
            <Button
              type="submit"
              name={fields.intent.name}
              value={INTENTS.update}
              space="sm"
            >
              Update Label
            </Button>
            <Button
              type="submit"
              intent="destructive"
              space="sm"
              name={fields.intent.name}
              value={INTENTS.delete}
            >
              Delete Label
            </Button>
          </div>
        ) : undefined}
      </ActionForm>
    </Article>
  );
}
