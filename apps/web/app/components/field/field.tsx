import clsx from "clsx";
import type {
  FieldHelperText,
  FieldInput,
  FieldLabel,
  FieldSelect,
  FieldTextarea,
} from ".";

export function Field({
  children,
  errorHelperText,
  fullWidth,
  helperText,
  label,
  labelCueRight,
}: {
  children:
    | React.FunctionComponentElement<typeof FieldInput>
    | React.FunctionComponentElement<typeof FieldSelect>
    | React.FunctionComponentElement<typeof FieldTextarea>;
  label?: React.FunctionComponentElement<typeof FieldLabel>;
  labelCueRight?: React.ReactElement<unknown>;
  helperText?: React.FunctionComponentElement<typeof FieldHelperText>;
  errorHelperText?: React.FunctionComponentElement<typeof FieldHelperText>;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={clsx("flex-col gap-1", {
        "inline-flex shrink-0": !fullWidth,
        "flex min-w-0 grow": fullWidth,
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
      {children ? <div>{children}</div> : undefined}
      {helperText ? <div>{helperText}</div> : undefined}
      {errorHelperText ? <div>{errorHelperText}</div> : undefined}
    </div>
  );
}
