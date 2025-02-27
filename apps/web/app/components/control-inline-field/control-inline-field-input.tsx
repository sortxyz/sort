import type { FieldMetadata } from "@conform-to/react";
import { getInputProps } from "@conform-to/react";
import {
  InlineField,
  InlineFieldHelperText,
  InlineFieldInput,
  InlineFieldLabel,
} from "../inline-field";

export function ControlInlineFieldInput({
  field,
  fullWidth,
  helperText,
  label,
  labelCueRight,
  type,
  ...props
}: Omit<
  React.ComponentPropsWithoutRef<typeof InlineFieldInput>,
  keyof ReturnType<typeof getInputProps>
> & {
  field: FieldMetadata;
  label: React.ReactNode;
  labelCueRight?: React.ReactElement<unknown>;
  type: "checkbox";
  helperText?: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <InlineField
      fullWidth={fullWidth}
      labelCueRight={labelCueRight}
      errorHelperText={
        !field.valid && field.errors ? (
          <InlineFieldHelperText intent="error" id={field.errorId}>
            {field.errors}
          </InlineFieldHelperText>
        ) : undefined
      }
      helperText={
        field.valid && helperText ? (
          <InlineFieldHelperText id={field.descriptionId}>
            {helperText}
          </InlineFieldHelperText>
        ) : undefined
      }
      label={<InlineFieldLabel htmlFor={field.id}>{label}</InlineFieldLabel>}
    >
      <InlineFieldInput
        {...props}
        {...getInputProps(field, {
          type,
          ariaDescribedBy: field.valid ? field.descriptionId : field.errorId,
        })}
      />
    </InlineField>
  );
}
