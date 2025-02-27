import type { UIComponentProps } from "~/utils/component";

export function Skeleton({ ...props }: UIComponentProps<"div">) {
  return <div className="animate-pulse rounded-md bg-gray-200" {...props} />;
}
