import { forwardRef } from "react";
import type { UIComponentProps } from "~/utils/component";

export const DivtableTheadRow = forwardRef<
  HTMLDivElement,
  UIComponentProps<"div">
>(function DivtableTheadRow(props, forwardedRef) {
  return (
    <div {...props} ref={forwardedRef} role="row" className="flex w-fit" />
  );
});
