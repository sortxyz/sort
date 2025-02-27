import { IconCheck } from "@tabler/icons-react";
import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";
import { genericForwardRef } from "~/utils/react";

const InlineInput = genericForwardRef<
  React.ElementRef<"input">,
  React.ComponentPropsWithoutRef<"input">
>(function InlineInput(
  { name, checked, defaultChecked, id, className, ...props },
  ref,
) {
  // Render a hidden input for read-only to submit the value,
  // as disabled inputs do not submit and readOnly does not fully lock a checkbox.
  if (props.readOnly) {
    return (
      <>
        <input {...props} name={name} type="hidden" ref={ref} />
        <input
          {...props}
          checked={checked}
          className={className}
          defaultChecked={defaultChecked}
          disabled
          id={id}
        />
      </>
    );
  }
  return (
    <input
      {...props}
      checked={checked}
      className={className}
      defaultChecked={defaultChecked}
      id={id}
      name={name}
      ref={ref}
    />
  );
});
export const GroupFieldFieldInput = genericForwardRef<
  React.ElementRef<"input">,
  UIComponentProps<"input">
>(function GroupFieldFieldInput(props, ref) {
  return (
    <div className="relative size-4">
      <InlineInput
        {...props}
        ref={ref}
        className={clsx(
          "peer absolute inset-0 size-full appearance-none border border-gray-300 bg-white outline-hidden transition-all",
          {
            [clsx(
              "rounded-sm",
              "active:bg-gray-300",
              "checked:border-blue-600 checked:bg-blue-600",
              "disabled:border-transparent disabled:bg-gray-100 disabled:opacity-50 disabled:checked:bg-gray-400 hover:disabled:bg-gray-100 hover:disabled:checked:bg-gray-400",
              "focus:border-white focus:ring-1 focus:ring-blue-700 focus:checked:border-white",
              "hover:border-gray-300 hover:bg-gray-200 hover:checked:bg-blue-600",
              "user-invalid:border-red-600",
            )]: props.type === "checkbox",
            [clsx(
              "rounded-full border border-gray-300 bg-white checked:border-blue-700",
              "active:bg-gray-300",
              "disabled:border-gray-400 disabled:bg-gray-100 disabled:opacity-50 disabled:checked:bg-white hover:disabled:bg-gray-100 hover:disabled:checked:bg-gray-400",
              "focus:border-blue-700",
              "hover:border-gray-300 hover:bg-gray-200",
              "user-invalid:border-red-600",
            )]: props.type === "radio",
          },
        )}
      />
      <div
        className={clsx({
          [clsx(
            "pointer-events-none absolute inset-0 flex size-full items-center justify-center text-white opacity-0 transition-opacity",
            "peer-checked:opacity-100 peer-disabled:text-white",
          )]: props.type === "checkbox",
          [clsx(
            "pointer-events-none absolute inset-0.5 flex items-center justify-center rounded-full transition-opacity",
            "peer-disabled:opacity-50 peer-disabled:peer-checked:bg-gray-400",
            "peer-checked:bg-blue-700",
          )]: props.type === "radio",
        })}
      >
        {props.type === "checkbox" ? (
          <IconCheck className="stroke-1.5 size-3" />
        ) : undefined}
      </div>
    </div>
  );
});
