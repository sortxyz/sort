import type { UIComponentProps } from "~/utils/component";

export function GroupFieldLabel(props: UIComponentProps<"legend">) {
  return <legend {...props} className="text-sm font-medium text-gray-900" />;
}
