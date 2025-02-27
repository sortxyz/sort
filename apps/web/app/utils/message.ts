import type { V2 } from "@sort/sdk";
import { isNonNullableObject } from "./object";

function isMessage(
  data: unknown,
): data is V2.Message<string, Record<string, unknown>> {
  return (
    isNonNullableObject(data) &&
    "type" in data &&
    typeof data.type === "string" &&
    "payload" in data &&
    isNonNullableObject(data.payload)
  );
}
export function errorMessageToReplyOptions(
  message: V2.ErrorMessage | V2.ValidationErrorMessage,
) {
  switch (message.type) {
    case "error":
      return {
        formErrors: [message.payload.error.message],
      };
    case "validation_error":
      return {
        formErrors: [message.payload.validation_error.message],
        fieldErrors: message.payload.validation_error.errors.body
          ? Object.entries(message.payload.validation_error.errors.body).reduce(
              (record, [key, value]) => {
                record[transformPath(key)] = [value];
                return record;
              },
              {} as Record<string, string[]>,
            )
          : undefined,
      };
  }
}

function transformPath(path: string): string {
  // Replace all occurrences of a slash followed by a number with the bracket notation
  return path.replace(/\/(\d+)/g, "[$1]").replace(/\//g, ".");
}

export function isErrorMessage(data: unknown): data is V2.ErrorMessage {
  return (
    isMessage(data) &&
    data.type === "error" &&
    "error" in data.payload &&
    isNonNullableObject(data.payload.error) &&
    "message" in data.payload.error &&
    typeof data.payload.error.message === "string"
  );
}
export function isValidationErrorMessage(
  data: unknown,
): data is V2.ValidationErrorMessage {
  return (
    isMessage(data) &&
    data.type === "validation_error" &&
    "validationError" in data.payload &&
    isNonNullableObject(data.payload.validation_error) &&
    "message" in data.payload.validation_error &&
    typeof data.payload.validation_error.message === "string" &&
    "errors" in data.payload.validation_error &&
    isNonNullableObject(data.payload.validation_error.errors)
  );
}
export const generalErrorMessage = {
  type: "error",
  payload: {
    error: {
      message: "Something went wrong. Please try again.",
    },
  },
} satisfies V2.ErrorMessage;
