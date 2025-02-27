import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";
import type { GroupFieldField } from "./group-field-field";
import type { GroupFieldHelperText } from "./group-field-helper-text";
import type { GroupFieldLabel } from "./group-field-label";

export function GroupField({
  children,
  errorHelperText,
  fullWidth,
  helperText,
  label,
  labelCueRight,
  ...props
}: UIComponentProps<"fieldset"> & {
  children: (
    | React.FunctionComponentElement<typeof GroupFieldField>
    | undefined
  )[];
  label?: React.FunctionComponentElement<typeof GroupFieldLabel>;
  labelCueRight?: React.ReactElement<unknown>;
  helperText?: React.FunctionComponentElement<typeof GroupFieldHelperText>;
  errorHelperText?: React.FunctionComponentElement<typeof GroupFieldHelperText>;
  fullWidth?: boolean;
}) {
  return (
    <fieldset
      {...props}
      className={clsx("flex-col gap-1", {
        "inline-flex shrink-0": !fullWidth,
        "flex grow": fullWidth,
      })}
    >
      {label ? (
        <div className="flex items-center">
          <div className="grow">{label}</div>
          {labelCueRight ? (
            <span className="inline-flex shrink-0">{labelCueRight}</span>
          ) : undefined}
        </div>
      ) : undefined}
      {children ? (
        <div className="flex flex-col gap-2">{children}</div>
      ) : undefined}
      {helperText ? <div>{helperText}</div> : undefined}
      {errorHelperText ? <div>{errorHelperText}</div> : undefined}
    </fieldset>
  );
}
