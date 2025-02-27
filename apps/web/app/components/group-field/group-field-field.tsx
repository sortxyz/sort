import clsx from "clsx";
import type { GroupFieldFieldHelperText } from "./group-field-field-helper-text";
import type { GroupFieldFieldInput } from "./group-field-field-input";
import type { GroupFieldFieldLabel } from "./group-field-field-label";

export function GroupFieldField({
  children,
  fullWidth,
  helperText,
  label,
  labelCueRight,
}: {
  children: React.FunctionComponentElement<typeof GroupFieldFieldInput>;
  labelCueRight?: React.ReactElement<unknown>;
  label?: React.FunctionComponentElement<typeof GroupFieldFieldLabel>;
  helperText?: React.FunctionComponentElement<typeof GroupFieldFieldHelperText>;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={clsx("items-start gap-1", {
        "inline-flex shrink-0": !fullWidth,
        "flex grow": fullWidth,
      })}
    >
      {children ? (
        <div className="flex h-6 items-center">{children}</div>
      ) : undefined}
      <div className="flex flex-col">
        {label ? (
          <div className="flex items-center">
            <div className="grow">{label}</div>
            {labelCueRight ? (
              <span className="inline-flex shrink-0">{labelCueRight}</span>
            ) : undefined}
          </div>
        ) : undefined}
        {helperText ? <div>{helperText}</div> : undefined}
      </div>
    </div>
  );
}
