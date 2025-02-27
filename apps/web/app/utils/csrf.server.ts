import { createCookie } from "react-router";
import { CSRF, CSRFError } from "remix-utils/csrf/server";
import { serverEnv } from "./env.server";

const cookie = createCookie("csrf", {
  path: "/",
  httpOnly: true,
  secure: serverEnv.NODE_ENV === "production",
  sameSite: "lax",
  secrets: [serverEnv.SORT_WEB_SESSION_SECRET],
});

export const csrf = new CSRF({
  cookie,
  secret: serverEnv.SORT_WEB_SESSION_SECRET,
});

export async function validateCsrf(...args: Parameters<typeof csrf.validate>) {
  try {
    return await csrf.validate(...args);
  } catch (error) {
    if (error instanceof CSRFError) {
      throw new Response("Invalid CSRF token. Please logout and back in.", {
        status: 403,
      });
    }
    throw error;
  }
}
