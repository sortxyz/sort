import type { FlagDefinitionType } from "@vercel/flags";
import { decrypt } from "@vercel/flags";
import { parse } from "cookie";
import { serverEnv } from "~/utils/env.server";

type Flag = "changeRequests" | "describeChanges";

export type Flags = Record<Flag, boolean>;

const defaultFlag = serverEnv.NODE_ENV === "development";

/**
 * If you are in development or you've explicitly enabled this feature, the only override is through the UI.
 * @param request
 * @returns
 */
export async function getFlags(request: Request) {
  const cookieHeader = request.headers.get("Cookie");
  const cookies = cookieHeader ? parse(cookieHeader) : {};
  const overridesCookie = cookies["vercel-flag-overrides"];

  const {
    changeRequests = serverEnv.SORT_WEB_CHANGE_REQUESTS_ENABLED || defaultFlag,
    describeChanges = (!!serverEnv.SORT_AI &&
      serverEnv.SORT_WEB_DESCRIBE_CHANGES_ENABLED) ||
      (!!serverEnv.SORT_AI && defaultFlag),
  } = overridesCookie
    ? serverEnv.SORT_HOSTED_THROUGH === "vercel"
      ? ((await decrypt<Partial<Flags>>(
          overridesCookie,
          serverEnv.VERCEL_FLAGS_SECRET,
        )) ?? {})
      : {}
    : {};

  const flags = {
    changeRequests,
    describeChanges,
  };

  return flags;
}

export function getFlagDefinitions() {
  return {
    changeRequests: {
      description:
        "Change requests allow users to request changes to the database.",
      options: [
        { value: true, label: "Enable" },
        { value: false, label: "Disable" },
      ],
    },
    describeChanges: {
      description:
        "Describe changes allows users to describe changes to the database usng AI.",
      options: [
        { value: true, label: "Enable" },
        { value: false, label: "Disable" },
      ],
    },
  } satisfies Record<Flag, FlagDefinitionType>;
}
