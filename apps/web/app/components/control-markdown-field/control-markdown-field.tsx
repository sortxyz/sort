import type { FieldMetadata } from "@conform-to/react";
import { getTextareaProps } from "@conform-to/react";
import { useEffect, useRef, useState } from "react";
import { useFetchers } from "react-router";
import { Field, FieldHelperText, FieldLabel, FieldTextarea } from "../field";
import { Markdown } from "../markdown";
import { Tabs, TabsList, TabsListTab, TabsPanel } from "../tabs";

type ControlFieldMarkdownTextareaBaseProps = Omit<
  React.ComponentPropsWithoutRef<typeof FieldTextarea>,
  keyof ReturnType<typeof getTextareaProps>
> & {
  label?: string;
  field: FieldMetadata;
  helperText?: React.ReactNode;
};

export type ControlMarkdownFieldTextareaProps =
  | (ControlFieldMarkdownTextareaBaseProps & {
      label: NonNullable<ControlFieldMarkdownTextareaBaseProps["label"]>;
      labelCueRight?: React.ReactElement<unknown>;
    })
  | (ControlFieldMarkdownTextareaBaseProps & {
      "aria-label": NonNullable<
        ControlFieldMarkdownTextareaBaseProps["aria-label"]
      >;
      label?: undefined;
      labelCueRight?: undefined;
    })
  | (ControlFieldMarkdownTextareaBaseProps & {
      "aria-labelledby": NonNullable<
        ControlFieldMarkdownTextareaBaseProps["aria-labelledby"]
      >;
      label?: undefined;
      labelCueRight?: undefined;
    });

export function ControlMarkdownFieldTextarea({
  field,
  helperText,
  label,
  labelCueRight,
  ...props
}: ControlMarkdownFieldTextareaProps) {
  const fetchers = useFetchers();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [content, setContent] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (fetchers.length) {
      return () => setSelectedIndex(0);
    }
  }, [fetchers]);

  return (
    <Tabs
      asTabs
      setSelectedIndex={setSelectedIndex}
      selectedIndex={selectedIndex}
    >
      <TabsList aria-label="Markdown Preview">
        <TabsListTab index={0}>Write</TabsListTab>
        <TabsListTab
          index={1}
          onClick={() => {
            setContent(textareaRef.current?.value ?? "");
          }}
        >
          Preview
        </TabsListTab>
      </TabsList>
      <TabsPanel index={0} className="py-3" ref={containerRef}>
        <Field
          fullWidth
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
          label={<FieldLabel htmlFor={field.id}>{label}</FieldLabel>}
        >
          <FieldTextarea
            {...props}
            {...getTextareaProps(field, {
              ariaDescribedBy: field.valid
                ? field.descriptionId
                : field.errorId,
            })}
            ref={textareaRef}
          />
        </Field>
      </TabsPanel>
      <TabsPanel index={1} className="prose prose-sm py-3">
        <Markdown>{content || "Nothing to preview"}</Markdown>
      </TabsPanel>
    </Tabs>
  );
}
