import type { FieldMetadata } from "@conform-to/react";
import { getInputProps } from "@conform-to/react";
import { Field, FieldHelperText, FieldInput, FieldLabel } from "../field";

// TODO `getInputProps` should probably only return `defaultValue` but right now it returns both `value` and `defaultValue`
// this doesn't happen for any of the other form helpers
type ControlFieldInputBaseProps = Omit<
  React.ComponentPropsWithoutRef<typeof FieldInput>,
  | keyof ReturnType<typeof getInputProps>
  | "aria-label"
  | "aria-labelledby"
  | "type"
> & {
  field: FieldMetadata;
  type:
    | "text"
    | "password"
    | "email"
    | "url"
    | "number"
    | "tel"
    | "date"
    | "datetime-local"
    | "search"
    | "color";
  helperText?: React.ReactNode;
  fullWidth?: boolean;
  step?: string | number | undefined;
};

export type ControlFieldInputProps =
  | (ControlFieldInputBaseProps & {
      label: React.ReactNode;
      labelCueRight?: React.ReactElement<unknown>;
    })
  | (ControlFieldInputBaseProps & {
      "aria-label": string;
      label?: undefined;
      labelCueRight?: undefined;
    })
  | (ControlFieldInputBaseProps & {
      "aria-labelledby": string;
      label?: undefined;
      labelCueRight?: undefined;
    });

export function ControlFieldInput({
  field,
  fullWidth,
  helperText,
  label,
  labelCueRight,
  type,
  ...props
}: ControlFieldInputProps) {
  return (
    <Field
      fullWidth={fullWidth}
      labelCueRight={labelCueRight}
      errorHelperText={
        !field.valid && field.errors ? (
          <FieldHelperText intent="error" id={field.errorId}>
            {field.errors}
          </FieldHelperText>
        ) : undefined
      }
      helperText={
        field.valid && helperText ? (
          <FieldHelperText id={field.descriptionId}>
            {helperText}
          </FieldHelperText>
        ) : undefined
      }
      label={
        label ? <FieldLabel htmlFor={field.id}>{label}</FieldLabel> : undefined
      }
    >
      <FieldInput
        {...props}
        {...getInputProps(field, {
          type,
          ariaDescribedBy: field.valid ? field.descriptionId : field.errorId,
        })}
      />
    </Field>
  );
}
