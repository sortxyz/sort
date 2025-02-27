import type { SubmissionResult } from "@conform-to/react";
import { getFormProps, useForm } from "@conform-to/react";
import { getZodConstraint, parseWithZod } from "@conform-to/zod";
import type { V2 } from "@sort/sdk";
import { OpenAI } from "openai";
import { useMemo } from "react";
import type { ActionFunctionArgs } from "react-router";
import { useFetcher, useParams } from "react-router";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { z } from "zod";
import { Button } from "~/components/button";
import { ControlFieldTextarea } from "~/components/control-field";
import { Spinner } from "~/components/spinner";
import { useUpdateEffect } from "~/hooks/use-update-effect";
import { serverEnv } from "~/utils/env.server";
import { assertResponse } from "~/utils/response";

type TableStateInput = {
  createdRecords: string[][];
  deletedRows: Set<number>;
  editedCells: Map<number, Map<number, string>>;
  selectedCreatedRows: Set<number>;
  selectedRows: Set<number>;
};

type TableStateOutput = {
  createdRecords: string[][];
  deletedRows: number[];
  editedCells: Record<string, Record<string, string>>;
  selectedCreatedRows: number[];
  selectedRows: number[];
};

export const maxDuration = 10;

const schema = z.object({
  message: z.string().min(1),
});

export async function action({ request }: ActionFunctionArgs) {
  assertResponse(serverEnv.SORT_AI, "Assistant not found");

  const openai = new OpenAI({
    apiKey: serverEnv.OPENAI_API_KEY,
  });

  const response = (await request.json()) as {
    tableState: TableStateOutput;
    records: string[][];
    columns: V2.Column[];
    message: string;
    threadId: string | null;
  };

  // Validate that data.message exists
  if (!response.message) {
    return {
      error: "Message is required",
      tableState: response.tableState,
      threadId: response.threadId,
    };
  }

  let threadId = response.threadId;
  let thread: OpenAI.Beta.Threads.Thread;

  try {
    if (!threadId) {
      // No threadId provided, create a new thread
      thread = await openai.beta.threads.create();
      threadId = thread.id;
    } else {
      // ThreadId provided, retrieve the thread
      thread = await openai.beta.threads.retrieve(threadId);
    }

    const run = await openai.beta.threads.runs.createAndPoll(threadId, {
      assistant_id: serverEnv.OPENAI_ASSISTANT_ID,
      additional_messages: [
        {
          role: "assistant",
          content: JSON.stringify({
            columns: response.columns,
            records: response.records,
            tableState: response.tableState,
          }),
        },
        { role: "user", content: response.message },
      ],
    });

    const messages = await openai.beta.threads.messages.list(threadId, {
      run_id: run.id,
    });

    // @ts-expect-error - will fix this later
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const state = JSON.parse(messages.data[0].content[0].text.value) as {
      tableState: TableStateOutput;
      error: string | null;
    };

    let tableState = response.tableState;
    let error = state.error;

    if (
      state.tableState?.createdRecords.every(
        (record) => record.length === response.columns.length,
      )
    ) {
      tableState = state.tableState;
    } else {
      error ??= "The AI did not return the correct number of columns";
    }

    // Process the parsed response if needed
    // For now, we return tableState, error: null, and threadId
    return { tableState, error, threadId };
  } catch (error) {
    // Handle parsing errors and other exceptions
    let errorMessage = "An error occurred";
    if (error instanceof z.ZodError) {
      errorMessage = error.errors.map((e) => e.message).join(", ");
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = String(error);
    }

    return { error: errorMessage, tableState: response.tableState, threadId };
  }
}
function serializeTableState(tableState: TableStateInput): TableStateOutput {
  return {
    createdRecords: Array.from(tableState.createdRecords),
    deletedRows: Array.from(tableState.deletedRows),
    editedCells: Object.fromEntries(
      Array.from(tableState.editedCells).map(([row, cells]) => [
        row,
        Object.fromEntries(cells),
      ]),
    ),
    selectedCreatedRows: Array.from(tableState.selectedCreatedRows),
    selectedRows: Array.from(tableState.selectedRows),
  };
}

function parseTableState(tableState: TableStateOutput): TableStateInput {
  return {
    createdRecords: tableState.createdRecords,
    deletedRows: new Set(tableState.deletedRows),
    editedCells: new Map(
      Object.entries(tableState.editedCells).map(([row, cells]) => [
        Number(row),
        new Map(
          Object.entries(cells).map(([cell, value]) => [Number(cell), value]),
        ),
      ]),
    ),
    selectedCreatedRows: new Set(tableState.selectedCreatedRows),
    selectedRows: new Set(tableState.selectedRows),
  };
}

export function DescribeChangesFormDrawer({
  tableState,
  records,
  setTableState,
  fullResultColumns,
}: {
  tableState: TableStateInput;
  setTableState: (tableState: TableStateInput) => void;
  records: string[][];
  fullResultColumns: V2.Column[];
}) {
  const params = useParams();
  const fetcher = useFetcher<typeof action>();
  const lastResult = useMemo<SubmissionResult<string[]> | undefined>(() => {
    return fetcher.data?.error
      ? {
          error: { message: [fetcher.data.error] },
          status: "error",
          fields: ["message"],
          initialValue: {},
          state: {
            validated: {
              message: true,
            },
          },
        }
      : undefined;
  }, [fetcher.data]);
  const [form, fields] = useForm({
    lastResult,
    defaultValue: {
      message: "",
    },
    shouldValidate: "onBlur",
    shouldRevalidate: "onInput",
    constraint: getZodConstraint(schema),
    onSubmit(event, { submission }) {
      event.preventDefault();
      if (submission?.status !== "success") {
        return;
      }
      void fetcher.submit(
        {
          message: submission.value.message,
          records,
          columns: fullResultColumns,
          threadId: fetcher.data?.threadId ?? null,
          tableState: serializeTableState(tableState),
        },
        {
          encType: "application/json",
          action: `/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/describe`,
          method: "POST",
        },
      );
    },
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
  });

  useUpdateEffect(() => {
    if (!fetcher.data) {
      return;
    }
    setTableState(parseTableState(fetcher.data.tableState));
  }, [fetcher.data]);

  return (
    <fetcher.Form
      method="POST"
      action={`/orgs/${params.org_slug}/databases/${params.database_slug}/explorer/describe`}
      className="flex flex-col gap-3 p-3"
      {...getFormProps(form)}
    >
      <AuthenticityTokenInput />
      <ControlFieldTextarea
        fullWidth
        label="Message"
        field={fields.message}
        helperText="Describe the changes you want to make. An AI will help create the changes for you."
      />
      <Button
        type="submit"
        space="sm"
        disabled={fetcher.state !== "idle"}
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
        View Results
      </Button>
    </fetcher.Form>
  );
}
