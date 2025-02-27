import { getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { mergeHeaders } from "@sort/sdk";
import { IconLabel } from "@tabler/icons-react";
import type { ActionFunctionArgs, UIMatch } from "react-router";
import { redirect, useActionData, useNavigation } from "react-router";
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
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUserHeaders,
} from "~/services/auth.server";
import { csrf } from "~/utils/csrf.server";
import { setFlashHeaders } from "~/utils/flash";
import { errorMessageToReplyOptions } from "~/utils/message";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams } from "~/utils/response";

const INTENTS = {
  create: "create",
} as const;

export const handle = {
  breadcrumb(match: UIMatch) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        New
      </BreadcrumbNavLink>
    );
  },
};

const schema = z.object({
  intent: z.literal(INTENTS.create),
  label: z.object({
    color: z.string(),
    name: z
      .string()
      .min(1)
      .max(16)
      .regex(/[^"]{1,16}/),
    description: z.string().min(1).nullable().default(null),
  }),
});

export async function action({ request, params }: ActionFunctionArgs) {
  assertResponseParams(params, ["org_slug", "database_slug"]);
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
    case INTENTS.create: {
      const response = await dataFnMiddleware(
        request,
        client.v2.createLabel({
          body: submission.value.label,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "create_database_label") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirect(
        `/orgs/${params.org_slug}/databases/${params.database_slug}/labels`,
        {
          headers: await setFlashHeaders({
            type: "success",
            message: "Successfully created label",
          }),
        },
      );
    }
  }
}

export default function Route() {
  const lastResult = useActionData<typeof action>();
  const navigation = useNavigation();

  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    lastResult: navigation.state === "idle" ? lastResult : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
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
          New Label
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
          label="Description"
          field={labelFieldset.description}
        />
        <div>
          <Button
            name={fields.intent.name}
            value={INTENTS.create}
            type="submit"
            space="sm"
          >
            Create Label
          </Button>
        </div>
      </ActionForm>
    </Article>
  );
}
