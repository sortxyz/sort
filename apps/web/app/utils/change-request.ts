import type { V2 } from "@sort/sdk";

export function isActiveStatus(
  status: V2.ChangeRequest["status"],
): status is "open" | "approved" {
  return /^(?:open|approved)$/.test(status);
}
