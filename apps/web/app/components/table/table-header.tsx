import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";

export function TableHeader({
  children,
  iconLeft,
  iconRight,
  textAlign = "left",
  collapseBorder,
  ...props
}: UIComponentProps<"th"> & {
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  textAlign?: "left" | "center" | "right";
  collapseBorder?: boolean;
}) {
  return (
    <th
      {...props}
      className={clsx(
        "border-b border-gray-300 px-2 py-3 text-sm font-medium text-gray-800 first-of-type:pl-3 last-of-type:border-r-0 md:first-of-type:pl-7",
        {
          "text-center": textAlign === "center",
          "text-left": textAlign === "left",
          "text-right": textAlign === "right",
          "border-r": !collapseBorder,
        },
      )}
    >
      <div className="flex items-center gap-1 text-xs/4 tracking-wide whitespace-nowrap">
        {iconLeft ? <span>{iconLeft}</span> : undefined}
        <span>{children}</span>
        {iconRight ? <span>{iconRight}</span> : undefined}
      </div>
    </th>
  );
}
