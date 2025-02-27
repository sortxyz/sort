import { forwardRef } from "react";
import type { UIComponentProps } from "~/utils/component";

export const DivtableTbody = forwardRef<
  HTMLDivElement,
  UIComponentProps<"div">
>(function DivtableTbody(props, forwardedRef) {
  return (
    <div
      {...props}
      ref={forwardedRef}
      role="rowgroup"
      className="h-0 w-fit grow overflow-y-auto bg-white"
    />
  );
});
