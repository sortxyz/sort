import type { ApiData } from "@vercel/flags";
import { verifyAccess } from "@vercel/flags";
import type { LoaderFunctionArgs } from "react-router";
import { serverEnv } from "~/utils/env.server";
import { assertResponse } from "~/utils/response";

export async function loader({ request }: LoaderFunctionArgs) {
  const access =
    serverEnv.SORT_HOSTED_THROUGH === "vercel"
      ? await verifyAccess(
          request.headers.get("Authorization"),
          serverEnv.VERCEL_FLAGS_SECRET,
        )
      : true;

  assertResponse(access, "Unauthorized", { status: 401 });

  return {
    definitions: {
      changeRequests: {
        description: "Whether change requests are enabled for the user",
        options: [{ value: false }, { value: true }],
      },
      describeChanges: {
        description: "Whether describe changes is enabled for the user",
        options: [{ value: false }, { value: true }],
      },
    },
    overrideEncryptionMode: "encrypted",
  } satisfies ApiData;
}
