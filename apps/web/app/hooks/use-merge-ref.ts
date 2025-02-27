import { useCallback } from "react";

export function useMergeRef<T>(
  ...refsToMerge: React.Ref<T>[]
): React.RefCallback<T> {
  return useCallback(
    (current: T) => {
      refsToMerge.forEach((ref) => {
        if (typeof ref === "function") {
          ref(current);
        } else if (ref != null) {
          (ref as React.MutableRefObject<T | null>).current = current;
        }
      });
    },
    [refsToMerge],
  );
}
