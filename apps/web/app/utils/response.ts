import type { TypedResponse } from "@sort/sdk";
import { isErrorMessage, isValidationErrorMessage } from "./message";

export function isRedirect(response: Response) {
  if (response.status < 300 || response.status >= 400) {
    return false;
  }
  return response.headers.has("Location");
}
export const extractMessageOrThrow =
  <T extends { type: string }, TType extends T["type"]>(
    expectedType: TType,
    message = "Bad Request",
    responseInit?: ResponseInit,
  ) =>
  async (response: TypedResponse<T>) => {
    const responseJson = await response.json();

    switch (true) {
      case isErrorMessage(responseJson):
        assertResponse(
          responseJson.type === expectedType,
          responseJson.payload.error.message,
          responseInit ?? { status: response.status },
        );
        break;
      case isValidationErrorMessage(responseJson):
        assertResponse(
          responseJson.type === expectedType,
          responseJson.payload.validation_error.message,
          responseInit ?? { status: response.status },
        );
        break;
      default:
        assertResponse(
          responseJson.type === expectedType,
          message,
          responseInit,
        );
        break;
    }

    return responseJson as Extract<T, { type: TType }>;
  };
export function assertResponse(
  condition: unknown,
  message = "Bad Request",
  responseInit?: ResponseInit,
): asserts condition {
  if (!condition) {
    throw new Response(message, {
      status: 400,
      ...responseInit,
    });
  }
}

export function assertResponseParams<
  T extends Record<string, string | undefined>,
  K extends keyof T,
>(params: T, requiredKeys: K[]): asserts params is T & Record<K, string> {
  for (const key of requiredKeys) {
    assertResponse(params[key], `${String(key)} is required`);
  }
}
