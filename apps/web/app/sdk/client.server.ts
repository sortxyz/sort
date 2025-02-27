import { APIClient } from "@sort/sdk";
import { serverEnv } from "~/utils/env.server";
export const client = new APIClient({ base: serverEnv.SORT_WEB_API_BASE_URL });
