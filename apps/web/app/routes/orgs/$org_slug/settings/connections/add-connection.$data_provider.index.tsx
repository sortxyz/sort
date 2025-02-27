import { getFormProps, getInputProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { mergeHeaders } from "@sort/sdk";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import {
  data,
  redirect,
  useActionData,
  useNavigation,
  useParams,
} from "react-router";
import { z } from "zod";
import { ActionForm } from "~/components/action-form";
import { Button } from "~/components/button";
import {
  ControlFieldInput,
  ControlFieldSelect,
} from "~/components/control-field";
import { ControlInlineFieldInput } from "~/components/control-inline-field";
import { FormError } from "~/components/form-error";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUser,
  getRequiredUserHeaders,
} from "~/services/auth.server";
import { getDefaultPort, isDataProvider } from "~/utils/connection";
import { validateCsrf } from "~/utils/csrf.server";
import { setFlashHeaders } from "~/utils/flash";
import {
  errorMessageToReplyOptions,
  generalErrorMessage,
} from "~/utils/message";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams } from "~/utils/response";

const INTENTS = {
  test: "test",
  create: "create",
} as const;

const dataProviderSchema = z.enum(["postgres", "snowflake"]);

const visibilitySchema = z.union([
  z.literal("on").transform<"public">(() => "public"),
  z.undefined().transform<"private">(() => "private"),
]);
const parametersSchema = z.object({
  database: z.string().min(1),
  host: z.string().min(1),
  password: z.string().min(1),
  port: z.number(),
  user: z.string().min(1),
  warehouse: z.optional(z.string()),
});

const nameSchema = z.string().min(1);
const connectionStringSchema = z.string().min(1);

const schema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal(INTENTS.test),
    connection: z
      .discriminatedUnion("type", [
        z.object({
          type: z.literal("connection_string"),
          data_provider: dataProviderSchema,
          connection_string: connectionStringSchema,
          warehouse: z.optional(z.string()),
        }),
        z.object({
          type: z.literal("parameters"),
          data_provider: dataProviderSchema,
          parameters: parametersSchema,
        }),
      ])
      .superRefine((data, ctx) => {
        if (
          data.type === "parameters" &&
          data.data_provider === "snowflake" &&
          !data.parameters.warehouse
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Warehouse is required for Snowflake connections",
            path: ["parameters", "warehouse"],
          });
        } else if (
          data.type === "connection_string" &&
          data.data_provider === "snowflake" &&
          !data.warehouse
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Warehouse is required for Snowflake connections",
            path: ["warehouse"],
          });
        }
      }),
  }),
  z.object({
    intent: z.literal(INTENTS.create),
    connection: z
      .discriminatedUnion("type", [
        z.object({
          type: z.literal("connection_string"),
          connection_string: connectionStringSchema,
          data_provider: dataProviderSchema,
          name: nameSchema,
          visibility: visibilitySchema,
          warehouse: z.optional(z.string()),
        }),
        z.object({
          type: z.literal("parameters"),
          data_provider: dataProviderSchema,
          name: nameSchema,
          parameters: parametersSchema,
          visibility: visibilitySchema,
        }),
      ])
      .superRefine((data, ctx) => {
        if (
          data.type === "parameters" &&
          data.data_provider === "snowflake" &&
          !data.parameters.warehouse
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Warehouse is required for Snowflake connections",
            path: ["parameters", "warehouse"],
          });
        } else if (
          data.type === "connection_string" &&
          data.data_provider === "snowflake" &&
          !data.warehouse
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Warehouse is required for Snowflake connections",
            path: ["warehouse"],
          });
        }
      }),
  }),
]);

export async function action({ request, params }: ActionFunctionArgs) {
  assertResponseParams(params, ["org_slug", "data_provider"]);
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
    case INTENTS.test: {
      const response = await dataFnMiddleware(
        request,
        client.v2.testOrganizationConnection({
          body: submission.value.connection,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "test_connection") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      if (!message.payload.connection_test.success) {
        return submission.reply({
          formErrors: [
            message.payload.connection_test.message || "Connection test failed",
          ],
        });
      }

      return data(submission.reply(), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Connection tested successfully",
        }),
      });
    }
    case INTENTS.create: {
      const response = await dataFnMiddleware(
        request,
        client.v2.createConnection({
          body: submission.value.connection,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "create_connection") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirect(`/orgs/${params.org_slug}/databases`, {
        headers: await setFlashHeaders({
          type: "success",
          message: "Connection created successfully. Import started.",
        }),
      });
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

export default function Route() {
  const lastResult = useActionData<typeof action>();
  const navigation = useNavigation();
  const params = useParams();

  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    lastResult: navigation.state === "idle" ? lastResult : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue: {
      connection: {
        data_provider: params.data_provider,
        type: "parameters",
        visibility: "private",
        parameters: {
          port: isDataProvider(params.data_provider)
            ? getDefaultPort(params.data_provider)
            : undefined,
        },
      },
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const connectionFieldset = fields.connection.getFieldset();
  const parametersFieldset = connectionFieldset.parameters.getFieldset();

  return (
    <ActionForm
      {...getFormProps(form, {
        ariaDescribedBy: form.valid ? undefined : form.errorId,
      })}
      className="flex flex-col gap-2 md:gap-4"
    >
      <input
        {...getInputProps(connectionFieldset.data_provider, {
          type: "hidden",
        })}
      />
      <FormError errors={form.errors} id={form.errorId} />

      <ControlFieldInput
        autoComplete="off"
        field={connectionFieldset.name}
        label="Name"
        type="text"
      />

      <ControlFieldSelect
        field={connectionFieldset.type}
        label="Connection Type"
        fullWidth
      >
        <option value="parameters">Parameters</option>
        <option value="connection_string">Connection String</option>
      </ControlFieldSelect>

      <fieldset
        disabled={connectionFieldset.type.value !== "parameters"}
        className="flex flex-col gap-2 disabled:hidden md:gap-4"
      >
        <div className="flex flex-col gap-2 md:flex-row md:gap-4">
          <ControlFieldInput
            autoCapitalize="none"
            field={parametersFieldset.host}
            fullWidth
            label="Host"
            type="text"
          />
          <ControlFieldInput
            fullWidth
            label="Port"
            field={parametersFieldset.port}
            type="number"
          />
        </div>

        <ControlFieldInput
          autoCapitalize="none"
          field={parametersFieldset.database}
          fullWidth
          label="Database"
          type="text"
        />

        <div className="flex flex-col gap-2 md:flex-row md:gap-4">
          <ControlFieldInput
            autoCapitalize="none"
            autoComplete="off"
            field={parametersFieldset.user}
            fullWidth
            label="Username"
            type="text"
          />
          <ControlFieldInput
            autoComplete="off"
            field={parametersFieldset.password}
            fullWidth
            label="Password"
            type="password"
          />
        </div>

        {connectionFieldset.data_provider.value === "snowflake" && (
          <ControlFieldInput
            autoCapitalize="none"
            autoComplete="off"
            field={parametersFieldset.warehouse}
            fullWidth
            label="Warehouse"
            type="text"
          />
        )}
      </fieldset>

      <fieldset
        disabled={connectionFieldset.type.value !== "connection_string"}
        className="flex flex-col gap-2 disabled:hidden md:gap-4"
      >
        <ControlFieldInput
          autoCapitalize="none"
          autoComplete="off"
          field={connectionFieldset.connection_string}
          fullWidth
          label="Connection String"
          type="text"
        />

        {connectionFieldset.data_provider.value === "snowflake" && (
          <ControlFieldInput
            autoCapitalize="none"
            field={connectionFieldset.warehouse}
            fullWidth
            label="Warehouse"
            type="text"
          />
        )}
      </fieldset>

      <ControlInlineFieldInput
        field={connectionFieldset.visibility}
        label="Make all of this connection's databases and queries available to the public?"
        type="checkbox"
      />

      <div className="inline-flex items-center gap-2">
        <Button
          space="sm"
          name={fields.intent.name}
          type="submit"
          value={INTENTS.create}
        >
          Create Connection
        </Button>
        <Button
          space="sm"
          intent="secondary"
          name={fields.intent.name}
          type="submit"
          value={INTENTS.test}
        >
          Test Connection
        </Button>
      </div>
    </ActionForm>
  );
}
