import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";

export function TableCell({
  textAlign,
  space,
  collapseBorder,
  layout,
  ...props
}: UIComponentProps<"td"> & {
  textAlign?: "left" | "center" | "right";
  space?: "sm" | "md" | "lg" | "xl" | undefined;
  collapseBorder?: boolean;
  layout?: "dropdown";
}) {
  return (
    <td
      {...props}
      className={clsx(
        "border-black/10 px-2 py-3 text-sm/4 text-slate-900 first-of-type:pl-3 md:first-of-type:pl-7",
        {
          "text-center": textAlign === "center",
          "text-left": textAlign === "left",
          "text-right": textAlign === "right",
          "border peer-[.border-l]:border-l-0": !collapseBorder,
          "peer border-y border-l": collapseBorder,
          "w-20": layout === "dropdown",
        },
        {
          "px-4 py-3 text-sm sm:text-xs": space === "sm",
          "px-4 py-4 text-sm sm:text-sm": space === "md",
          "sm:text-md px-6 py-6 text-sm": space === "lg",
          "px-8 py-8 text-sm sm:text-lg": space === "xl",
          "sm:text-xs": space === undefined,
        },
      )}
    />
  );
}
