import type { FieldMetadata } from "@conform-to/react";
import { getFieldsetProps } from "@conform-to/react";
import {
  GroupField,
  GroupFieldHelperText,
  GroupFieldLabel,
} from "../group-field";

type ControlGroupFieldBaseProps = Omit<
  React.ComponentPropsWithoutRef<typeof GroupField>,
  "errorHelperText" | keyof ReturnType<typeof getFieldsetProps> | "label"
> & {
  field: FieldMetadata;
  fullWidth?: boolean;
};

export type ControlGroupFieldProps =
  | (ControlGroupFieldBaseProps & {
      label: string;
      labelCueRight?: ControlGroupFieldBaseProps["labelCueRight"];
    })
  | (ControlGroupFieldBaseProps & {
      "aria-label": NonNullable<ControlGroupFieldBaseProps["aria-label"]>;
      label?: undefined;
      labelCueRight?: undefined;
    })
  | (ControlGroupFieldBaseProps & {
      "aria-labelledby": NonNullable<
        ControlGroupFieldBaseProps["aria-labelledby"]
      >;
      label?: undefined;
      labelCueRight?: undefined;
    });

export function ControlGroupField({
  field,
  fullWidth,
  helperText,
  label,
  labelCueRight,
  ...props
}: ControlGroupFieldProps) {
  return (
    <GroupField
      {...props}
      {...getFieldsetProps(field, {
        ariaDescribedBy: field.errors ? field.errorId : field.descriptionId,
      })}
      fullWidth={fullWidth}
      labelCueRight={labelCueRight}
      errorHelperText={
        !field.valid && field.errors ? (
          <GroupFieldHelperText intent="error" id={field.errorId}>
            {field.errors}
          </GroupFieldHelperText>
        ) : undefined
      }
      helperText={
        field.valid && helperText ? (
          <GroupFieldHelperText id={field.descriptionId}>
            {helperText}
          </GroupFieldHelperText>
        ) : undefined
      }
      label={label ? <GroupFieldLabel>{label}</GroupFieldLabel> : undefined}
    />
  );
}
