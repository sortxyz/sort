import { IconChevronDown } from "@tabler/icons-react";
import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";
import { genericForwardRef } from "~/utils/react";

export const FieldSelect = genericForwardRef<
  React.ElementRef<"select">,
  UIComponentProps<"select"> & {
    iconLeft?: React.ReactElement<React.ComponentProps<"svg">, "svg">;
  }
>(function FieldSelect({ iconLeft, ...props }, ref) {
  return (
    <div className="relative flex grow items-center gap-3">
      {iconLeft ? (
        <span className="pointer-events-none absolute left-1.5">
          {iconLeft}
        </span>
      ) : undefined}
      <select
        {...props}
        ref={ref}
        className={clsx(
          "user-invalid:border-red-600 grow appearance-none rounded-lg border border-gray-300 bg-white py-2 pr-9 text-base text-gray-900 placeholder:text-gray-600 hover:border-gray-400 focus:outline-blue-600 disabled:opacity-50 disabled:hover:border-gray-300 sm:text-sm",
          {
            "pl-9": iconLeft,
            "pl-4": !iconLeft,
          },
        )}
      />
      <span className="pointer-events-none absolute right-1.5">
        <IconChevronDown className="stroke-1.5 size-4 text-gray-600" />
      </span>
    </div>
  );
});
