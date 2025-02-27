import type { V2 } from "@sort/sdk";
import { createCookieSessionStorage } from "react-router";
import { serverEnv } from "~/utils/env.server";

export type SessionData = Record<
  typeof sessionKey,
  {
    sortProfile: V2.Profile;
    sortJWT: string;
    auth_time: number | undefined;
  }
>;

export const sessionKey = "user";

export const sessionStorage = createCookieSessionStorage<SessionData>({
  cookie: {
    name: "appSession",
    sameSite: "lax",
    path: "/",
    httpOnly: true,
    secrets: [serverEnv.SORT_WEB_SESSION_SECRET],
    secure: serverEnv.NODE_ENV === "production",
    maxAge: 259000, // Seconds. Just under 3 days.
  },
});

export const { getSession, commitSession, destroySession } = sessionStorage;
