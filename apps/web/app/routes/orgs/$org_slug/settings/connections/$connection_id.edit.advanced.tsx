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
import { useCallback, useEffect, useId, useState } from "react";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  UIMatch,
} from "react-router";
import {
  data,
  redirect,
  redirectDocument,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useParams,
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
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";
import { Button } from "~/components/button";
import {
  ControlFieldInput,
  ControlFieldSelect,
} from "~/components/control-field";
import { FormError } from "~/components/form-error";
import {
  InlineField,
  InlineFieldInput,
  InlineFieldLabel,
} from "~/components/inline-field";
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
import { assertResponseParams, extractMessageOrThrow } from "~/utils/response";

export async function loader({ request, params }: LoaderFunctionArgs) {
  assertResponseParams(params, ["org_slug", "connection_id"]);
  const headers = mergeHeaders(
    getDefaultRequestHeaders(request),
    await getRequiredUserHeaders(request),
  );
  const {
    payload: { connection: parentConnection },
  } = await dataFnMiddleware(
    request,
    client.v2.getConnection({
      headers,
      params,
    }),
  ).then(extractMessageOrThrow("get_connection"));

  if (parentConnection.readonly_connection_id) {
    const {
      payload: { connection: readonlyConnection },
    } = await dataFnMiddleware(
      request,
      client.v2.getConnection({
        headers,
        params: {
          ...params,
          connection_id: parentConnection.readonly_connection_id,
        },
      }),
    ).then(extractMessageOrThrow("get_connection"));

    return { parentConnection, readonlyConnection };
  }

  return { parentConnection, readonlyConnection: null };
}

const INTENTS = {
  create: "create",
  delete: "delete",
  test: "test",
  testExisting: "testExisting",
  update: "update",
} as const;

const dataProviderSchema = z.enum(["postgres", "snowflake"]);

const visibilitySchema = z.enum(["private", "public"]);

const schema = z.discriminatedUnion("intent", [
  z.object({
    intent: z.literal(INTENTS.create),
    body: z.object({
      connection: z
        .discriminatedUnion("type", [
          z.object({
            type: z.literal("connection_string"),
            connection_string: z.string().min(1),
            data_provider: dataProviderSchema,
            name: z.string().min(1),
            visibility: visibilitySchema,
            warehouse: z.optional(z.string()),
            read_only: z.boolean(),
            parent_connection_id: z.string().min(1),
          }),
          z.object({
            type: z.literal("parameters"),
            data_provider: dataProviderSchema,
            name: z.string().min(1),
            visibility: visibilitySchema,
            read_only: z.boolean(),
            parent_connection_id: z.string().min(1),
            parameters: z.object({
              host: z.string().min(1),
              port: z.number().int().positive(),
              database: z.string().min(1),
              user: z.string().min(1),
              password: z.string().min(1),
              warehouse: z.optional(z.string()),
            }),
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
    intent: z.literal(INTENTS.delete),
    body: z
      .object({
        nameConfirmation: z.string().min(1),
        readonly_connection_id: z.string().min(1),
        connection: z.object({
          name: z.string().min(1),
        }),
      })
      .superRefine((body, ctx) => {
        if (body.nameConfirmation !== body.connection.name) {
          ctx.addIssue({
            code: "custom",
            message: "nameConfirmation does not match name",
            path: ["nameConfirmation"],
          });
        }
      }),
  }),
  z.object({
    intent: z.literal(INTENTS.test),
    body: z.object({
      connection: z
        .discriminatedUnion("type", [
          z.object({
            type: z.literal("connection_string"),
            data_provider: dataProviderSchema,
            connection_string: z.string().min(1),
            warehouse: z.optional(z.string()),
          }),
          z.object({
            type: z.literal("parameters"),
            data_provider: dataProviderSchema,
            parameters: z.object({
              host: z.string().min(1),
              port: z.number().int().positive(),
              database: z.string().min(1),
              user: z.string().min(1),
              password: z.string().min(1),
              warehouse: z.optional(z.string()),
            }),
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
    intent: z.literal(INTENTS.testExisting),
    body: z.object({
      readonly_connection_id: z.string().min(1),
    }),
  }),
  z.object({
    intent: z.literal(INTENTS.update),
    body: z.object({
      readonly_connection_id: z.string().min(1),
      connection: z
        .discriminatedUnion("type", [
          z.object({
            data_provider: dataProviderSchema,
            visibility: visibilitySchema,
            type: z.literal("parameters"),
            parameters: z
              .object({
                host: z.string().min(1),
                port: z.number().int().positive(),
                database: z.string().min(1),
                user: z.string().min(1),
                password: z.string().min(1),
                warehouse: z.optional(z.string()),
              })
              .optional(),
          }),
          z.object({
            type: z.literal("connection_string"),
            connection_string: z.string().min(1),
            data_provider: dataProviderSchema,
            visibility: visibilitySchema,
            warehouse: z.optional(z.string()),
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
          params: {
            ...params,
            connection_id: submission.value.body.readonly_connection_id,
          },
        }),
      );

      const message = await response.json();

      if (message.type !== "success") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirect(
        `/orgs/${params.org_slug}/settings/connections/${params.connection_id}/edit`,
        {
          headers: await setFlashHeaders({
            type: "success",
            message: "Read-only connection deleted successfully",
          }),
        },
      );
    }
    case INTENTS.test: {
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
    case INTENTS.testExisting: {
      const response = await dataFnMiddleware(
        request,
        client.v2.testOrganizationConnection({
          body: {
            type: "persisted",
            id: submission.value.body.readonly_connection_id,
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
        return submission.reply({ formErrors: ["Connection test failed"] });
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
          body: submission.value.body.connection,
          headers,
          params,
        }),
      );

      const message = await response.json();

      if (message.type !== "create_connection") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      return data(submission.reply({ resetForm: true }), {
        headers: await setFlashHeaders({
          type: "success",
          message: "Read-Only connection created successfully",
        }),
      });
    }
    case INTENTS.update: {
      const response = await dataFnMiddleware(
        request,
        client.v2.updateOrganizationConnection({
          body: submission.value.body.connection,
          headers,
          params: {
            ...params,
            connection_id: submission.value.body.readonly_connection_id,
          },
        }),
      );

      const message = await response.json();

      if (message.type !== "update_connection") {
        return submission.reply(errorMessageToReplyOptions(message));
      }

      throw redirectDocument(
        `/orgs/${params.org_slug}/settings/connections/${params.connection_id}/edit/advanced`,
        {
          headers: await setFlashHeaders({
            type: "success",
            message: "Read-Only connection updated successfully",
          }),
        },
      );
    }
    default: {
      return submission.reply(errorMessageToReplyOptions(generalErrorMessage));
    }
  }
}

export const handle = {
  breadcrumb(match: UIMatch) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        Advanced
      </BreadcrumbNavLink>
    );
  },
};

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
  const bodyConnectionFieldset = bodyFieldset.connection.getFieldset();

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

      <input
        {...getInputProps(bodyConnectionFieldset.name, {
          type: "hidden",
        })}
      />
      <input
        {...getInputProps(bodyFieldset.readonly_connection_id, {
          type: "hidden",
        })}
      />
      <ControlFieldInput
        field={bodyFieldset.nameConfirmation}
        label="Name Confirmation"
        type="text"
        helperText={
          <>
            To confirm, type &quot;
            <strong className="font-bold">
              {bodyFieldset.connection.getFieldset().name.value}
            </strong>
            &quot; in the textbox above to delete this connection.
          </>
        }
      />

      <Button
        type="submit"
        name={fields.intent.name}
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
  const enableSqlTerminalId = useId();
  const loaderData = useLoaderData<typeof loader>();
  const lastResult = useActionData<typeof action>();
  const navigation = useNavigation();
  const params = useParams();
  const [openDeleteConnection, setOpenDeleteConnection] = useState(false);
  const handleCloseDeleteConnection = useCallback(
    () => setOpenDeleteConnection(false),
    [],
  );
  const handleFinishDeleteConnection = useCallback(
    () => setOpenDeleteConnection(false),
    [],
  );

  const hasExistingReadOnlyConnection = !!loaderData.readonlyConnection;

  const [showReadOnlyConnectionForm, setShowReadOnlyConnectionForm] = useState(
    hasExistingReadOnlyConnection,
  );

  const toggleReadOnlyConnectionForm = () => {
    setShowReadOnlyConnectionForm(!showReadOnlyConnectionForm);
  };

  const [form, fields] = useForm({
    lastResult: navigation.state === "idle" ? lastResult : undefined,
    id: loaderData.readonlyConnection?.id,
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue: {
      body: {
        readonly_connection_id: loaderData.readonlyConnection?.id,
        connection: {
          ...loaderData.readonlyConnection,
          warehouse: undefined,
          data_provider: loaderData.parentConnection.data_provider,
          name: loaderData.readonlyConnection?.name ?? "readonly connection",
          parent_connection_id:
            loaderData.parentConnection.id ?? params.connection_id,
          read_only: true,
          type: "parameters",
          visibility: "private",
          parameters: {
            port: getDefaultPort(loaderData.parentConnection.data_provider),
          },
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
          {...getInputProps(connectionFieldset.name, { type: "hidden" })}
        />
        <input
          {...getInputProps(connectionFieldset.parent_connection_id, {
            type: "hidden",
          })}
        />
        <input
          {...getInputProps(connectionFieldset.read_only, {
            type: "hidden",
          })}
        />
        <input
          {...getInputProps(connectionFieldset.visibility, {
            type: "hidden",
          })}
        />
        <input
          {...getInputProps(connectionFieldset.data_provider, {
            type: "hidden",
          })}
        />

        <InlineField
          label={
            <InlineFieldLabel htmlFor={enableSqlTerminalId}>
              Enable a SQL terminal via a read-only user?
            </InlineFieldLabel>
          }
        >
          <InlineFieldInput
            type="checkbox"
            id={enableSqlTerminalId}
            defaultChecked={showReadOnlyConnectionForm}
            disabled={hasExistingReadOnlyConnection}
            onChange={toggleReadOnlyConnectionForm}
          />
        </InlineField>

        {showReadOnlyConnectionForm ? (
          <>
            <FormError errors={form.errors} id={form.errorId} />

            {hasExistingReadOnlyConnection ? (
              <>
                <input
                  {...getInputProps(bodyFieldset.readonly_connection_id, {
                    type: "hidden",
                  })}
                />
                <details className="space-y-4 rounded-sm border border-gray-300 p-4">
                  <summary>Change Connection</summary>
                  <div className="flex flex-col gap-4">
                    <ControlFieldSelect
                      fullWidth
                      field={connectionFieldset.type}
                      label="Connection Type"
                    >
                      <option value="parameters">Parameters</option>
                      <option value="connection_string">
                        Connection String
                      </option>
                    </ControlFieldSelect>

                    <fieldset
                      {...getFieldsetProps(connectionFieldset.parameters)}
                      disabled={connectionFieldset.type.value !== "parameters"}
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
                          fullWidth
                          field={parametersFieldset.port}
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
                      {connectionFieldset.data_provider.value ===
                        "snowflake" && (
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
                      disabled={
                        connectionFieldset.type.value !== "connection_string"
                      }
                      className="gap-inherit flex flex-col disabled:hidden"
                    >
                      <ControlFieldInput
                        autoCapitalize="none"
                        field={connectionFieldset.connection_string}
                        fullWidth
                        label="Connection String"
                        type="text"
                      />

                      {connectionFieldset.data_provider.value ===
                        "snowflake" && (
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

                    <div className="md:gap-inherit flex flex-col gap-2 md:flex-row">
                      <Button
                        type="submit"
                        name={fields.intent.name}
                        value={
                          loaderData.readonlyConnection
                            ? INTENTS.update
                            : INTENTS.create
                        }
                        space="sm"
                        iconRight={
                          navigation.state === "submitting" &&
                          navigation.formData?.get("intent") ===
                            INTENTS.create ? (
                            <Spinner
                              aria-label="Loading..."
                              className="size-4 animate-spin"
                              role="status"
                            />
                          ) : undefined
                        }
                      >
                        {loaderData.readonlyConnection ? "Update" : "Create"}{" "}
                        Connection
                      </Button>
                      <Button
                        type="submit"
                        name={fields.intent.name}
                        intent="secondary"
                        space="sm"
                        value={INTENTS.test}
                        iconRight={
                          navigation.state === "submitting" &&
                          navigation.formData?.get("intent") ===
                            INTENTS.test ? (
                            <Spinner
                              aria-label="Loading..."
                              className="size-4 animate-spin"
                              role="status"
                            />
                          ) : undefined
                        }
                      >
                        Test Connection
                      </Button>
                    </div>
                  </div>
                </details>
                {loaderData.readonlyConnection ? (
                  <div className="md:gap-inherit flex flex-col gap-2 md:flex-row">
                    <Button
                      type="button"
                      space="sm"
                      intent="secondary"
                      onClick={() => setOpenDeleteConnection(true)}
                    >
                      Delete Connection
                    </Button>
                    <Button
                      type="submit"
                      form={form.id}
                      space="sm"
                      intent="secondary"
                      name={fields.intent.name}
                      value={INTENTS.testExisting}
                      iconRight={
                        navigation.state === "submitting" &&
                        navigation.formData?.get("intent") ===
                          INTENTS.testExisting ? (
                          <Spinner
                            aria-label="Loading..."
                            className="size-4 animate-spin"
                            role="status"
                          />
                        ) : undefined
                      }
                    >
                      Test Connection
                    </Button>
                  </div>
                ) : undefined}
              </>
            ) : (
              <div className="gap-inherit flex flex-col rounded-sm border border-gray-300 p-4 pb-6">
                <ControlFieldSelect
                  fullWidth
                  field={connectionFieldset.type}
                  label="Connection Type"
                >
                  <option value="parameters">Parameters</option>
                  <option value="connection_string">Connection String</option>
                </ControlFieldSelect>

                <fieldset
                  {...getFieldsetProps(connectionFieldset.parameters)}
                  disabled={connectionFieldset.type.value !== "parameters"}
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
                      fullWidth
                      field={parametersFieldset.port}
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
                      fullWidth
                      field={parametersFieldset.password}
                      label="Password"
                      type="password"
                      autoComplete="off"
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
                    connectionFieldset.type.value !== "connection_string"
                  }
                  className="gap-inherit flex flex-col disabled:hidden"
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
                    type="submit"
                    name={fields.intent.name}
                    value={
                      loaderData.readonlyConnection
                        ? INTENTS.update
                        : INTENTS.create
                    }
                    space="sm"
                    iconRight={
                      navigation.state === "submitting" &&
                      navigation.formData?.get("intent") === INTENTS.create ? (
                        <Spinner
                          aria-label="Loading..."
                          className="size-4 animate-spin"
                          role="status"
                        />
                      ) : undefined
                    }
                  >
                    {loaderData.readonlyConnection ? "Update" : "Create"}{" "}
                    Connection
                  </Button>
                  <Button
                    intent="secondary"
                    name={fields.intent.name}
                    type="submit"
                    value={INTENTS.test}
                    space="sm"
                    iconRight={
                      navigation.state === "submitting" &&
                      navigation.formData?.get("intent") === INTENTS.test ? (
                        <Spinner
                          aria-label="Loading..."
                          className="size-4 animate-spin"
                          role="status"
                        />
                      ) : undefined
                    }
                  >
                    Test Connection
                  </Button>
                </div>
              </div>
            )}
          </>
        ) : null}
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
          Are you sure you want to delete this read-only connection?
        </AlertDialogDescription>

        <DeleteConnectionForm
          onFinish={handleFinishDeleteConnection}
          defaultValue={{
            body: {
              readonly_connection_id: loaderData.readonlyConnection?.id,
              connection: {
                ...loaderData.readonlyConnection,
                name:
                  loaderData.readonlyConnection?.name ?? "readonly connection",
                read_only: true,
                visibility: "private",
                data_provider: loaderData.parentConnection.data_provider,
                parent_connection_id:
                  loaderData.parentConnection.id ?? params.connection_id,
              },
            },
          }}
        />
      </AlertDialog>
    </>
  );
}
