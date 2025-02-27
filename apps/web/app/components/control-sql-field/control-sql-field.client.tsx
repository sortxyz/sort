import { sql } from "@codemirror/lang-sql";
import { EditorState } from "@codemirror/state";
import type { FieldMetadata } from "@conform-to/react";
import { getInputProps, useInputControl } from "@conform-to/react";
import { EditorView, basicSetup } from "codemirror";
import { useMemo, useRef } from "react";
import { useCodeMirror } from "~/hooks/use-code-mirror";

export default function SqlFieldClient({
  schema,
  defaultTable,
  defaultSchema,
  field,
  readOnly = false,
  "aria-label": ariaLabel,
  ...props
}: Omit<React.ComponentPropsWithoutRef<"div">, "onChange"> & {
  readOnly?: boolean;
  schema?: Record<string, string[]>;
  defaultTable?: string;
  defaultSchema?: string;
  field: FieldMetadata<string | undefined>;
}) {
  const { blur, change, focus, value } = useInputControl<string>(field);

  const editorContainerRef = useRef<HTMLDivElement>(null);

  const extensions = useMemo(
    () => [
      basicSetup,
      sql({ schema, defaultTable, defaultSchema }),
      EditorView.contentAttributes.of(
        ariaLabel ? { "aria-label": ariaLabel } : {},
      ),
      EditorView.lineWrapping,
      EditorState.readOnly.of(readOnly),
    ],
    [ariaLabel, defaultSchema, defaultTable, readOnly, schema],
  );

  useCodeMirror({
    containerRef: editorContainerRef,
    value: value ?? "",
    onChange: change,
    onFocus: focus,
    onBlur: blur,
    extensions,
  });

  return (
    <>
      <div
        {...props}
        ref={editorContainerRef}
        className="max-h-28 grow overflow-auto rounded-lg border border-gray-300 bg-gray-100 p-1.5 font-mono text-xs"
      />
      <input
        {...getInputProps(field, { type: "hidden", value: false })}
        readOnly={readOnly}
        value={value}
      />
    </>
  );
}
