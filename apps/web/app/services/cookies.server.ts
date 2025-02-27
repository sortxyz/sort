import { createCookie } from "react-router";
import { serverEnv } from "~/utils/env.server";

export const returnToCookie = createCookie("returnTo", {
  secrets: [serverEnv.SORT_WEB_SESSION_SECRET],
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secure: serverEnv.NODE_ENV === "production",
  maxAge: 60,
});

export const reAuthCookie = createCookie("reAuth", {
  secrets: [serverEnv.SORT_WEB_SESSION_SECRET],
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secure: serverEnv.NODE_ENV === "production",
  maxAge: 120,
});
