import { useCallback, useId, useMemo, useRef, useState } from "react";
import { useIsomorphicLayoutEffect } from "~/hooks/use-isomorphic-layout-effect";

export function useTabs({
  asTabs,
  category,
  defaultSelectedIndex = 0,
  layout,
  selectedIndex: controlledSelectedIndex,
  setSelectedIndex: setControlledSelectedIndex,
}: {
  asTabs?: true;
  category?: "underlined";
  defaultSelectedIndex?: number;
  layout?: "page";
  selectedIndex?: number;
  setSelectedIndex?: React.Dispatch<React.SetStateAction<number>>;
}) {
  const [uncontrolledSelectedIndex, setUncontrolledSelectedIndex] =
    useState<number>(defaultSelectedIndex);
  const setControlledSelectedIndexRef = useRef(setControlledSelectedIndex);
  useIsomorphicLayoutEffect(() => {
    setControlledSelectedIndexRef.current = setControlledSelectedIndex;
  });
  const setSelectedIndex = useCallback<
    React.Dispatch<React.SetStateAction<number>>
  >((value) => {
    setUncontrolledSelectedIndex(value);
    setControlledSelectedIndexRef.current?.(value);
  }, []);
  const selectedIndex = controlledSelectedIndex ?? uncontrolledSelectedIndex;
  const selectedIndexState = useMemo<
    [number, React.Dispatch<React.SetStateAction<number>>]
  >(() => [selectedIndex, setSelectedIndex], [selectedIndex, setSelectedIndex]);

  const tabsListLabelledByState = useState<string | undefined>();
  const tabsId = useId();

  return useMemo(
    () => ({
      asTabs,
      category,
      layout,
      selectedIndexState,
      tabsId,
      tabsListLabelledByState,
    }),
    [
      asTabs,
      category,
      layout,
      selectedIndexState,
      tabsId,
      tabsListLabelledByState,
    ],
  );
}
