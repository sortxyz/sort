import * as Sentry from "@sentry/react";
import type { ErrorResponse } from "react-router";
import { isRouteErrorResponse, useParams, useRouteError } from "react-router";
import { getErrorMessage } from "~/utils/error";
import { isErrorMessage, isValidationErrorMessage } from "~/utils/message";

type StatusHandler = React.FC<StatusHandlerProps>;

type StatusHandlerProps = {
  error: ErrorResponse;
  params: Record<string, string | undefined>;
};

function getErrorMessageFromErrorResponse(
  error: Omit<ErrorResponse, "data"> & { data: unknown },
) {
  if (typeof error.data === "string") {
    return error.data;
  } else if (isErrorMessage(error.data)) {
    return error.data.payload.error.message;
  } else if (isValidationErrorMessage(error.data)) {
    return error.data.payload.validation_error.message;
  }

  return error.statusText;
}

export function DefaultGenericStatusHandler({ error }: StatusHandlerProps) {
  return (
    <>
      <h2 className="text-9xl font-bold text-gray-200">{error.status}</h2>
      <p className="text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl">
        {getErrorMessageFromErrorResponse(error)}
      </p>
    </>
  );
}

function DefaultUnexpectedErrorHandler(error: unknown) {
  return (
    <p className="text-2xl font-bold tracking-tight text-gray-900 sm:text-4xl">
      {getErrorMessage(error)}
    </p>
  );
}

export function GeneralErrorBoundary({
  GenericStatusHandler = DefaultGenericStatusHandler,
  UnexpectedErrorHandler = DefaultUnexpectedErrorHandler,
  statusHandlers,
}: {
  GenericStatusHandler?: StatusHandler;
  statusHandlers?: Record<number, StatusHandler>;
  UnexpectedErrorHandler?: React.FC<{ error: unknown }>;
}) {
  const error = useRouteError();
  const params = useParams();

  if (typeof document !== "undefined") {
    console.error(error);
  }

  if (!isRouteErrorResponse(error)) {
    return (
      <article className="container mx-auto flex grow flex-col items-center justify-center px-10 py-20">
        <UnexpectedErrorHandler error={error} />
      </article>
    );
  }

  if (error && error instanceof Error) {
    Sentry.captureException(error);
  }

  const ErrorComponent = statusHandlers?.[error.status] ?? GenericStatusHandler;

  return (
    <article className="container mx-auto flex grow flex-col items-center justify-center px-10 py-20">
      <ErrorComponent error={error} params={params} />
    </article>
  );
}
