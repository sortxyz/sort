import { useState } from "react";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";

type UseMediaQueryOptions = {
  defaultValue?: boolean;
  initializeWithValue?: boolean;
};

export function useMediaQuery(
  query: string,
  {
    defaultValue = false,
    initializeWithValue = true,
  }: UseMediaQueryOptions = {},
): boolean {
  const [matches, setMatches] = useState(() => {
    if (initializeWithValue) {
      if (typeof window === "undefined") {
        return defaultValue;
      }
      return window.matchMedia(query).matches;
    }

    return defaultValue;
  });

  useIsomorphicLayoutEffect(() => {
    const matchMedia = window.matchMedia(query);
    setMatches(matchMedia.matches);

    // Triggered at the first client-side load and if query changes
    const handleChange = (event: MediaQueryListEvent) =>
      setMatches(event.matches);

    // Use deprecated `addListener` and `removeListener` to support Safari < 14 (#135)
    try {
      matchMedia.addEventListener("change", handleChange);
    } catch {
      matchMedia.addListener(handleChange);
    }

    return () => {
      try {
        matchMedia.removeEventListener("change", handleChange);
      } catch {
        matchMedia.removeListener(handleChange);
      }
    };
  }, [query]);

  return matches;
}
