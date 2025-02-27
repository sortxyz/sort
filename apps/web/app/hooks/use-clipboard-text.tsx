import { useState } from "react";

export type ClipboardTextState =
  | {
      state: "idle";
    }
  | {
      state: "loading";
    }
  | {
      state: "resolved";
      value: string;
    }
  | {
      state: "rejected";
      value: unknown;
    };

export function useClipboardText(
  ms?: number,
): [ClipboardTextState, (text: string) => Promise<void>] {
  const [state, setState] = useState<ClipboardTextState>({
    state: "idle",
  });

  async function writeText(text: string) {
    setState({ state: "loading" });
    try {
      await navigator.clipboard.writeText(text);
      setState({ state: "resolved", value: text });
    } catch (error) {
      setState({ state: "rejected", value: error });
    } finally {
      setTimeout(() => {
        setState({ state: "idle" });
      }, ms);
    }
  }

  return [state, writeText];
}
