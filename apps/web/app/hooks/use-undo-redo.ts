import { useCallback, useState } from "react";

type HistoryState<T> = {
  past: T[];
  present: T;
  future: T[];
};

export function useUndoRedo<T>(initialPresent: T) {
  const [state, setState] = useState<HistoryState<T>>({
    past: [],
    present: initialPresent,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const undo = useCallback(() => {
    setState((currentState) => {
      const { past, present, future } = currentState;
      if (!canUndo) {
        return currentState;
      }

      const previous = past[past.length - 1]!;
      return {
        past: past.slice(0, -1),
        present: previous,
        future: [present, ...future],
      };
    });
  }, [canUndo]);

  const redo = useCallback(() => {
    setState((currentState) => {
      const { past, present, future } = currentState;
      if (!canRedo) {
        return currentState;
      }

      const next = future[0]!;
      return {
        past: [...past, present],
        present: next,
        future: future.slice(1),
      };
    });
  }, [canRedo]);

  const update = useCallback<React.Dispatch<React.SetStateAction<T>>>(
    (action) => {
      setState((currentState) => {
        const { past, present } = currentState;
        const newPresent =
          typeof action === "function"
            ? (action as (prev: T) => T)(present)
            : action;
        if (newPresent === present) {
          return currentState;
        }

        return {
          past: [...past, present],
          present: newPresent,
          future: [],
        };
      });
    },
    [],
  );

  const reset = useCallback((newPresent: T) => {
    setState({
      past: [],
      present: newPresent,
      future: [],
    });
  }, []);

  return {
    present: state.present,
    undo,
    redo,
    update,
    reset,
    canUndo,
    canRedo,
  };
}
