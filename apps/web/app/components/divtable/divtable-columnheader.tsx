import { forwardRef } from "react";
import type { UIComponentProps } from "~/utils/component";

export const DivtableColumnheader = forwardRef<
  HTMLDivElement,
  UIComponentProps<"div">
>(function DivtableColumnheader(props, forwardedRef) {
  return (
    <div
      {...props}
      ref={forwardedRef}
      role="columnheader"
      className="shadow-hairline truncate px-2 py-3 text-left text-xs/4 font-medium tracking-wide text-gray-700 shadow-gray-300"
    />
  );
});
