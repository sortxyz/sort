import type { FieldMetadata } from "@conform-to/react";
import { getInputProps } from "@conform-to/react";
import {
  InlineField,
  InlineFieldHelperText,
  InlineFieldInput,
  InlineFieldLabel,
} from "../inline-field";

export function ControlGroupFieldInput({
  field,
  fullWidth,
  helperText,
  label,
  labelCueRight,
  type,
  ...props
}: Omit<
  React.ComponentPropsWithoutRef<typeof InlineFieldInput>,
  keyof Omit<ReturnType<typeof getInputProps>, "defaultValue">
> & {
  field: FieldMetadata;
  label: React.ReactNode;
  labelCueRight?: React.ReactElement<unknown>;
  type: "checkbox" | "radio";
  helperText?: React.ReactNode;
  fullWidth?: boolean;
}) {
  const valueField: FieldMetadata = {
    allErrors: field.allErrors,
    descriptionId: `${field.descriptionId}-${String(props.defaultValue)}`,
    dirty: field.dirty,
    errorId: field.errorId,
    errors: field.errors,
    formId: field.formId,
    id: `${field.id}-${String(props.defaultValue)}`,
    initialValue: field.initialValue,
    key: `${field.key}-${String(props.defaultValue)}`,
    name: field.name,
    valid: field.valid,
    value: field.value,
  };

  return (
    <InlineField
      fullWidth={fullWidth}
      labelCueRight={labelCueRight}
      helperText={
        helperText ? (
          <InlineFieldHelperText id={valueField.descriptionId}>
            {helperText}
          </InlineFieldHelperText>
        ) : undefined
      }
      label={
        <InlineFieldLabel htmlFor={valueField.id}>{label}</InlineFieldLabel>
      }
    >
      <InlineFieldInput
        {...props}
        {...getInputProps(valueField, {
          value: String(props.defaultValue),
          type,
          ariaDescribedBy: valueField.valid
            ? valueField.descriptionId
            : valueField.errorId,
        })}
      />
    </InlineField>
  );
}
