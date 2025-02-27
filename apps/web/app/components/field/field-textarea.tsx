import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";
import { genericForwardRef } from "~/utils/react";

export const FieldTextarea = genericForwardRef<
  React.ElementRef<"textarea">,
  UIComponentProps<"textarea"> & {
    iconLeft?: React.ReactElement<React.ComponentProps<"svg">, "svg">;
  }
>(function FieldTextarea({ iconLeft, ...props }, ref) {
  return (
    <div className="relative flex grow items-start gap-3">
      {iconLeft ? (
        <span className="pointer-events-none absolute top-[7px] left-1.5">
          {iconLeft}
        </span>
      ) : undefined}
      <textarea
        {...props}
        ref={ref}
        className={clsx(
          "user-invalid:border-red-600 grow rounded-md border border-gray-300 bg-white py-2 pr-4 text-base text-gray-900 placeholder:text-gray-600 hover:border-gray-400 focus:outline-blue-600 disabled:opacity-50 disabled:hover:border-gray-300 sm:text-sm",
          {
            "pl-9": iconLeft,
            "pl-4": !iconLeft,
          },
        )}
      />
    </div>
  );
});
