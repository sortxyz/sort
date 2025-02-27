import { IconLock, IconWorld } from "@tabler/icons-react";
import { Tag } from "./tag";

export function VisibilityTag({
  visibility,
}: {
  visibility: "private" | "public";
}) {
  switch (visibility) {
    case "private":
      return (
        <Tag
          intent="negative"
          iconLeft={<IconLock className="stroke-1.5 size-4" />}
        >
          Private
        </Tag>
      );
    case "public":
      return (
        <Tag
          intent="positive"
          iconLeft={<IconWorld className="stroke-1.5 size-4" />}
        >
          Public
        </Tag>
      );
    default:
      return undefined;
  }
}
