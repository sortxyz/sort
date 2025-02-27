import type { EditorStateConfig } from "@codemirror/state";
import { EditorView } from "codemirror";
import { useEffect, useRef } from "react";

interface UseCodeMirrorProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  extensions: NonNullable<EditorStateConfig["extensions"]>[];
}

export function useCodeMirror({
  containerRef,
  value,
  onChange,
  onFocus,
  onBlur,
  extensions,
}: UseCodeMirrorProps) {
  const editorViewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current || editorViewRef.current) {
      return;
    }

    const view = new EditorView({
      parent: containerRef.current,
      doc: value,
      extensions: [
        ...extensions,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const docValue = update.state.doc.toString();
            onChange(docValue);
          }
          if (update.focusChanged) {
            if (update.view.hasFocus) {
              onFocus?.();
            } else {
              onBlur?.();
            }
          }
        }),
      ],
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
  }, [containerRef, extensions, onChange, onFocus, onBlur]);

  useEffect(() => {
    const editorView = editorViewRef.current;
    if (editorView) {
      const currentValue = editorView.state.doc.toString();
      if (value !== currentValue) {
        editorView.dispatch({
          changes: { from: 0, to: currentValue.length, insert: value },
        });
      }
    }
  }, [value]);
}
