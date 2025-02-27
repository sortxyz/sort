import { forwardRef } from "react";
import type { UIComponentProps } from "~/utils/component";

export const DivtableTbodyRow = forwardRef<
  HTMLDivElement,
  UIComponentProps<"div">
>(function DivtableTbodyRow(props, forwardedRef) {
  return (
    <div
      {...props}
      ref={forwardedRef}
      role="row"
      className="group flex w-fit"
    />
  );
});
