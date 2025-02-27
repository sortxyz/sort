import clsx from "clsx";
import type { InlineFieldHelperText } from "./inline-field-helper-text";
import type { InlineFieldInput } from "./inline-field-input";
import type { InlineFieldLabel } from "./inline-field-label";

export function InlineField({
  children,
  errorHelperText,
  fullWidth,
  helperText,
  label,
  labelCueRight,
}: {
  children: React.FunctionComponentElement<typeof InlineFieldInput>;
  labelCueRight?: React.ReactElement<unknown>;
  label?: React.FunctionComponentElement<typeof InlineFieldLabel>;
  helperText?: React.FunctionComponentElement<typeof InlineFieldHelperText>;
  errorHelperText?: React.FunctionComponentElement<
    typeof InlineFieldHelperText
  >;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={clsx("items-center gap-1", {
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
        {errorHelperText ? <div>{errorHelperText}</div> : undefined}
      </div>
    </div>
  );
}
