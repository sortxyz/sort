import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";
import { genericForwardRef } from "~/utils/react";

export const FieldInput = genericForwardRef<
  React.ElementRef<"input">,
  UIComponentProps<"input"> & {
    iconLeft?: React.ReactElement<React.ComponentProps<"svg">, "svg">;
    iconRight?: React.ReactElement<React.ComponentProps<"svg">, "svg">;
  }
>(function FieldInput({ iconLeft, iconRight, ...props }, ref) {
  return (
    <div className="relative flex grow items-center gap-3">
      {iconLeft ? (
        <span className="pointer-events-none absolute left-2">{iconLeft}</span>
      ) : undefined}
      <input
        {...props}
        ref={ref}
        className={clsx(
          "user-invalid:border-red-600 min-w-0 grow rounded-md border border-gray-300 bg-white py-2 text-base text-gray-900 placeholder:text-gray-600 hover:border-gray-400 focus:border-transparent focus:outline-2 focus:outline-offset-0 focus:outline-blue-600 disabled:opacity-50 disabled:hover:border-gray-300 sm:text-sm",
          {
            "h-9 min-w-14": props.type === "color",
            "pl-9": iconLeft,
            "pl-4": !iconLeft,
            "pr-4": !iconRight,
            "pr-9": iconRight,
          },
        )}
      />
      {iconRight ? (
        <span className="pointer-events-none absolute right-1.5">
          {iconRight}
        </span>
      ) : undefined}
    </div>
  );
});
