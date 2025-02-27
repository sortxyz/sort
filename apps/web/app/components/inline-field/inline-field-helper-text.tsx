import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";

export function InlineFieldHelperText(
  props: UIComponentProps<"div"> & { intent?: "error" },
) {
  return (
    <div
      {...props}
      className={clsx("text-xs", {
        "text-red-600": props.intent === "error",
        "text-gray-500": props.intent === undefined,
      })}
    />
  );
}
