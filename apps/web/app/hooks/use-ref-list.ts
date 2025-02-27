import { useCallback, useMemo, useState } from "react";

export function useRefList<T extends HTMLElement>(): [
  T[],
  React.RefCallback<T>,
] {
  const [elements, setElements] = useState<T[]>([]);

  const refCallback = useCallback<React.RefCallback<T>>((element) => {
    setElements((prevElements) => {
      if (element) {
        if (!prevElements.includes(element)) {
          return [...prevElements, element];
        }

        return prevElements;
      }

      return prevElements.filter((el) => el.isConnected);
    });
  }, []);

  return useMemo(() => [elements, refCallback], [elements, refCallback]);
}
