import { forwardRef } from "react";
import type { UIComponentProps } from "~/utils/component";

export const DivtableCell = forwardRef<HTMLDivElement, UIComponentProps<"div">>(
  function DivtableCell(props, forwardedRef) {
    return (
      <div
        {...props}
        ref={forwardedRef}
        role="cell"
        className="shadow-hairline p-px text-sm/4 text-slate-900 shadow-gray-300 group-even:bg-gray-50 sm:text-xs/4"
      />
    );
  },
);
