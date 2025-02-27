import type { FieldMetadata } from "@conform-to/react";
import { getTextareaProps } from "@conform-to/react";
import { Field, FieldHelperText, FieldLabel, FieldTextarea } from "../field";

type ControlFieldTextareaBaseProps = Omit<
  React.ComponentPropsWithoutRef<typeof FieldTextarea>,
  keyof ReturnType<typeof getTextareaProps>
> & {
  field: FieldMetadata;
  fullWidth?: boolean;
  helperText?: React.ReactNode;
};

export type ControlFieldTextareaProps =
  | (ControlFieldTextareaBaseProps & {
      label: React.ReactNode;
      labelCueRight?: React.ReactElement<unknown>;
    })
  | (ControlFieldTextareaBaseProps & {
      "aria-label": string;
      label?: undefined;
      labelCueRight?: undefined;
    })
  | (ControlFieldTextareaBaseProps & {
      "aria-labelledby": string;
      label?: undefined;
      labelCueRight?: undefined;
    });

export function ControlFieldTextarea({
  field,
  fullWidth,
  helperText,
  label,
  labelCueRight,
  ...props
}: ControlFieldTextareaProps) {
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
      <FieldTextarea
        {...props}
        {...getTextareaProps(field, {
          ariaDescribedBy: field.valid ? field.descriptionId : field.errorId,
        })}
      />
    </Field>
  );
}
