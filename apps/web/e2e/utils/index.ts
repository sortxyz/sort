import type { Page } from "@playwright/test";
import type { TypedResponse } from "@sort/sdk";
import { createCookieSessionStorage } from "react-router";

export const sessionStorage = createCookieSessionStorage<{
  user: { sortJWT: string };
}>({
  cookie: {
    name: "appSession",
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secrets: [process.env.SORT_WEB_SESSION_SECRET!],
    secure: process.env.NODE_ENV === "production",
    maxAge: 259000, // Seconds. Just under 3 days.
  },
});

export function toSlugString(str: string) {
  return (
    str
      // make the url lowercase
      .toLowerCase()
      // replace & with and
      .split(/&+/)
      .join("-and-")
      // remove invalid characters
      .split(/[^a-z0-9]/)
      .join("-")
      // remove duplicates
      .split(/-+/)
      .join("-")
      // trim leading & trailing characters
      .trim()
  );
}

export async function getUser(page: Page) {
  const cookies = await page.context().cookies();
  const cookie = cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  const session = await sessionStorage.getSession(cookie);
  const user = session.get("user");
  if (!user) {
    throw new Error("User is not authenticated");
  }

  return user;
}

export async function getUserHeaders(page: Page) {
  const user = await getUser(page);
  return new Headers({ Authorization: `Bearer ${user.sortJWT}` });
}

export type ExtractMessage<
  T extends (...args: unknown[]) => Promise<Response>,
  U,
> = Extract<Awaited<ReturnType<Awaited<ReturnType<T>>["json"]>>, U>;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function retryFn<T = unknown>(
  fn: () => Promise<T>,
  retries = 3,
  initialDelayMs = 1000,
) {
  let delayMs = initialDelayMs;

  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) {
        throw error; // All retries failed, rethrow the error
      }
      console.log(
        error instanceof Error ? error.message : undefined,
        `Retrying test: ${fn.name} (${i + 1}/${retries}) after ${delayMs} ms...`,
      );
      await delay(delayMs); // Wait for the specified delay before retrying
      delayMs *= 2; // Exponential backoff
    }
  }

  throw new Error("Retry function failed after all retries");
}

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

export const extractMessageOrThrow =
  <T extends { type: string }, TType extends T["type"]>(
    expectedType: TType,
    message = "Bad Request",
    { status = 400, statusText, headers }: ResponseInit = {},
  ) =>
  async (response: TypedResponse<T>): Promise<Extract<T, { type: TType }>> => {
    const responseJson = await response.json();

    assertResponse(
      typeof responseJson === "object" &&
        responseJson !== null &&
        "type" in responseJson &&
        responseJson.type === expectedType,
      message,
      { status, statusText, headers },
    );

    return responseJson as Extract<T, { type: TType }>;
  };

export function isNonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined;
}

export function isNonNullableObject<T>(
  value: T,
): value is NonNullable<T> & object {
  return typeof value === "object" && isNonNullable(value);
}
