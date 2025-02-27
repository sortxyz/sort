import { createUpdateEffect } from "./create-update-effect";
import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";

export const useUpdateIsomorphicLayoutEffect = createUpdateEffect(
  useIsomorphicLayoutEffect,
);
