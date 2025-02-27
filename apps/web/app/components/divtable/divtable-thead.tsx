import { forwardRef } from "react";
import type { UIComponentProps } from "~/utils/component";

export const DivtableThead = forwardRef<
  HTMLDivElement,
  UIComponentProps<"div">
>(function DivtableThead(props, forwardedRef) {
  return (
    <div
      {...props}
      ref={forwardedRef}
      role="rowgroup"
      className="w-fit shrink-0 bg-gray-50"
    />
  );
});
