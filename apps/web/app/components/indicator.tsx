import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";

export function Indicator({
  intent,
  space,
  ...props
}: UIComponentProps<"span"> & {
  intent?: "secondary";
  space?: "xs";
}) {
  return (
    <span
      {...props}
      className={clsx(
        "inline-flex aspect-square shrink-0 items-center justify-center truncate rounded-full text-center font-medium",
        {
          "text-2xs h-3.5": space === "xs",
          "h-6 text-xs": space === undefined,
          "bg-gray-300 text-gray-900": intent === "secondary",
        },
      )}
    />
  );
}
