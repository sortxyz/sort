import type { DefaultValue } from "@conform-to/react";
import {
  getFieldsetProps,
  getFormProps,
  getInputProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import { mergeHeaders } from "@sort/sdk";
import { IconX } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
import type { ActionFunctionArgs } from "react-router";
import {
  data,
  redirect,
  redirectDocument,
  useActionData,
  useFetcher,
  useNavigation,
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
import { Button } from "~/components/button";
import {
  ControlFieldInput,
  ControlFieldSelect,
} from "~/components/control-field";
import { ControlInlineFieldInput } from "~/components/control-inline-field";
import { FormError } from "~/components/form-error";
import { Spinner } from "~/components/spinner";
import { client } from "~/sdk/client.server";
import {
  getDefaultRequestHeaders,
  getRequiredUserHeaders,
} from "~/services/auth.server";
import { getDefaultPort } from "~/utils/connection";
import { validateCsrf } from "~/utils/csrf.server";
import { setFlashHeaders } from "~/utils/flash";
import {
  errorMessageToReplyOptions,
  generalErrorMessage,
} from "~/utils/message";
import { dataFnMiddleware } from "~/utils/request.server";
import { assertResponseParams } from "~/utils/response";
import { capitalizeWord } from "~/utils/string";
import type { loader as connectionLoader } from "./$connection_id.edit";

const INTENTS = {
  delete: "delete",
  testExisting: "testExisting",
  testNew: "testNew",
  update: "update",
  importSchema: "importSchema",
} as const;

const dataProviderSchema = z.enum(["postgres", "snowflake"]);

const visibilitySchema = z.union([
  z.literal("on").transform<"public">(() => "public"),
  z.undefined().transform<"private">(() => "private"),
]);

const parametersSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(0),
  database: z.string().min(1),
  user: z.string().min(1),
  password: z.string().min(1),
  warehouse: z.optional(z.string()),
});

const nameSchema = z.string().min(1);

const schema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal(INTENTS.testExisting),
  }),
  z.object({
    intent: z.literal(INTENTS.testNew),
    body: z.object({
      connection: z
        .discriminatedUnion("type", [
          z.object({
            type: z.literal("connection_string"),
            connection_string: z.string().min(1),
            data_provider: dataProviderSchema,
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
  }),
  z.object({
    intent: z.literal(INTENTS.update),
    body: z.object({
      connection: z
        .discriminatedUnion("type", [
          z.object({
            type: z.literal("connection_string"),
            connection_string: z.string().min(1),
            data_provider: dataProviderSchema,
            name: nameSchema,
            visibility: visibilitySchema,
            warehouse: z.optional(z.string()),
          }),
          z.object({
            type: z.literal("parameters"),
            data_provider: dataProviderSchema,
            name: nameSchema,
            parameters: parametersSchema.optional(),
            visibility: visibilitySchema,
          }),
        ])
        .superRefine((data, ctx) => {
          if (
            data.type === "parameters" &&
            data.data_provider === "snowflake" &&
            data.parameters &&
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
  }),
  z.object({
    intent: z.literal(INTENTS.importSchema),
  }),
  z.object({
    intent: z.literal(INTENTS.delete),
    body: z
      .object({
        connection: z.object({
          name: nameSchema,
        }),
        nameConfirmation: nameSchema,
      })
      .superRefine((body, ctx) => {
        if (
          body.connection?.name === undefined ||
          body.connection.name !== body.nameConfirmation
        ) {
          return ctx.addIssue({
            code: "custom",
            message: "Names do not match",
            path: ["nameConfirmation"],
          });
        }
      }),
  }),
]);

export async function action({ request, params }: ActionFunctionArgs) {
  assertResponseParams(params, ["org_slug", "connection_id"]);

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
    case INTENTS.delete: {
      const response = await dataFnMiddleware(
        request,
        client.v2.deleteOrganizationConnection({
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "success") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirect(`/orgs/${params.org_slug}/settings/connections`, {
        headers: await setFlashHeaders({
          type: "success",
          message: "Connection deleted successfully",
        }),
      });
    }
    case INTENTS.testExisting: {
      const response = await dataFnMiddleware(
        request,
        client.v2.testOrganizationConnection({
          body: {
            type: "persisted",
            id: params.connection_id,
          },
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

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Connection tested successfully",
        }),
      });
    }
    case INTENTS.testNew: {
      const response = await dataFnMiddleware(
        request,
        client.v2.testOrganizationConnection({
          body: submission.value.body.connection,
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
    case INTENTS.update: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateOrganizationConnection({
          body: submission.value.body.connection,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "update_connection") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirectDocument(
        `/orgs/${params.org_slug}/settings/connections/${params.connection_id}/edit`,
        {
          headers: await setFlashHeaders({
            type: "success",
            message: "Connection updated successfully",
          }),
        },
      );
    }
    case INTENTS.importSchema: {
      const response = await dataFnMiddleware(
        request,
        client.v2.createSchemaSnapshot({
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "create_schema_snapshot") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Schema imported successfully",
        }),
      });
    }
    default:
      return submission.reply(errorMessageToReplyOptions(generalErrorMessage));
  }
}

function DeleteConnectionForm({
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
  const [deleteForm, deleteFields] = useForm<
    z.input<typeof schema>,
    z.output<typeof schema>
  >({
    constraint: getZodConstraint(schema),
    lastResult: fetcher.state === "idle" ? fetcher.data : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue,
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const deleteBodyFieldset = deleteFields.body.getFieldset();
  const deleteConnectionFieldset = deleteBodyFieldset.connection.getFieldset();

  return (
    <fetcher.Form
      {...getFormProps(deleteForm, {
        ariaDescribedBy: deleteForm.valid ? undefined : deleteForm.errorId,
      })}
      method="POST"
      className="gap-inherit flex flex-col"
    >
      <AuthenticityTokenInput />
      <FormError errors={deleteForm.errors} id={deleteForm.errorId} />
      <input
        {...getInputProps(deleteConnectionFieldset.name, {
          type: "hidden",
        })}
      />
      <ControlFieldInput
        helperText={
          <>
            To confirm, type &quot;
            <strong className="font-bold">
              {deleteConnectionFieldset.name.value}
            </strong>
            &quot; in the textbox above to delete this connection.
          </>
        }
        field={deleteBodyFieldset.nameConfirmation}
        label="Name Confirmation"
        type="text"
      />

      <Button
        type="submit"
        name={deleteFields.intent.name}
        value={INTENTS.delete}
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
        Remove Connection
      </Button>
    </fetcher.Form>
  );
}

export default function Route() {
  const connectionLoaderData = useRouteLoaderData<typeof connectionLoader>(
    "routes/orgs/$org_slug/settings/connections/$connection_id.edit",
  );
  const lastResult = useActionData<typeof action>();
  const navigation = useNavigation();
  const [open, setOpen] = useState(false);
  const [openDeleteConnection, setOpenDeleteConnection] = useState(false);
  const handleCloseDeleteConnection = useCallback(
    () => setOpenDeleteConnection(false),
    [],
  );
  const handleFinishDeleteConnection = useCallback(
    () => setOpenDeleteConnection(false),
    [],
  );

  const provider = connectionLoaderData?.connection.data_provider ?? "postgres";
  const providerName = capitalizeWord(provider);

  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    lastResult: navigation.state === "idle" ? lastResult : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue: {
      body: {
        connection: {
          ...connectionLoaderData?.connection,
          warehouse: undefined,
          type: "parameters",
          parameters: {
            port: getDefaultPort(
              connectionLoaderData?.connection.data_provider,
            ),
          },
          visibility:
            connectionLoaderData?.connection.visibility === "public"
              ? "on"
              : undefined,
        },
      },
    },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const bodyFieldset = fields.body.getFieldset();
  const connectionFieldset = bodyFieldset.connection.getFieldset();
  const parametersFieldset = connectionFieldset.parameters.getFieldset();

  return (
    <>
      <ActionForm
        {...getFormProps(form, {
          ariaDescribedBy: form.valid ? undefined : form.errorId,
        })}
        className="flex flex-col gap-4"
      >
        <input
          {...getInputProps(connectionFieldset.data_provider, {
            type: "hidden",
          })}
        />

        <div className="md:gap-inherit flex flex-col gap-2 md:flex-row">
          <Button
            type="submit"
            name={fields.intent.name}
            space="sm"
            intent="secondary"
            value={INTENTS.testExisting}
            iconRight={
              navigation.state === "submitting" &&
              navigation.formData?.get("intent") === INTENTS.testExisting ? (
                <Spinner
                  aria-label="Loading..."
                  className="size-4 animate-spin"
                  role="status"
                />
              ) : undefined
            }
          >
            Test Existing Connection
          </Button>
          <Button
            type="submit"
            space="sm"
            intent="secondary"
            name={fields.intent.name}
            value={INTENTS.importSchema}
            iconRight={
              navigation.state === "submitting" &&
              navigation.formData?.get("intent") === INTENTS.importSchema ? (
                <Spinner
                  aria-label="Loading..."
                  className="size-4 animate-spin"
                  role="status"
                />
              ) : undefined
            }
          >
            Re-Import Schema
          </Button>
        </div>

        <hr className="border-gray-300" />

        <h2 className="text-xl font-medium">Edit {providerName} Connection</h2>

        <FormError errors={form.errors} id={form.errorId} />

        <ControlFieldInput
          field={connectionFieldset.name}
          label="Name"
          type="text"
        />

        <div className="rounded-sm border border-gray-300 p-4">
          <details
            open={open}
            onToggle={() => setOpen((open) => !open)}
            className="gap-inherit flex flex-col space-y-4"
          >
            <summary>Change Connection</summary>

            <div className="flex flex-col gap-4">
              <ControlFieldSelect
                field={connectionFieldset.type}
                label="Connection Type"
                fullWidth
              >
                <option value="parameters">Parameters</option>
                <option value="connection_string">Connection String</option>
              </ControlFieldSelect>
              <fieldset
                {...getFieldsetProps(connectionFieldset.parameters)}
                disabled={
                  connectionFieldset.type.value !== "parameters" || !open
                }
                className="gap-inherit flex flex-col disabled:hidden"
              >
                <div className="gap-inherit flex flex-col md:flex-row">
                  <ControlFieldInput
                    autoCapitalize="none"
                    field={parametersFieldset.host}
                    fullWidth
                    label="Host"
                    type="text"
                  />
                  <ControlFieldInput
                    field={parametersFieldset.port}
                    fullWidth
                    label="Port"
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

                <div className="gap-inherit flex flex-col md:flex-row">
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
                {...getFieldsetProps(bodyFieldset.connection)}
                disabled={
                  connectionFieldset.type.value !== "connection_string" || !open
                }
                className="disabled:hidden"
              >
                <ControlFieldInput
                  autoCapitalize="none"
                  field={connectionFieldset.connection_string}
                  fullWidth
                  label="Connection String"
                  type="text"
                />

                {connectionFieldset.data_provider.value === "snowflake" && (
                  <ControlFieldInput
                    autoCapitalize="none"
                    autoComplete="off"
                    field={connectionFieldset.warehouse}
                    fullWidth
                    label="Warehouse"
                    type="text"
                  />
                )}
              </fieldset>

              <div className="gap-inherit flex flex-col md:flex-row">
                <Button
                  intent="secondary"
                  space="sm"
                  name={fields.intent.name}
                  type="submit"
                  value={INTENTS.testNew}
                  iconRight={
                    navigation.state === "submitting" &&
                    navigation.formData?.get("intent") === INTENTS.testNew ? (
                      <Spinner
                        aria-label="Loading..."
                        className="size-4 animate-spin"
                        role="status"
                      />
                    ) : undefined
                  }
                >
                  Test New Connection
                </Button>
              </div>
            </div>
          </details>
        </div>

        <ControlInlineFieldInput
          field={connectionFieldset.visibility}
          label="Make all of this connection's databases and queries available to the public?"
          type="checkbox"
        />

        <div className="md:gap-inherit flex flex-col gap-2 md:flex-row">
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
            Update Connection
          </Button>
          <Button
            intent="secondary"
            space="sm"
            type="button"
            onClick={() => setOpenDeleteConnection(true)}
          >
            Delete Connection
          </Button>
        </div>
      </ActionForm>

      <AlertDialog
        open={openDeleteConnection}
        onClose={handleCloseDeleteConnection}
      >
        <AlertDialogCloseButton aria-label="Close">
          <IconX className="stroke-1.5 size-5" />
        </AlertDialogCloseButton>
        <AlertDialogTitle>Delete Connection</AlertDialogTitle>
        <AlertDialogDescription>
          Are you sure you want to delete this connection?
        </AlertDialogDescription>

        <DeleteConnectionForm
          onFinish={handleFinishDeleteConnection}
          defaultValue={{
            body: connectionLoaderData,
          }}
        />
      </AlertDialog>
    </>
  );
}
