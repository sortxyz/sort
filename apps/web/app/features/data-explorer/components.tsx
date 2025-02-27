import type { SubmissionResult } from "@conform-to/react";
import {
  getCollectionProps,
  getFieldsetProps,
  getFormProps,
  getInputProps,
  useForm,
} from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import type { Json, V2 } from "@sort/sdk";
import {
  IconArrowsSort,
  IconCopy,
  IconDownload,
  IconFilter,
  IconGitPullRequest,
  IconGripVertical,
  IconInfoCircle,
  IconPlus,
  IconReportSearch,
  IconRotate2,
  IconRotateClockwise2,
  IconSortAscending,
  IconSortDescending,
  IconSparkles,
  IconTicket,
  IconTrash,
  IconX,
  IconZoomReset,
} from "@tabler/icons-react";
import clsx from "clsx";
import {
  forwardRef,
  Fragment,
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BlockerFunction } from "react-router";
import {
  Form,
  useBlocker,
  useLocation,
  useNavigate,
  useNavigation,
} from "react-router";
import type { z } from "zod";
import { ActionForm } from "~/components/action-form";
import {
  AlertDialog,
  AlertDialogCloseButton,
  AlertDialogDescription,
  AlertDialogTitle,
} from "~/components/alert-dialog";
import { Button, LinkButton } from "~/components/button";
import {
  ControlFieldInput,
  ControlFieldSelect,
} from "~/components/control-field";
import { ControlMarkdownFieldTextarea } from "~/components/control-markdown-field";
import { ControlSqlField } from "~/components/control-sql-field";
import {
  Divtable,
  DivtableCell,
  DivtableColumnheader,
  DivtableTbody,
  DivtableTbodyRow,
  DivtableThead,
  DivtableTheadRow,
} from "~/components/divtable";
import {
  FormDrawer,
  FormDrawerFooter,
  FormDrawerHeader,
  FormDrawerSection,
} from "~/components/form-drawer";
import { FormError } from "~/components/form-error";
import { Indicator } from "~/components/indicator";
import {
  InlineField,
  InlineFieldInput,
  InlineFieldLabel,
} from "~/components/inline-field";
import { Spinner } from "~/components/spinner";
import { Tabs, TabsList, TabsListTab, TabsPanel } from "~/components/tabs";
import type { ClipboardTextState } from "~/hooks/use-clipboard-text";
import { useClipboardText } from "~/hooks/use-clipboard-text";
import { useUndoRedo } from "~/hooks/use-undo-redo";
import { useUpdateEffect } from "~/hooks/use-update-effect";
import { DescribeChangesFormDrawer } from "~/routes/orgs/$org_slug/databases/$database_slug/explorer/describe";
import type { ChangeInput } from "~/schemas/change";
import type { buildRunQueryIntentSchema } from "~/schemas/query";
import type { SessionData } from "~/services/session.server";
import { orderDirectionToAriaSort } from "~/utils/aria";
import { updateItemAtIndex } from "~/utils/array";
import { difference } from "~/utils/set";
import { pluralize, stringifyCSV } from "~/utils/string";
import { INTENTS, schema } from "./utils";

type Query = z.output<ReturnType<typeof buildRunQueryIntentSchema>>["query"];

const DEFAULT_COLUMN_SIZE = 200;
const MAX_COLUMN_SIZE = Number.MAX_SAFE_INTEGER;
const MIN_COLUMN_SIZE = 80;
const SCROLLBAR_WIDTH = 15;
const SELECT_ROW_COLUMN_SIZE = 64;

function validateCell(value: string, column: V2.Column) {
  if (value.toUpperCase() === "NULL") {
    return column.nullable;
  }
  switch (column.type) {
    case "binary":
      try {
        atob(value);
        return true;
      } catch {
        return false;
      }
    case "boolean":
      return ["TRUE", "FALSE"].includes(value.toUpperCase());
    case "date":
      return String(new Date(value)) !== "Invalid Date";
    case "json":
      try {
        JSON.parse(value);
        return true;
      } catch {
        return false;
      }
    case "numeric":
      return value.trim() !== "" && Number.isFinite(Number(value));
    case "uuid":
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      );
    default:
      return true;
  }
}

function getCellErrorMessage(_value: string, column: V2.Column) {
  switch (column.type) {
    case "binary":
      return "Invalid base64 value";
    case "date":
      return "Invalid date";
    case "json":
      return "Invalid JSON";
    case "numeric":
      return "Invalid number";
    case "uuid":
      return "Invalid UUID";
    case "boolean":
      return "Invalid boolean value";
    default:
      return "Invalid value";
  }
}

function DataExplorerTableColumnheaderResizer({
  onResizeColumn,
  columnIndex,
  value,
}: {
  onResizeColumn: (size: number, columnIndex: number) => void;
  columnIndex: number;
  value: number;
}) {
  const handlePointerDown = useCallback<
    React.PointerEventHandler<HTMLButtonElement>
  >(
    (event) => {
      const startX = event.pageX;
      const startWidth =
        Number(event.currentTarget.getAttribute("aria-valuenow")) || 0;

      const handlePointerMove: (event: PointerEvent) => void = (event) => {
        const diff = event.pageX - startX;
        const newWidth = Math.max(
          MIN_COLUMN_SIZE,
          Math.min(MAX_COLUMN_SIZE, startWidth + diff),
        );

        onResizeColumn(newWidth, columnIndex);
      };

      const handlePointerUp = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };

      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    },
    [onResizeColumn, columnIndex],
  );

  const handleKeyDown = useCallback<
    React.KeyboardEventHandler<HTMLButtonElement>
  >(
    (event) => {
      const currentValue =
        Number(event.currentTarget.getAttribute("aria-valuenow")) || 0;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onResizeColumn(
          Math.max(MIN_COLUMN_SIZE, currentValue - 10),
          columnIndex,
        );
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        onResizeColumn(
          Math.min(MAX_COLUMN_SIZE, currentValue + 10),
          columnIndex,
        );
      }
    },
    [onResizeColumn, columnIndex],
  );

  return (
    <button
      aria-label="Resize Column"
      role="slider"
      aria-valuenow={value}
      aria-valuemin={MIN_COLUMN_SIZE}
      aria-valuemax={MAX_COLUMN_SIZE}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      className={clsx(
        "-my-4 -mr-2 -ml-4 inline-flex size-10 shrink-0 cursor-col-resize touch-none items-center justify-center text-center text-xs select-none",
      )}
    >
      <IconGripVertical className="stroke-1.5 size-4" />
    </button>
  );
}

function IntentQueryFormDrawerFiltersForm({
  onClose,
  lastResult,
  query,
  columns,
  schema,
}: {
  onClose?: () => void;
  lastResult?: SubmissionResult<string[]> | null | undefined;
  query: Query;
  columns: V2.Column[];
  schema: ReturnType<typeof buildRunQueryIntentSchema>;
}) {
  const navigation = useNavigation();
  const [form, fields] = useForm<
    z.output<ReturnType<typeof buildRunQueryIntentSchema>>
  >({
    lastResult,
    defaultValue: {
      query,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, {
        schema,
      });
    },
  });

  useEffect(() => {
    if (navigation.state === "loading") {
      return () => {
        onClose?.();
      };
    }
  }, [navigation, onClose]);

  const queryFieldset = fields.query.getFieldset();
  const queryIntentFieldset = queryFieldset.intent.getFieldset();
  const queryIntentOrdersFieldList = queryIntentFieldset.orders.getFieldList();
  const queryIntentFiltersFieldList =
    queryIntentFieldset.filters.getFieldList();
  const queryIntentColumnsFieldList =
    queryIntentFieldset.columns.getFieldList();

  return (
    <Form {...getFormProps(form)} className="contents">
      <FormDrawerSection>
        <FormError errors={form.errors} id={form.errorId} />
        <div className="flex flex-col gap-3">
          <FormError errors={form.errors} id={form.errorId} />
          <input {...getInputProps(queryFieldset.type, { type: "hidden" })} />
          <input {...getInputProps(queryFieldset.name, { type: "hidden" })} />
          <input
            {...getInputProps(queryFieldset.description, { type: "hidden" })}
          />
          <input
            {...getInputProps(queryIntentFieldset.dml, { type: "hidden" })}
          />
          <ControlFieldSelect
            label="Combinator"
            field={queryIntentFieldset.combinator}
          >
            <option>AND</option>
            <option>OR</option>
          </ControlFieldSelect>
          <ControlFieldInput
            field={queryIntentFieldset.limit}
            type="number"
            label="Limit"
          />
          <input
            {...getInputProps(queryIntentFieldset.schema, { type: "hidden" })}
          />
          <input
            {...getInputProps(queryIntentFieldset.table, { type: "hidden" })}
          />
          {queryIntentColumnsFieldList.map((field) => (
            <input
              {...getInputProps(field, { type: "hidden" })}
              key={field.key}
            />
          ))}
          {queryIntentOrdersFieldList.map((field) => {
            const fieldset = field.getFieldset();
            return (
              <fieldset
                {...getFieldsetProps(field)}
                key={field.key}
                className="contents"
              >
                <input
                  {...getInputProps(fieldset.column, { type: "hidden" })}
                />
                <input
                  {...getInputProps(fieldset.direction, { type: "hidden" })}
                />
              </fieldset>
            );
          })}
          <div className="flex items-center gap-2">
            <h3 className="grow text-sm font-medium text-gray-900">Filters</h3>
            <Button
              type="submit"
              iconLeft={<IconPlus className="stroke-1.5 size-3.5" />}
              space="xs"
              intent="tertiary"
              {...form.insert.getButtonProps({
                name: queryIntentFieldset.filters.name,
                defaultValue: {
                  column: "",
                  op: "=",
                  value: "",
                },
              })}
            >
              Add Filter
            </Button>
          </div>
          <fieldset
            {...getFieldsetProps(queryIntentFieldset.filters)}
            className="flex flex-col gap-3 py-3"
          >
            {queryIntentFiltersFieldList.map((field, index) => {
              const fieldset = field.getFieldset();

              return (
                <fieldset
                  {...getFieldsetProps(field)}
                  key={field.key}
                  className="flex flex-col gap-3"
                >
                  <ControlFieldSelect
                    field={fieldset.column}
                    label="Column"
                    labelCueRight={
                      <button
                        className="inline-flex"
                        title="Remove Filter"
                        {...form.remove.getButtonProps({
                          index,
                          name: queryIntentFieldset.filters.name,
                        })}
                      >
                        <IconX className="stroke-1.5 size-4" />
                      </button>
                    }
                  >
                    {columns.map((column) => (
                      <option key={column.name}>{column.name}</option>
                    ))}
                  </ControlFieldSelect>
                  <ControlFieldSelect field={fieldset.op} label="Operator">
                    <option>=</option>
                    <option>!=</option>
                    <option>{">"}</option>
                    <option>{"<"}</option>
                    <option>{">="}</option>
                    <option>{"<="}</option>
                  </ControlFieldSelect>
                  <ControlFieldInput
                    autoCapitalize="none"
                    autoComplete="off"
                    field={fieldset.value}
                    label="Value"
                    type="text"
                  />
                </fieldset>
              );
            })}
          </fieldset>
        </div>
      </FormDrawerSection>
      <FormDrawerFooter>
        <div className="flex gap-2">
          <Button
            space="sm"
            fullWidth
            type="submit"
            name={fields.intent.name}
            value={INTENTS.runQuery}
            iconRight={
              navigation.state === "submitting" ? (
                <Spinner
                  aria-label="Loading..."
                  className="size-4 animate-spin"
                  role="status"
                />
              ) : undefined
            }
          >
            Update
          </Button>
          <Button
            space="sm"
            fullWidth
            type="button"
            intent="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </FormDrawerFooter>
    </Form>
  );
}

function IntentQueryFormDrawerColumnsForm({
  onClose,
  query,
  lastResult,
  columns,
  schema,
}: {
  onClose?: () => void;
  query: Query;
  lastResult?: SubmissionResult<string[]> | null | undefined;
  columns: V2.Column[];
  schema: ReturnType<typeof buildRunQueryIntentSchema>;
}) {
  const navigation = useNavigation();
  const [form, fields] = useForm<
    z.output<ReturnType<typeof buildRunQueryIntentSchema>>
  >({
    lastResult,
    defaultValue: {
      query,
    },
    onValidate({ formData }) {
      return parseWithZod(formData, {
        schema,
      });
    },
  });

  useEffect(() => {
    if (navigation.state === "loading") {
      return () => {
        onClose?.();
      };
    }
  }, [navigation, onClose]);

  const queryFieldset = fields.query.getFieldset();
  const queryIntentFieldset = queryFieldset.intent.getFieldset();
  const queryIntentOrdersFieldList = queryIntentFieldset.orders.getFieldList();
  const queryIntentFiltersFieldList =
    queryIntentFieldset.filters.getFieldList();

  return (
    <Form {...getFormProps(form)} className="contents">
      <FormDrawerSection>
        <div className="flex flex-col gap-3">
          <input {...getInputProps(queryFieldset.type, { type: "hidden" })} />
          <input {...getInputProps(queryFieldset.name, { type: "hidden" })} />
          <input
            {...getInputProps(queryFieldset.description, { type: "hidden" })}
          />
          <input
            {...getInputProps(queryIntentFieldset.combinator, {
              type: "hidden",
            })}
          />
          <input
            {...getInputProps(queryIntentFieldset.dml, { type: "hidden" })}
          />
          <input
            {...getInputProps(queryIntentFieldset.limit, { type: "hidden" })}
          />
          <input
            {...getInputProps(queryIntentFieldset.schema, { type: "hidden" })}
          />
          <input
            {...getInputProps(queryIntentFieldset.table, { type: "hidden" })}
          />
          {queryIntentOrdersFieldList.map((field) => {
            const fieldset = field.getFieldset();
            return (
              <fieldset
                {...getFieldsetProps(field)}
                key={field.key}
                className="contents"
              >
                <input
                  {...getInputProps(fieldset.column, { type: "hidden" })}
                />
                <input
                  {...getInputProps(fieldset.direction, { type: "hidden" })}
                />
              </fieldset>
            );
          })}
          {queryIntentFiltersFieldList.map((field) => {
            const fieldset = field.getFieldset();
            return (
              <fieldset
                {...getFieldsetProps(field)}
                key={field.key}
                className="contents"
              >
                <input
                  {...getInputProps(fieldset.column, { type: "hidden" })}
                />
                <input {...getInputProps(fieldset.op, { type: "hidden" })} />
                <input {...getInputProps(fieldset.value, { type: "hidden" })} />
              </fieldset>
            );
          })}

          {getCollectionProps(queryIntentFieldset.columns, {
            options: columns.map((c) => c.name),
            type: "checkbox",
          }).map(({ key, ...props }) => (
            <InlineField
              key={key}
              label={
                <InlineFieldLabel htmlFor={props.id}>
                  {props.value}
                </InlineFieldLabel>
              }
            >
              <InlineFieldInput {...props} />
            </InlineField>
          ))}
        </div>
      </FormDrawerSection>
      <FormDrawerFooter>
        <div className="flex gap-2">
          <Button
            fullWidth
            type="submit"
            space="sm"
            name={fields.intent.name}
            value={INTENTS.runQuery}
            iconRight={
              navigation.state === "submitting" ? (
                <Spinner
                  aria-label="Loading..."
                  className="size-4 animate-spin"
                  role="status"
                />
              ) : undefined
            }
          >
            Update
          </Button>
          <Button
            fullWidth
            space="sm"
            type="button"
            intent="secondary"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </FormDrawerFooter>
    </Form>
  );
}

function IntentQueryFormDrawer({
  lastResult,
  query,
  columns,
  schema,
  ...props
}: React.ComponentPropsWithoutRef<typeof FormDrawer> & {
  lastResult?: SubmissionResult<string[]> | null | undefined;
  query: Query;
  columns: V2.Column[];
  schema: ReturnType<typeof buildRunQueryIntentSchema>;
}) {
  return (
    <FormDrawer {...props}>
      <Tabs asTabs defaultSelectedIndex={0}>
        <FormDrawerHeader layout="tabs">
          <TabsList aria-label="Intent Settings">
            <TabsListTab index={0}>Filters</TabsListTab>
            <TabsListTab index={1}>Columns</TabsListTab>
          </TabsList>
        </FormDrawerHeader>
        <TabsPanel index={0}>
          <IntentQueryFormDrawerFiltersForm
            schema={schema}
            onClose={props.onClose}
            lastResult={lastResult}
            query={query}
            columns={columns}
          />
        </TabsPanel>
        <TabsPanel index={1}>
          <IntentQueryFormDrawerColumnsForm
            schema={schema}
            onClose={props.onClose}
            lastResult={lastResult}
            query={query}
            columns={columns}
          />
        </TabsPanel>
      </Tabs>
    </FormDrawer>
  );
}

const CellInput = forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<"input"> &
    Partial<Record<"data-created" | "data-dirty" | "data-deleted", boolean>> & {
      column: V2.Column;
    }
>(function CellInput({ column, ...props }, ref) {
  const listId = useId();
  const shouldRenderDataList = column.nullable || column.type === "boolean";

  return (
    <>
      <input
        {...props}
        ref={ref}
        className={clsx(
          "h-7 w-full appearance-none truncate rounded-none px-3 py-2 text-base invalid:bg-red-50 focus:outline focus:outline-blue-500 sm:text-sm",
          {
            "bg-green-50": props["data-created"],
            "bg-yellow-50": props["data-dirty"],
            "bg-transparent": !props["data-created"] && !props["data-dirty"],
            "italic line-through": props["data-deleted"],
          },
        )}
        list={shouldRenderDataList ? listId : undefined}
        type="text"
      />
      {shouldRenderDataList ? (
        <datalist id={listId}>
          {column.nullable ? <option value="NULL" /> : undefined}
          {column.type === "boolean" ? <option value="TRUE" /> : undefined}
          {column.type === "boolean" ? <option value="FALSE" /> : undefined}
        </datalist>
      ) : undefined}
    </>
  );
});

function QueryForm({
  onCancel,
  lastResult,
  query,
  viewer,
}: {
  onCancel: () => void;
  lastResult?: SubmissionResult<string[]> | null | undefined;
  query: Query;
  viewer: SessionData["user"] | undefined;
}) {
  const queryHasOwner = !!query.created_by;
  const isQueryOwner = query.created_by === viewer?.sortProfile.id;

  const navigation = useNavigation();

  const [form, fields] = useForm<
    z.input<typeof schema>,
    z.output<typeof schema>
  >({
    constraint: getZodConstraint(schema),
    lastResult: navigation.state === "idle" ? lastResult : undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue: { query, title: query.name, description: query.description },
    shouldRevalidate: "onInput",
    shouldValidate: "onBlur",
  });

  const intent = isQueryOwner ? INTENTS.updateQuery : INTENTS.createQuery;

  const queryFieldset = fields.query.getFieldset();
  const queryIntentFieldset = queryFieldset.intent.getFieldset();
  const queryIntentFiltersFieldList =
    queryIntentFieldset.filters.getFieldList();
  const queryIntentOrdersFieldList = queryIntentFieldset.orders.getFieldList();
  const queryIntentColumnsFieldList =
    queryIntentFieldset.columns.getFieldList();

  return (
    <ActionForm
      {...getFormProps(form, {
        ariaDescribedBy: form.valid ? undefined : form.errorId,
      })}
      method="POST"
      className="contents"
    >
      <input {...getInputProps(queryFieldset.type, { type: "hidden" })} />
      <input {...getInputProps(queryFieldset.sql, { type: "hidden" })} />
      <input
        {...getInputProps(queryIntentFieldset.combinator, {
          type: "hidden",
        })}
      />
      <input {...getInputProps(queryIntentFieldset.dml, { type: "hidden" })} />
      <input
        {...getInputProps(queryIntentFieldset.limit, {
          type: "hidden",
        })}
      />
      <input
        {...getInputProps(queryIntentFieldset.schema, {
          type: "hidden",
        })}
      />
      <input
        {...getInputProps(queryIntentFieldset.table, {
          type: "hidden",
        })}
      />
      {queryIntentFiltersFieldList.map((filterField) => {
        const filterFieldset = filterField.getFieldset();
        return (
          <Fragment key={filterField.key}>
            <input
              {...getInputProps(filterFieldset.column, {
                type: "hidden",
              })}
            />
            <input
              {...getInputProps(filterFieldset.op, {
                type: "hidden",
              })}
            />
            <input
              {...getInputProps(filterFieldset.value, {
                type: "hidden",
              })}
            />
          </Fragment>
        );
      })}
      {queryIntentOrdersFieldList.map((orderField) => {
        const orderFieldset = orderField.getFieldset();
        return (
          <Fragment key={orderField.key}>
            <input
              {...getInputProps(orderFieldset.column, {
                type: "hidden",
              })}
            />
            <input
              {...getInputProps(orderFieldset.direction, {
                type: "hidden",
              })}
            />
          </Fragment>
        );
      })}
      {queryIntentColumnsFieldList.map((columnField) => {
        return (
          <input
            {...getInputProps(columnField, {
              type: "hidden",
            })}
            key={columnField.key}
          />
        );
      })}
      <FormDrawerHeader>
        <h3 className="text-lg font-semibold">
          {queryHasOwner
            ? isQueryOwner
              ? "Update Query"
              : "Copy Query"
            : "Save Query"}
        </h3>
      </FormDrawerHeader>
      <FormDrawerSection>
        <FormError errors={form.errors} id={form.errorId} />

        <fieldset className="flex flex-col gap-4 py-4">
          <ControlFieldInput
            field={queryFieldset.name}
            label="Name"
            type="text"
          />
          <ControlMarkdownFieldTextarea
            field={queryFieldset.description}
            label="Description"
          />
        </fieldset>
      </FormDrawerSection>
      <FormDrawerFooter>
        <div className="flex gap-2">
          <Button
            type="submit"
            fullWidth
            space="sm"
            name={fields.intent.name}
            value={intent}
            iconRight={
              navigation.state === "submitting" &&
              navigation.formData?.get("intent") === intent ? (
                <Spinner
                  aria-label="Loading..."
                  className="size-4 animate-spin"
                  role="status"
                />
              ) : undefined
            }
          >
            {queryHasOwner
              ? isQueryOwner
                ? "Update Query"
                : "Copy Query"
              : "Save Query"}
          </Button>
          <Button
            type="button"
            space="sm"
            fullWidth
            intent="secondary"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
      </FormDrawerFooter>
    </ActionForm>
  );
}

function DataExplorerTableColumnheaderTitleForm({
  defaultValue,
  lastResult,
  schema,
  column,
  orderDirection,
}: {
  column: V2.Column;
  query: Extract<Query, { type: "intent" }>;
  lastResult?: SubmissionResult<string[]> | null | undefined;
  orderDirection?: "ASC" | "DESC";
  schema: ReturnType<typeof buildRunQueryIntentSchema>;
  defaultValue: z.output<ReturnType<typeof buildRunQueryIntentSchema>>;
}) {
  const [form, fields] = useForm({
    lastResult,
    defaultValue,
    onValidate({ formData }) {
      return parseWithZod(formData, {
        schema,
      });
    },
  });

  useUpdateEffect(() => {
    form.update({ value: defaultValue });
  }, [defaultValue]);

  const queryFieldset = fields.query.getFieldset();
  const queryIntentFieldset = queryFieldset.intent.getFieldset();
  const queryIntentOrdersFieldList = queryIntentFieldset.orders.getFieldList();
  const queryIntentFiltersFieldList =
    queryIntentFieldset.filters.getFieldList();
  const queryIntentColumnsFieldList =
    queryIntentFieldset.columns.getFieldList();

  return (
    <Form {...getFormProps(form)} className="contents">
      <input {...getInputProps(queryFieldset.type, { type: "hidden" })} />
      <input {...getInputProps(queryFieldset.name, { type: "hidden" })} />
      <input
        {...getInputProps(queryFieldset.description, { type: "hidden" })}
      />
      <input
        {...getInputProps(queryIntentFieldset.combinator, { type: "hidden" })}
      />
      <input {...getInputProps(queryIntentFieldset.dml, { type: "hidden" })} />
      <input
        {...getInputProps(queryIntentFieldset.limit, { type: "hidden" })}
      />
      <input
        {...getInputProps(queryIntentFieldset.schema, { type: "hidden" })}
      />
      <input
        {...getInputProps(queryIntentFieldset.table, { type: "hidden" })}
      />
      {queryIntentColumnsFieldList.map((field) => (
        <input {...getInputProps(field, { type: "hidden" })} key={field.key} />
      ))}
      {queryIntentOrdersFieldList.map((field) => {
        const fieldset = field.getFieldset();
        return (
          <fieldset
            {...getFieldsetProps(field)}
            key={field.key}
            className="contents"
          >
            <input {...getInputProps(fieldset.column, { type: "hidden" })} />
            <input {...getInputProps(fieldset.direction, { type: "hidden" })} />
          </fieldset>
        );
      })}
      {queryIntentFiltersFieldList.map((field) => {
        const fieldset = field.getFieldset();
        return (
          <fieldset
            {...getFieldsetProps(field)}
            key={field.key}
            className="contents"
          >
            <input {...getInputProps(fieldset.column, { type: "hidden" })} />
            <input {...getInputProps(fieldset.op, { type: "hidden" })} />
            <input {...getInputProps(fieldset.value, { type: "hidden" })} />
          </fieldset>
        );
      })}
      <button
        name={fields.intent.name}
        className="flex grow items-center gap-1 select-none"
        type="submit"
        value={INTENTS.runQuery}
      >
        <span className="w-0 grow overflow-hidden text-left text-ellipsis">
          {column.name}
        </span>
        <span className="shrink overflow-hidden text-right text-[9px] leading-none text-ellipsis text-gray-500 uppercase">
          {column.type}
        </span>
        {orderDirection ? (
          orderDirection === "DESC" ? (
            <IconSortDescending className="stroke-1.5 size-4" />
          ) : (
            <IconSortAscending className="stroke-1.5 size-4" />
          )
        ) : (
          <IconArrowsSort className="stroke-1.5 size-4" />
        )}
      </button>
    </Form>
  );
}

function DataExplorerTableColumnheaderTitle({
  column,
  query,
  schema,
  orderDirection,
}: {
  column: V2.Column;
  query: Query;
  schema: ReturnType<typeof buildRunQueryIntentSchema>;
  orderDirection: "ASC" | "DESC" | undefined;
}) {
  switch (query.type) {
    case "intent": {
      return (
        <DataExplorerTableColumnheaderTitleForm
          schema={schema}
          column={column}
          query={query}
          orderDirection={orderDirection}
          key={orderDirection}
          defaultValue={{
            intent: INTENTS.runQuery,
            query: {
              ...query,
              intent: {
                ...query.intent,
                orders: orderDirection
                  ? orderDirection === "DESC"
                    ? query.intent.orders.filter(
                        (o) => o.column !== column.name,
                      )
                    : query.intent.orders.map((o) =>
                        o.column === column.name
                          ? { ...o, direction: "DESC" }
                          : o,
                      )
                  : [
                      ...query.intent.orders,
                      { column: column.name, direction: "ASC" },
                    ],
              },
            },
          }}
        />
      );
    }
  }

  return (
    <div className="flex grow items-center gap-1 select-none">
      <span className="w-0 grow overflow-hidden text-left text-ellipsis">
        {column.name}
      </span>
      <span className="shrink overflow-hidden text-right text-[9px] leading-none text-ellipsis text-gray-500 uppercase">
        {column.type}
      </span>
    </div>
  );
}

function ChangeRequestDialog({
  changes,
  lastResult,
  setBlocking,
  ...props
}: React.ComponentPropsWithoutRef<"dialog"> & {
  setBlocking: (blocking: boolean) => void;
  changes: ChangeInput[];
  lastResult?: SubmissionResult<string[]> | null | undefined;
}) {
  const [form, fields] = useForm({
    lastResult,
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue: {
      changes,
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });
  useUpdateEffect(() => {
    form.update({ value: { changes } });
  }, [changes]);

  const changesFieldList = fields.changes.getFieldList();

  return (
    <dialog
      {...props}
      className="m-auto w-full max-w-(--breakpoint-sm) rounded-md border p-4 backdrop:backdrop-blur-xs"
    >
      <ActionForm className="flex flex-col gap-4" {...getFormProps(form)}>
        {changesFieldList.map((field) => {
          const fieldset = field.getFieldset();
          const fieldsFieldList = fieldset.fields.getFieldList();
          const primaryKeysFieldList = fieldset.primary_keys.getFieldList();
          return (
            <fieldset
              {...getFieldsetProps(field)}
              key={field.key}
              className="contents"
            >
              <input {...getInputProps(fieldset.action, { type: "hidden" })} />
              <input
                {...getInputProps(fieldset.schema_name, { type: "hidden" })}
              />
              <input
                {...getInputProps(fieldset.table_name, { type: "hidden" })}
              />
              {fieldsFieldList.map((field) => {
                const fieldset = field.getFieldset();
                return (
                  <fieldset
                    {...getFieldsetProps(field)}
                    key={field.key}
                    className="contents"
                  >
                    <input
                      {...getInputProps(fieldset.column_name, {
                        type: "hidden",
                      })}
                    />
                    <input
                      {...getInputProps(fieldset.type, {
                        type: "hidden",
                      })}
                    />
                    <input
                      {...getInputProps(fieldset.value, {
                        type: "hidden",
                      })}
                    />
                    <input
                      {...getInputProps(fieldset.value_type, {
                        type: "hidden",
                      })}
                    />
                  </fieldset>
                );
              })}
              {primaryKeysFieldList.map((field) => {
                const fieldset = field.getFieldset();
                return (
                  <fieldset
                    {...getFieldsetProps(field)}
                    key={field.key}
                    className="contents"
                  >
                    <input
                      {...getInputProps(fieldset.column_name, {
                        type: "hidden",
                      })}
                    />
                    <input
                      {...getInputProps(fieldset.type, {
                        type: "hidden",
                      })}
                    />
                    <input
                      {...getInputProps(fieldset.value, {
                        type: "hidden",
                      })}
                    />
                    <input
                      {...getInputProps(fieldset.value_type, {
                        type: "hidden",
                      })}
                    />
                  </fieldset>
                );
              })}
            </fieldset>
          );
        })}
        <ControlFieldInput label="Title" field={fields.title} type="text" />
        <Button
          type="submit"
          space="sm"
          name={fields.intent.name}
          value={INTENTS.createChangeRequest}
          onClick={() => setBlocking(false)}
        >
          Create Change Request
        </Button>
      </ActionForm>
    </dialog>
  );
}

type TableState = {
  createdRecords: string[][];
  deletedRows: Set<number>;
  // this could be optimized to a single map, by using a `x.y` key
  editedCells: Map<number, Map<number, string>>;
  selectedCreatedRows: Set<number>;
  selectedRows: Set<number>;
};

const createdColumnToField =
  (fullResultColumns: V2.Column[]) =>
  (
    cell: string,
    columnIndex: number,
  ): Extract<ChangeInput, { action: "ADD" }>["fields"][number] | undefined => {
    const column = fullResultColumns[columnIndex];
    if (column === undefined || column.type === "unknown") {
      return;
    }

    if (column.nullable && cell.toUpperCase() === "NULL") {
      return {
        column_name: column.name,
        type: column.type,
        value_type: "null",
        value: null,
      };
    }

    switch (column.type) {
      case "date":
        return {
          column_name: column.name,
          type: column.type,
          value_type: column.type,
          value: new Date(cell).toISOString(),
        };
      case "boolean":
        return {
          column_name: column.name,
          type: column.type,
          value_type: column.type,
          value: cell.toUpperCase() === "TRUE",
        };
      case "json":
        return {
          column_name: column.name,
          type: column.type,
          value_type: column.type,
          value: cell,
        };
      case "binary":
        return {
          column_name: column.name,
          type: column.type,
          value_type: column.type,
          value: cell,
        };
      case "uuid":
        return {
          column_name: column.name,
          type: column.type,
          value_type: column.type,
          value: cell,
        };
      case "numeric": {
        return {
          column_name: column.name,
          type: column.type,
          value_type: column.type,
          value: Number(cell),
        };
      }
      case "string":
        return {
          column_name: column.name,
          type: column.type,
          value_type: column.type,
          value: cell,
        };
      default:
        return;
    }
  };

const createdRecordToChange =
  ({
    schemaName,
    tableName,
    fullResultColumns,
  }: {
    schemaName: string;
    tableName: string;
    fullResultColumns: V2.Column[];
  }) =>
  (row: string[]): Extract<ChangeInput, { action: "ADD" }> => {
    return {
      action: "ADD",
      schema_name: schemaName,
      table_name: tableName,
      fields: row
        .map(createdColumnToField(fullResultColumns))
        .filter((field) => field !== undefined),
    };
  };

const editedColumnToField =
  ({
    fullResultColumns,
    changes,
  }: {
    fullResultColumns: V2.Column[];
    changes: Map<number, string>;
  }) =>
  (
    value: Json,
    columnIndex: number,
  ):
    | Extract<ChangeInput, { action: "MODIFY" }>["fields"][number]
    | undefined => {
    const change = changes.get(columnIndex);
    if (!change) {
      return;
    }
    const editedField = createdColumnToField(fullResultColumns)(
      change,
      columnIndex,
    );

    if (!editedField) {
      return;
    }

    return value === editedField.value ? undefined : editedField;
  };

const editedColumnToPrimaryKey =
  ({
    fullResultColumns,
    changes,
  }: {
    fullResultColumns: V2.Column[];
    changes: Map<number, string>;
  }) =>
  (
    value: Json,
    columnIndex: number,
  ):
    | Extract<ChangeInput, { action: "MODIFY" }>["primary_keys"][number]
    | undefined => {
    const change = changes.get(columnIndex);
    const column = fullResultColumns[columnIndex];
    if (!column?.is_primary_key) {
      return;
    }

    if (!change) {
      return {
        column_name: column.name,
        type: column.type,
        value_type: column.type,
        value: value,
      } as never;
    }
    const editedField = createdColumnToField(fullResultColumns)(
      change,
      columnIndex,
    );

    if (!editedField) {
      return {
        column_name: column.name,
        type: column.type,
        value_type: column.type,
        value: value,
      } as never;
    }

    const ret =
      value !== editedField.value
        ? ({
            column_name: column.name,
            type: column.type,
            value_type: column.type,
            value: value,
          } as never)
        : editedField;
    return ret;
  };

const editedRecordToChange =
  ({
    schemaName,
    tableName,
    fullResultColumns,
  }: {
    schemaName: string;
    tableName: string;
    fullResultColumns: V2.Column[];
  }) =>
  ([prevRow, changes]: readonly [Json[], Map<number, string>]): Extract<
    ChangeInput,
    { action: "MODIFY" }
  > => {
    return {
      action: "MODIFY",
      fields: prevRow
        .map(editedColumnToField({ fullResultColumns, changes }))
        .filter((v) => v !== undefined),
      primary_keys: prevRow
        .map(editedColumnToPrimaryKey({ fullResultColumns, changes }))
        .filter((v) => v !== undefined),
      schema_name: schemaName,
      table_name: tableName,
    };
  };

const deletedColumnToPrimaryKey =
  ({ fullResultColumns }: { fullResultColumns: V2.Column[] }) =>
  (
    value: Json,
    columnIndex: number,
  ):
    | Extract<ChangeInput, { action: "DELETE" }>["primary_keys"][number]
    | undefined => {
    const column = fullResultColumns[columnIndex];
    if (!column?.is_primary_key) {
      return;
    }

    return {
      column_name: column.name,
      type: column.type,
      value_type: column.type,
      value,
    } as never;
  };

const deletedRecordToChange =
  ({
    schemaName,
    tableName,
    fullResultColumns,
  }: {
    schemaName: string;
    tableName: string;
    fullResultColumns: V2.Column[];
  }) =>
  (row: Json[]): Extract<ChangeInput, { action: "DELETE" }> => {
    return {
      action: "DELETE",
      primary_keys: row
        .map(deletedColumnToPrimaryKey({ fullResultColumns }))
        .filter((primary_key) => primary_key !== undefined),
      schema_name: schemaName,
      table_name: tableName,
    };
  };

const createRowURL =
  ({
    params,
    fullResultColumns,
  }: {
    params: Record<
      "org_slug" | "database_slug" | "schema_name" | "table_name",
      string
    >;
    fullResultColumns: V2.Column[];
  }) =>
  (record: string[]) => {
    const init: string[][] = [
      ["query.intent.combinator", "AND"],
      ["query.intent.dml", "SELECT"],
      ["query.intent.limit", "1"],
      ["query.intent.schema", params.schema_name],
      ["query.intent.table", params.table_name],
      ["query.type", "intent"],
      ["intent", INTENTS.runQuery],
      ...fullResultColumns.map((c, i) => [
        `query.intent.columns[${i}]`,
        c.name,
      ]),
    ];
    let filterIndex = 0;
    for (const [index, value] of record.entries()) {
      const column = fullResultColumns[index];
      if (column?.is_primary_key) {
        init.push([`query.intent.filters[${filterIndex}].column`, column.name]);
        init.push([`query.intent.filters[${filterIndex}].op`, "="]);
        init.push([`query.intent.filters[${filterIndex}].value`, value]);
        filterIndex++;
      }
    }

    const searchParams = new URLSearchParams(init);

    return `/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/schemas/${params.schema_name}/tables/${params.table_name}?${searchParams}`;
  };

const createMarkdownLinkFromRecord =
  ({
    params,
    fullResultColumns,
  }: {
    params: Record<
      "org_slug" | "database_slug" | "schema_name" | "table_name",
      string
    >;
    fullResultColumns: V2.Column[];
  }) =>
  (record: string[]) => {
    return `- [click here](${createRowURL({ params, fullResultColumns })(record)})`;
  };

function buildChanges({
  fullResultColumns,
  records,
  schemaName,
  state,
  tableName,
}: {
  state: TableState;
  records: Json[][];
  fullResultColumns: V2.Column[];
  schemaName: string;
  tableName: string;
}): ChangeInput[] {
  const editedRowSet = new Set(state.editedCells.keys());
  const adds = state.createdRecords
    .map(
      createdRecordToChange({
        schemaName,
        tableName,
        fullResultColumns,
      }),
    )
    .filter((change) => change.fields.length > 0);
  const modifies = Array.from(
    difference(editedRowSet, state.deletedRows),
    (y) => [records[y]!, state.editedCells.get(y)!] as const,
  )
    .map(
      editedRecordToChange({
        schemaName,
        tableName,
        fullResultColumns,
      }),
    )
    .filter(
      (change) => change.fields.length > 0 && change.primary_keys.length > 0,
    );
  const deletes = Array.from(state.deletedRows, (y) => records[y]!)
    .map(
      deletedRecordToChange({
        schemaName,
        tableName,
        fullResultColumns,
      }),
    )
    .filter((change) => change.primary_keys.length > 0);

  return [...adds, ...modifies, ...deletes];
}

const ProposeChangesFormButton = memo(function ProposeChangesFormButton({
  fullResultColumns,
  records,
  present,
  schemaName,
  tableName,
  setBlocking,
  ...props
}: Omit<React.ComponentPropsWithoutRef<typeof Button>, "type"> & {
  fullResultColumns: V2.Column[];
  records: string[][];
  present: TableState;
  schemaName: string;
  tableName: string;
  setBlocking: (blocking: boolean) => void;
}) {
  const [form, fields] = useForm({
    constraint: getZodConstraint(schema),
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    defaultValue: {
      changes: buildChanges({
        fullResultColumns,
        records,
        schemaName,
        state: present,
        tableName,
      }),
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
  });
  useUpdateEffect(() => {
    form.update({
      value: {
        changes: buildChanges({
          fullResultColumns,
          records,
          schemaName,
          state: present,
          tableName,
        }),
      },
    });
  }, [fullResultColumns, records, present, schemaName, tableName]);

  const changesFieldList = fields.changes.getFieldList();

  return (
    <ActionForm className="contents" {...getFormProps(form)}>
      {changesFieldList.map((field) => {
        const fieldset = field.getFieldset();
        const fieldsFieldList = fieldset.fields.getFieldList();
        const primaryKeysFieldList = fieldset.primary_keys.getFieldList();
        return (
          <fieldset
            {...getFieldsetProps(field)}
            key={field.key}
            className="contents"
          >
            <input {...getInputProps(fieldset.action, { type: "hidden" })} />
            <input
              {...getInputProps(fieldset.schema_name, { type: "hidden" })}
            />
            <input
              {...getInputProps(fieldset.table_name, { type: "hidden" })}
            />
            {fieldsFieldList.map((field) => {
              const fieldset = field.getFieldset();
              return (
                <fieldset
                  {...getFieldsetProps(field)}
                  key={field.key}
                  className="contents"
                >
                  <input
                    {...getInputProps(fieldset.column_name, {
                      type: "hidden",
                    })}
                  />
                  <input
                    {...getInputProps(fieldset.type, {
                      type: "hidden",
                    })}
                  />
                  <input
                    {...getInputProps(fieldset.value, {
                      type: "hidden",
                    })}
                  />
                  <input
                    {...getInputProps(fieldset.value_type, {
                      type: "hidden",
                    })}
                  />
                </fieldset>
              );
            })}
            {primaryKeysFieldList.map((field) => {
              const fieldset = field.getFieldset();
              return (
                <fieldset
                  {...getFieldsetProps(field)}
                  key={field.key}
                  className="contents"
                >
                  <input
                    {...getInputProps(fieldset.column_name, {
                      type: "hidden",
                    })}
                  />
                  <input
                    {...getInputProps(fieldset.type, {
                      type: "hidden",
                    })}
                  />
                  <input
                    {...getInputProps(fieldset.value, {
                      type: "hidden",
                    })}
                  />
                  <input
                    {...getInputProps(fieldset.value_type, {
                      type: "hidden",
                    })}
                  />
                </fieldset>
              );
            })}
          </fieldset>
        );
      })}
      <Button
        {...props}
        value={INTENTS.updateChangeRequest}
        name={fields.intent.name}
        type="submit"
        onClick={() => setBlocking(false)}
      />
    </ActionForm>
  );
});

function linkRowButtonText(state: ClipboardTextState["state"]) {
  switch (state) {
    case "loading":
      return "Copying...";
    case "resolved":
      return "Copied!";
    case "rejected":
      return "Failed to copy";
    default:
      return "Link Row";
  }
}

function SQLButton({
  connectionId,
  orgSlug,
  setSqlOpen,
  sqlEnabled,
  sqlOpen,
}: {
  connectionId: string;
  orgSlug: string;
  setSqlOpen: React.Dispatch<React.SetStateAction<boolean>>;
  sqlEnabled: boolean;
  sqlOpen: boolean;
}) {
  const [open, setOpen] = useState(false);
  const handleClose = useCallback(() => setOpen(false), []);
  if (!sqlEnabled) {
    return (
      <>
        <Button
          intent="secondary"
          onClick={() => setOpen(true)}
          space="xs"
          type="button"
        >
          SQL
        </Button>
        <AlertDialog open={open} onClose={handleClose}>
          <AlertDialogCloseButton aria-label="Close">
            <IconX className="stroke-1.5 size-5" />
          </AlertDialogCloseButton>

          <AlertDialogTitle>Enable SQL</AlertDialogTitle>
          <AlertDialogDescription>
            You need to enable the SQL Feature by adding a read-only connection
            first
          </AlertDialogDescription>
          <LinkButton
            to={`/orgs/${orgSlug}/settings/connections/${connectionId}/edit/advanced`}
          >
            Enable SQL
          </LinkButton>
        </AlertDialog>
      </>
    );
  }

  return (
    <Button
      type="button"
      intent="secondary"
      space="xs"
      onClick={() => setSqlOpen((prev) => !prev)}
      aria-pressed={sqlOpen}
    >
      SQL
    </Button>
  );
}

export function DataExplorerTable({
  canCreateChangeRequest,
  canDescribeChanges,
  changeRequestNumber,
  fullResultColumns,
  columns,
  databaseSlug,
  lastResult,
  orgSlug,
  query,
  records,
  sqlSchema,
  viewer,
  runQueryIntentSchema,
  connectionId,
  sqlEnabled,
}: {
  connectionId: string;
  sqlEnabled: boolean;
  canCreateChangeRequest: boolean;
  canDescribeChanges: boolean;
  changeRequestNumber?: number;
  fullResultColumns: V2.Column[];
  columns: V2.Column[];
  databaseSlug: string;
  lastResult?: SubmissionResult<string[]> | null | undefined;
  orgSlug: string;
  query: Query;
  records: string[][];
  sqlSchema?: Record<string, string[]>;
  viewer: SessionData["user"] | undefined;
  runQueryIntentSchema: ReturnType<typeof buildRunQueryIntentSchema>;
}) {
  const queryHasOwner = !!query.created_by;
  const isQueryOwner = query.created_by === viewer?.sortProfile.id;
  const queryKey = query.id
    ? query.id
    : query.type === "intent"
      ? `${query.intent.schema}.${query.intent.table}`
      : query.sql;
  const { reset, present, canRedo, canUndo, redo, undo, update } =
    useUndoRedo<TableState>({
      createdRecords: [],
      deletedRows: new Set(),
      editedCells: new Map(),
      selectedCreatedRows: new Set(),
      selectedRows: new Set(),
    });

  const [modal, setModal] = useState<undefined | "filters" | "saveQuery">(
    undefined,
  );

  const [clipboardTextState, writeText] = useClipboardText(3000);

  const changeRequestDialogId = useId();
  const descriptionId = useId();
  const formErrorsId = useId();
  const columnHeaderId = useId();

  const [isBlocking, setBlocking] = useState(true);
  const [sqlOpen, setSqlOpen] = useState(query.type === "sql");
  const shouldAllowChangeRequest = canCreateChangeRequest && sqlOpen === false;

  useUpdateEffect(() => {
    reset({
      createdRecords: [],
      deletedRows: new Set(),
      editedCells: new Map(),
      selectedCreatedRows: new Set(),
      selectedRows: new Set(),
    });
    setModal(undefined);
  }, [records, queryKey, shouldAllowChangeRequest]);

  const tableBodyRef = useRef<HTMLDivElement>(null);

  const [changes, setChanges] = useState<ChangeInput[]>([]);

  const totalChanges =
    present.createdRecords.length +
    present.deletedRows.size +
    present.editedCells.size;

  useBlocker(
    useCallback<BlockerFunction>(() => {
      if (totalChanges > 0 && isBlocking) {
        return !confirm(
          "You have unsaved changes. Are you sure you want to leave this page and discard your changes?",
        );
      }

      return false;
    }, [totalChanges, isBlocking]),
  );

  const hasInvalidCells = useMemo(() => {
    for (const [_rowIndex, columnMap] of present.editedCells) {
      for (const [columnIndex, cellValue] of columnMap) {
        const column = fullResultColumns[columnIndex]!;
        if (!validateCell(cellValue, column)) {
          return true;
        }
      }
    }
    for (const record of present.createdRecords) {
      for (let columnIndex = 0; columnIndex < record.length; columnIndex++) {
        const cellValue = record[columnIndex]!;
        const column = fullResultColumns[columnIndex]!;
        if (!validateCell(cellValue, column)) {
          return true;
        }
      }
    }

    return false;
  }, [fullResultColumns, present.createdRecords, present.editedCells]);

  const [sizes, setSizes] = useState<number[]>(
    Array.from({ length: fullResultColumns.length }, () => DEFAULT_COLUMN_SIZE),
  );
  useUpdateEffect(() => {
    setSizes(
      Array.from(
        { length: fullResultColumns.length },
        () => DEFAULT_COLUMN_SIZE,
      ),
    );
  }, [fullResultColumns.length, queryKey]);

  const proposeChangesDisabled = totalChanges < 1;

  // NOTE: "" is not valid, but this should never happen because we only use schema/table when query.type is "intent"
  const schemaName = query.type === "intent" ? query.intent.schema : "";
  const tableName = query.type === "intent" ? query.intent.table : "";

  const totalTableSize = useMemo(
    () =>
      sizes.reduce(
        (acc, size) => acc + size,
        shouldAllowChangeRequest
          ? SELECT_ROW_COLUMN_SIZE + SCROLLBAR_WIDTH
          : 0 + SCROLLBAR_WIDTH,
      ),
    [sizes, shouldAllowChangeRequest],
  );

  const columnSizeCssVars = useMemo(
    () =>
      Object.fromEntries(
        sizes.map((size, columnIndex) => [
          `--column-${columnIndex}-size`,
          `${size}px`,
        ]),
      ),
    [sizes],
  );

  const handleSelectAllRows = useCallback<(checked: boolean) => void>(
    (checked) => {
      update((prev) => ({
        ...prev,
        selectedRows: checked
          ? new Set(Array.from({ length: records.length }, (_, k) => k))
          : new Set(),
        selectedCreatedRows: checked
          ? new Set(
              Array.from({ length: prev.createdRecords.length }, (_, k) => k),
            )
          : new Set(),
      }));
    },
    [update, records.length],
  );

  const handleSelectRow = useCallback<(checked: boolean, y: number) => void>(
    (checked, y) => {
      update((prev) => {
        const selectedRows = new Set(prev.selectedRows);
        if (checked) {
          selectedRows.add(y);
        } else {
          selectedRows.delete(y);
        }
        return { ...prev, selectedRows };
      });
    },
    [update],
  );

  const handleRemoveDeletedRow = useCallback<(rowIndex: number) => void>(
    (rowIndex) => {
      update((prev) => {
        const deletedRows = new Set(prev.deletedRows);
        deletedRows.delete(rowIndex);
        return { ...prev, deletedRows };
      });
    },
    [update],
  );

  const handleSelectCreatedRow = useCallback<
    (checked: boolean, rowIndex: number) => void
  >(
    (checked, rowIndex) => {
      update((prev) => {
        const selectedCreatedRows = new Set(prev.selectedCreatedRows);
        if (checked) {
          selectedCreatedRows.add(rowIndex);
        } else {
          selectedCreatedRows.delete(rowIndex);
        }
        return { ...prev, selectedCreatedRows };
      });
    },
    [update],
  );

  const handleCellChange = useCallback<
    (value: string, rowIndex: number, columnIndex: number) => void
  >(
    (value, rowIndex, columnIndex) => {
      update((prev) => {
        const editedCells = new Map(prev.editedCells);
        const existingRow = prev.editedCells.get(rowIndex);
        const editedCellsRow = existingRow
          ? new Map(existingRow)
          : new Map<number, string>();

        if (value !== records[rowIndex]![columnIndex]) {
          editedCellsRow.set(columnIndex, value);
        } else {
          editedCellsRow.delete(columnIndex);
        }

        if (editedCellsRow.size > 0) {
          editedCells.set(rowIndex, editedCellsRow);
        } else {
          editedCells.delete(rowIndex);
        }

        return {
          ...prev,
          editedCells,
        };
      });
    },
    [update, records],
  );

  const handleCreatedCellChange = useCallback<
    (value: string, rowIndex: number, columnIndex: number) => void
  >(
    (value, rowIndex, columnIndex) => {
      update((prev) => ({
        ...prev,
        createdRecords: prev.createdRecords.map((row, rowIndex2) =>
          rowIndex2 === rowIndex
            ? row.map((v, columnIndex2) =>
                columnIndex2 === columnIndex ? value : v,
              )
            : row,
        ),
      }));
    },
    [update],
  );

  const handleAddRow = useCallback(() => {
    update((prev) => ({
      ...prev,
      createdRecords: [
        ...prev.createdRecords,
        Array.from(fullResultColumns, (v) => (v.nullable ? "NULL" : "")),
      ],
    }));
  }, [update, fullResultColumns]);

  useUpdateEffect(() => {
    requestAnimationFrame(() => {
      if (!tableBodyRef.current) {
        return;
      }
      tableBodyRef.current.scrollTop = tableBodyRef.current.scrollHeight;
    });
  }, [present.createdRecords]);

  const handleDeleteRows = useCallback(() => {
    update((prev) => {
      const deletedRows = new Set(prev.deletedRows);
      for (const rowIndex of prev.selectedRows) {
        deletedRows.add(rowIndex);
      }
      const createdRecords = prev.selectedCreatedRows.size
        ? prev.createdRecords.filter(
            (_, rowIndex) => !prev.selectedCreatedRows.has(rowIndex),
          )
        : prev.createdRecords;

      return {
        ...prev,
        deletedRows,
        createdRecords,
        selectedRows: new Set(),
        selectedCreatedRows: new Set(),
      };
    });
  }, [update]);

  const cellInputsRef = useRef<Map<string, HTMLInputElement>>(new Map());

  const focusFirstInvalidCell = useCallback(() => {
    for (const [rowIndex, columnMap] of present.editedCells) {
      for (const [columnIndex, cellValue] of columnMap) {
        const column = fullResultColumns[columnIndex]!;
        if (!validateCell(cellValue, column)) {
          const key = `edited-${rowIndex}-${columnIndex}`;
          const element = cellInputsRef.current.get(key);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.setCustomValidity(getCellErrorMessage(cellValue, column));
            element.reportValidity();
            element.focus();
            return;
          }
        }
      }
    }

    for (
      let rowIndex = 0;
      rowIndex < present.createdRecords.length;
      rowIndex++
    ) {
      const record = present.createdRecords[rowIndex]!;
      for (let columnIndex = 0; columnIndex < record.length; columnIndex++) {
        const cellValue = record[columnIndex]!;
        const column = fullResultColumns[columnIndex]!;
        if (!validateCell(cellValue, column)) {
          const key = `created-${rowIndex}-${columnIndex}`;
          const element = cellInputsRef.current.get(key);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
            element.focus();
            return;
          }
        }
      }
    }
  }, [fullResultColumns, present.createdRecords, present.editedCells]);

  const handleClickProposeChanges = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (event) => {
      if (hasInvalidCells) {
        event.preventDefault();
        focusFirstInvalidCell();
        return;
      }

      setChanges(
        buildChanges({
          fullResultColumns,
          records,
          state: present,
          schemaName,
          tableName,
        }),
      );
    },
    [
      hasInvalidCells,
      fullResultColumns,
      records,
      present,
      schemaName,
      tableName,
      focusFirstInvalidCell,
    ],
  );

  const handleResize = useCallback<(size: number, columnIndex: number) => void>(
    (size, columnIndex) => {
      requestAnimationFrame(() =>
        setSizes((prev) => updateItemAtIndex(size, columnIndex, prev)),
      );
    },
    [],
  );

  const [describeChangesOpen, setDescribeChangesOpen] = useState(false);

  const getCellRef = useCallback<
    (
      rowType: "edited" | "created",
      rowIndex: number,
      columnIndex: number,
    ) => React.RefCallback<HTMLInputElement>
  >(
    (rowType, rowIndex, columnIndex) => (element) => {
      const key = `${rowType}-${rowIndex}-${columnIndex}`;
      if (element) {
        cellInputsRef.current.set(key, element);
      } else {
        cellInputsRef.current.delete(key);
      }
    },
    [],
  );

  const navigate = useNavigate();

  const [showDescription, setShowDescription] = useState(false);

  const handleClickDownloadCSV = useCallback<
    React.MouseEventHandler<HTMLButtonElement>
  >(
    (event) => {
      event.preventDefault();
      const blob = new Blob(
        [
          stringifyCSV(
            fullResultColumns.map((c) => c.name),
            records,
          ),
        ],
        {
          type: "text/csv",
        },
      );
      const link = document.createElement("a");
      link.setAttribute("href", URL.createObjectURL(blob));
      link.setAttribute("download", "");
      document.body.appendChild(link);
      link.click();
      URL.revokeObjectURL(link.href);
      document.body.removeChild(link);
    },
    [fullResultColumns, records],
  );

  const allChecked =
    present.selectedRows.size === records.length &&
    present.selectedCreatedRows.size === present.createdRecords.length;

  return (
    <>
      {showDescription ? (
        <p className="px-4 py-3 text-sm text-gray-700" id={descriptionId}>
          {query.description}
        </p>
      ) : undefined}
      {lastResult?.error?.[""] ? (
        <div className="px-4 py-3">
          <FormError id={formErrorsId} errors={lastResult?.error?.[""]} />
        </div>
      ) : undefined}
      <div className="flex shrink-0 flex-row items-center justify-between gap-2 overflow-x-auto border-t border-gray-200 bg-gray-50 px-3 py-2">
        <div className="flex items-center gap-2">
          {query.description ? (
            <Button
              type="button"
              intent="secondary"
              space="xs"
              iconLeft={<IconInfoCircle className="stroke-1.5 size-3.5" />}
              onClick={() => setShowDescription((prev) => !prev)}
              aria-pressed={showDescription}
            >
              Info
            </Button>
          ) : undefined}
          {!(changeRequestNumber || (query.id && query.type !== "sql")) ? (
            <SQLButton
              connectionId={connectionId}
              orgSlug={orgSlug}
              setSqlOpen={setSqlOpen}
              sqlEnabled={sqlEnabled}
              sqlOpen={sqlOpen}
            />
          ) : undefined}
          {(!query.id || query.type === "intent") && !sqlOpen ? (
            <Button
              space="xs"
              iconLeft={<IconFilter className="stroke-1.5 size-3.5" />}
              intent="secondary"
              type="button"
              onClick={() => setModal("filters")}
              disabled={query.type !== "intent"}
              iconRight={
                query.type === "intent" && query.intent.filters.length ? (
                  <Indicator space="xs" intent="secondary">
                    {query.intent.filters.length}
                  </Indicator>
                ) : undefined
              }
            >
              Filters
            </Button>
          ) : undefined}
          <LinkButton
            space="xs"
            iconLeft={<IconZoomReset className="stroke-1.5 size-3.5" />}
            reloadDocument
            to={{
              pathname: ".",
              search: "",
            }}
            intent="secondary"
          >
            Reset
          </LinkButton>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            intent="secondary"
            space="xs"
            iconLeft={<IconDownload className="stroke-1.5 size-3.5" />}
            onClick={handleClickDownloadCSV}
          >
            CSV
          </Button>
          {changeRequestNumber ? null : (
            <Button
              type="button"
              intent="secondary"
              space="xs"
              iconLeft={<IconReportSearch className="stroke-1.5 size-3.5" />}
              onClick={() => setModal("saveQuery")}
            >
              {queryHasOwner ? (isQueryOwner ? "Update" : "Copy") : "Save"}
            </Button>
          )}
        </div>
        <IntentQueryFormDrawer
          schema={runQueryIntentSchema}
          columns={columns}
          query={query}
          open={modal === "filters"}
          onClose={() => setModal(undefined)}
        />
        <FormDrawer
          onClose={() => setModal(undefined)}
          open={modal === "saveQuery"}
        >
          <QueryForm
            onCancel={() => setModal(undefined)}
            query={query}
            viewer={viewer}
            lastResult={lastResult}
          />
        </FormDrawer>
      </div>
      {sqlOpen ? <SqlForm query={query} sqlSchema={sqlSchema} /> : undefined}

      <div className="flex grow flex-col">
        <Divtable
          aria-colcount={fullResultColumns.length}
          aria-rowcount={-1}
          aria-describedby={showDescription ? descriptionId : undefined}
          aria-label={query.name ?? tableName}
          style={{ ...columnSizeCssVars, width: totalTableSize }}
        >
          <DivtableThead>
            <DivtableTheadRow>
              {shouldAllowChangeRequest ? (
                <DivtableColumnheader
                  id={`${columnHeaderId}-1`}
                  aria-colindex={1}
                  aria-label="Select All"
                  style={{ width: SELECT_ROW_COLUMN_SIZE }}
                >
                  <div className="flex h-4 flex-col items-center justify-center">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={(event) => {
                        const { checked } = event.currentTarget;
                        handleSelectAllRows(checked);
                      }}
                    />
                  </div>
                </DivtableColumnheader>
              ) : undefined}
              {fullResultColumns.map((column, columnIndex) => (
                <DataExplorerTableColumnheader
                  id={`${columnHeaderId}-${shouldAllowChangeRequest ? columnIndex + 2 : columnIndex + 1}`}
                  aria-colindex={
                    shouldAllowChangeRequest ? columnIndex + 2 : columnIndex + 1
                  }
                  schema={runQueryIntentSchema}
                  query={query}
                  column={column}
                  columnIndex={columnIndex}
                  handleResize={handleResize}
                  size={sizes[columnIndex]!}
                  key={columnIndex}
                />
              ))}
            </DivtableTheadRow>
          </DivtableThead>
          <DivtableTbody ref={tableBodyRef}>
            {records.map((row, rowIndex) => (
              <DataExplorerTableRow
                columnHeaderId={columnHeaderId}
                shouldAllowChangeRequest={shouldAllowChangeRequest}
                fullResultColumns={fullResultColumns}
                editedCellsRow={present.editedCells.get(rowIndex)}
                getCellRef={getCellRef}
                handleCellChange={handleCellChange}
                handleRemoveDeletedRow={handleRemoveDeletedRow}
                handleSelectRow={handleSelectRow}
                isRowDeleted={present.deletedRows.has(rowIndex)}
                isRowSelected={present.selectedRows.has(rowIndex)}
                key={rowIndex}
                row={row}
                rowIndex={rowIndex}
                rowType="edited"
              />
            ))}
            {present.createdRecords.map((row, rowIndex) => (
              <DataExplorerTableRow
                columnHeaderId={columnHeaderId}
                shouldAllowChangeRequest={shouldAllowChangeRequest}
                fullResultColumns={fullResultColumns}
                getCellRef={getCellRef}
                handleCellChange={handleCreatedCellChange}
                handleSelectRow={handleSelectCreatedRow}
                isRowSelected={present.selectedCreatedRows.has(rowIndex)}
                key={`created-${rowIndex}`}
                row={row}
                rowIndex={rowIndex}
                rowType="created"
              />
            ))}
          </DivtableTbody>
        </Divtable>
      </div>
      {shouldAllowChangeRequest ? (
        <>
          <div className="flex shrink-0 gap-1 overflow-auto border-t border-gray-200 bg-gray-50 px-3 py-2">
            <Button
              type="button"
              space="xs"
              intent="secondary"
              onClick={handleAddRow}
              title="Add Selected Rows"
            >
              <IconPlus className="size-3.5 stroke-green-700 stroke-2" />
            </Button>
            <Button
              type="button"
              space="xs"
              intent="secondary"
              disabled={
                present.selectedRows.size === 0 &&
                present.selectedCreatedRows.size === 0
              }
              onClick={handleDeleteRows}
              title="Delete Selected Rows"
            >
              <IconTrash className="stroke-1.5 size-3.5 stroke-red-600" />
            </Button>
            <Button
              disabled={!canUndo}
              intent="secondary"
              onClick={undo}
              space="xs"
              title="Undo"
              type="button"
            >
              <IconRotate2 className="stroke-1.5 size-3.5" />
            </Button>
            <Button
              disabled={!canRedo}
              type="button"
              intent="secondary"
              space="xs"
              onClick={redo}
              title="Redo"
            >
              <IconRotateClockwise2 className="stroke-1.5 size-3.5" />
            </Button>
            {!proposeChangesDisabled && changeRequestNumber ? (
              <ProposeChangesFormButton
                setBlocking={setBlocking}
                fullResultColumns={fullResultColumns}
                present={present}
                records={records}
                schemaName={schemaName}
                tableName={tableName}
                space="xs"
                intent="constructive"
              >
                Propose{totalChanges > 0 ? ` ${totalChanges}` : ""}{" "}
                {pluralize(totalChanges, "Change", "Changes")}
              </ProposeChangesFormButton>
            ) : (
              <Button
                type="button"
                space="xs"
                disabled={proposeChangesDisabled}
                // @ts-expect-error -- types are not in react yet
                popovertarget={changeRequestDialogId}
                onClick={handleClickProposeChanges}
                iconLeft={
                  <IconGitPullRequest className="stroke-1.5 size-3.5" />
                }
              >
                Propose{totalChanges > 0 ? ` ${totalChanges}` : ""}{" "}
                {pluralize(totalChanges, "Change", "Changes")}
              </Button>
            )}
            {canDescribeChanges ? (
              <Button
                type="button"
                space="xs"
                intent="secondary"
                onClick={() => setDescribeChangesOpen((prev) => !prev)}
                aria-pressed={describeChangesOpen}
                iconLeft={<IconSparkles className="stroke-1.5 size-3.5" />}
              >
                Describe Changes
              </Button>
            ) : undefined}
            <Button
              type="button"
              space="xs"
              intent="secondary"
              iconLeft={<IconTicket className="stroke-1.5 size-3.5" />}
              disabled={
                present.selectedRows.size === 0 &&
                present.selectedCreatedRows.size === 0
              }
              onClick={() => {
                void navigate({
                  pathname: `/orgs/${orgSlug}/databases/${databaseSlug}/issues/new`,
                  search: new URLSearchParams({
                    title: `Issue with ${schemaName}.${tableName} data`,
                    description:
                      `There is an issue with the following ${pluralize(present.selectedRows.size, "row", "rows")}:\n` +
                      Array.from(present.selectedRows, (i) => records[i]!)
                        .map(
                          createMarkdownLinkFromRecord({
                            params: {
                              database_slug: databaseSlug,
                              org_slug: orgSlug,
                              schema_name: schemaName,
                              table_name: tableName,
                            },
                            fullResultColumns,
                          }),
                        )
                        .join("\n"),
                  }).toString(),
                });
              }}
            >
              Create Issue
            </Button>
            <Button
              type="button"
              space="xs"
              intent="secondary"
              iconLeft={<IconCopy className="stroke-1.5 size-3.5" />}
              disabled={
                present.selectedRows.size + present.selectedCreatedRows.size !==
                1
              }
              onClick={() =>
                void writeText(
                  Array.from(present.selectedRows, (i) => records[i]!)
                    .map(
                      createRowURL({
                        params: {
                          database_slug: databaseSlug,
                          org_slug: orgSlug,
                          schema_name: schemaName,
                          table_name: tableName,
                        },
                        fullResultColumns,
                      }),
                    )
                    .map((pathname) =>
                      new URL(pathname, window.location.origin).toString(),
                    )
                    .join("\n"),
                )
              }
            >
              {linkRowButtonText(clipboardTextState.state)}
            </Button>
          </div>{" "}
          <ChangeRequestDialog
            // @ts-expect-error -- types are not in react yet
            popover="auto"
            id={changeRequestDialogId}
            setBlocking={setBlocking}
            changes={changes}
          />
          {describeChangesOpen ? (
            <DescribeChangesFormDrawer
              fullResultColumns={fullResultColumns}
              records={records}
              tableState={present}
              setTableState={update}
            />
          ) : null}
        </>
      ) : undefined}
    </>
  );
}

function DataExplorerTableColumnheader({
  size,
  column,
  query,
  columnIndex,
  handleResize,
  schema,
  ...props
}: React.ComponentPropsWithoutRef<typeof DivtableColumnheader> & {
  size: number;
  column: V2.Column;
  query: Query;
  columnIndex: number;
  handleResize: (size: number, columnIndex: number) => void;
  schema: ReturnType<typeof buildRunQueryIntentSchema>;
}) {
  const columnName = column.name;
  const orderDirection = useMemo(() => {
    return query.type === "intent"
      ? query.intent.orders.find((o) => o.column === columnName)?.direction
      : undefined;
  }, [query, columnName]);
  return (
    <DivtableColumnheader
      {...props}
      aria-label={column.name}
      key={columnIndex}
      aria-sort={orderDirectionToAriaSort(orderDirection)}
      style={{ width: `var(--column-${columnIndex}-size)` }}
    >
      <div className="relative flex h-full items-center gap-3">
        <DataExplorerTableColumnheaderTitle
          orderDirection={orderDirection}
          schema={schema}
          column={column}
          query={query}
        />
        <DataExplorerTableColumnheaderResizer
          onResizeColumn={handleResize}
          columnIndex={columnIndex}
          value={size}
        />
      </div>
    </DivtableColumnheader>
  );
}

const DataExplorerTableCell = memo(function DataExplorerTableCell({
  columnIndex,
  rowIndex,
  getCellRef,
  value,
  rowType,
  isCellDirty,
  isRowDeleted,
  column,
  handleCellChange,
  shouldAllowChangeRequest,
  ...props
}: React.ComponentPropsWithoutRef<typeof DivtableCell> & {
  shouldAllowChangeRequest: boolean;
  columnIndex: number;
  rowIndex: number;
  rowType: "edited" | "created";
  getCellRef: (
    rowType: "edited" | "created",
    rowIndex: number,
    columnIndex: number,
  ) => React.RefCallback<HTMLInputElement>;
  value: string;
  isCellDirty: boolean;
  isRowDeleted: boolean;
  column: V2.Column;
  handleCellChange: (
    value: string,
    rowIndex: number,
    columnIndex: number,
  ) => void;
}) {
  return (
    <DivtableCell
      {...props}
      style={{ width: `var(--column-${columnIndex}-size)` }}
    >
      <CellInput
        ref={getCellRef(rowType, rowIndex, columnIndex)}
        type="text"
        value={value}
        data-created={rowType === "created"}
        data-dirty={isCellDirty}
        data-deleted={isRowDeleted}
        readOnly={!shouldAllowChangeRequest}
        column={column}
        onFocus={(event) => {
          const { currentTarget } = event;
          if (!validateCell(currentTarget.value, column)) {
            currentTarget.setCustomValidity(
              getCellErrorMessage(currentTarget.value, column),
            );
            currentTarget.reportValidity();
          }
        }}
        onChange={(event) => {
          const { currentTarget } = event;
          if (validateCell(currentTarget.value, column)) {
            currentTarget.setCustomValidity("");
          } else {
            currentTarget.setCustomValidity(
              getCellErrorMessage(currentTarget.value, column),
            );
          }
          currentTarget.reportValidity();

          handleCellChange(currentTarget.value, rowIndex, columnIndex);
        }}
      />
    </DivtableCell>
  );
});

const DataExplorerTableRow = memo(function DataExplorerTableRow({
  fullResultColumns,
  editedCellsRow,
  getCellRef,
  handleCellChange,
  handleRemoveDeletedRow,
  handleSelectRow,
  isRowDeleted = false,
  isRowSelected,
  row,
  rowIndex,
  rowType,
  shouldAllowChangeRequest,
  columnHeaderId,
}: {
  columnHeaderId: string;
  fullResultColumns: V2.Column[];
  getCellRef: (
    rowType: "edited" | "created",
    rowIndex: number,
    columnIndex: number,
  ) => React.RefCallback<HTMLInputElement>;
  handleCellChange: (
    value: string,
    rowIndex: number,
    columnIndex: number,
  ) => void;
  handleRemoveDeletedRow?: (rowIndex: number) => void;
  handleSelectRow: (checked: boolean, rowIndex: number) => void;
  editedCellsRow?: Map<number, string> | undefined;
  isRowDeleted?: boolean;
  isRowSelected: boolean;
  row: string[];
  rowIndex: number;
  rowType: "edited" | "created";
  shouldAllowChangeRequest: boolean;
}) {
  return (
    <DivtableTbodyRow aria-rowindex={rowIndex + 1}>
      {shouldAllowChangeRequest ? (
        <DivtableCell
          aria-labelledby={`${columnHeaderId}-1`}
          style={{ width: SELECT_ROW_COLUMN_SIZE }}
          aria-colindex={1}
        >
          <div className="flex h-7 flex-col items-center justify-center">
            {isRowDeleted ? (
              <button
                className="text-base"
                onClick={(event) => {
                  event.preventDefault();
                  handleRemoveDeletedRow?.(rowIndex);
                }}
              >
                <IconX className="stroke-1.5 size-4" />
              </button>
            ) : (
              <input
                type="checkbox"
                checked={isRowSelected}
                onChange={(event) => {
                  const { checked } = event.currentTarget;
                  handleSelectRow(checked, rowIndex);
                }}
              />
            )}
          </div>
        </DivtableCell>
      ) : undefined}
      {row.map((cell, columnIndex) => (
        <DataExplorerTableCell
          aria-labelledby={`${columnHeaderId}-${shouldAllowChangeRequest ? columnIndex + 2 : columnIndex + 1}`}
          aria-colindex={
            shouldAllowChangeRequest ? columnIndex + 2 : columnIndex + 1
          }
          shouldAllowChangeRequest={shouldAllowChangeRequest}
          column={fullResultColumns[columnIndex]!}
          columnIndex={columnIndex}
          getCellRef={getCellRef}
          handleCellChange={handleCellChange}
          isCellDirty={!!editedCellsRow?.get(columnIndex)}
          isRowDeleted={isRowDeleted}
          key={columnIndex}
          rowIndex={rowIndex}
          rowType={rowType}
          value={editedCellsRow?.get(columnIndex) ?? cell}
        />
      ))}
    </DivtableTbodyRow>
  );
});

function SqlForm({
  query,
  sqlSchema,
}: {
  query: Query;
  sqlSchema?: Record<string, string[]>;
}) {
  const {
    type: _type,
    intent: _intent,
    ...sqlQuery
  } = query.type === "intent" ? query : {};
  const [form, fields] = useForm({
    defaultValue: {
      intent: "runQuery",
      query:
        query.type === "sql"
          ? query
          : {
              ...sqlQuery,
              type: "sql",
              sql: `SELECT * FROM "${query.intent.schema}"."${query.intent.table}" LIMIT ${query.intent.limit}`,
            },
    },
    onValidate(context) {
      return parseWithZod(context.formData, { schema });
    },
  });
  const location = useLocation();
  useUpdateEffect(() => {
    form.reset();
  }, [location.pathname]);
  const queryFieldset = fields.query.getFieldset();
  return (
    <Form
      {...getFormProps(form)}
      className="flex flex-col gap-2 bg-gray-50 p-2 sm:flex-row"
    >
      <div className="grow">
        <input {...getInputProps(queryFieldset.type, { type: "hidden" })} />
        <input {...getInputProps(queryFieldset.name, { type: "hidden" })} />
        <input
          {...getInputProps(queryFieldset.description, { type: "hidden" })}
        />
        <input {...getInputProps(queryFieldset.id, { type: "hidden" })} />
        <ControlSqlField
          field={queryFieldset.sql}
          defaultTable={
            query.type === "intent" ? query.intent.table : undefined
          }
          defaultSchema={
            query.type === "intent" ? query.intent.schema : undefined
          }
          aria-label="SQL Query"
          schema={sqlSchema}
        />
      </div>
      <div className="flex grow sm:inline-flex sm:shrink-0 sm:grow-0 sm:items-start">
        <Button
          type="submit"
          name={fields.intent.name}
          value={INTENTS.runQuery}
          fullWidth
        >
          Run
        </Button>
      </div>
    </Form>
  );
}
