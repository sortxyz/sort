import type { ActionFunctionArgs } from "react-router";
import { logout } from "~/utils/request.server";

export async function action({ request }: ActionFunctionArgs) {
  return await logout(request);
}
