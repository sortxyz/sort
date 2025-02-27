import { createCookieSessionStorage } from "react-router";
import { serverEnv } from "./env.server";

const flashKey = "flash";

type Flash = {
  type: "success" | "error" | "info";
  message: string;
};

export type SessionFlashData = {
  flash: Flash;
};

export const flashSessionStorage = createCookieSessionStorage<SessionFlashData>(
  {
    cookie: {
      name: "appFlash",
      sameSite: "lax",
      path: "/",
      maxAge: 60,
      httpOnly: true,
      secrets: [serverEnv.SORT_WEB_SESSION_SECRET],
      secure: serverEnv.NODE_ENV === "production",
    },
  },
);

export async function getFlash(request: Request) {
  const session = await flashSessionStorage.getSession(
    request.headers.get("Cookie"),
  );

  const flash = session.get(flashKey);

  const cookie = await flashSessionStorage.commitSession(session);

  return {
    flash,
    headers: new Headers({
      "Set-Cookie": cookie,
    }),
  };
}

export async function setFlashHeaders(flash: Flash) {
  const session = await flashSessionStorage.getSession();
  session.flash(flashKey, flash);
  const cookie = await flashSessionStorage.commitSession(session);
  return new Headers({
    "Set-Cookie": cookie,
  });
}

// Utility function to forward flash messages from one request to another
export async function setFlashHeadersFromRequest(request: Request) {
  const session = await flashSessionStorage.getSession(
    request.headers.get("Cookie"),
  );

  const cookie = await flashSessionStorage.commitSession(session);

  return new Headers({
    "Set-Cookie": cookie,
  });
}
