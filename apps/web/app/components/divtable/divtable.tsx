import { forwardRef } from "react";
import type { UIComponentProps } from "~/utils/component";

export const Divtable = forwardRef<HTMLDivElement, UIComponentProps<"div">>(
  function Divtable(props, forwardedRef) {
    return (
      <div
        {...props}
        ref={forwardedRef}
        role="table"
        className="flex h-0 max-w-full grow flex-col overflow-x-auto bg-white text-sm [contain:paint] [contain-intrinsic-height:auto_28px] [contain-intrinsic-width:auto_200px] [content-visibility:auto]"
      />
    );
  },
);
