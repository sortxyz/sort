import type { FieldMetadata } from "@conform-to/react";
import { getSelectProps } from "@conform-to/react";
import { Field, FieldHelperText, FieldLabel, FieldSelect } from "../field";

type ControlFieldSelectBaseProps = Omit<
  React.ComponentPropsWithoutRef<typeof FieldSelect>,
  keyof ReturnType<typeof getSelectProps>
> & {
  field: FieldMetadata;
  helperText?: React.ReactNode;
  fullWidth?: boolean;
};

export type ControlFieldSelectProps =
  | (ControlFieldSelectBaseProps & {
      label: React.ReactNode;
      labelCueRight?: React.ReactElement<unknown>;
    })
  | (ControlFieldSelectBaseProps & {
      "aria-label": string;
      label?: undefined;
      labelCueRight?: undefined;
    })
  | (ControlFieldSelectBaseProps & {
      "aria-labelledby": string;
      label?: undefined;
      labelCueRight?: undefined;
    });

export function ControlFieldSelect({
  field,
  fullWidth,
  helperText,
  label,
  labelCueRight,
  ...props
}: ControlFieldSelectProps) {
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
      <FieldSelect
        {...props}
        {...getSelectProps(field, {
          ariaDescribedBy: field.valid ? field.descriptionId : field.errorId,
        })}
      />
    </Field>
  );
}
