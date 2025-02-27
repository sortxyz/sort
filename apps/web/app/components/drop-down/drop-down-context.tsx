import { createContext, useContext } from "react";
import type { useActionMenuButton } from "~/hooks/use-action-menu-button";

export const DropDownContext = createContext<
  ReturnType<typeof useActionMenuButton<HTMLLIElement>> | undefined
>(undefined);

export function useDropDownContext() {
  const context = useContext(DropDownContext);

  if (!context) {
    throw new Error(
      "useDropDownContext must be used within a DropDownProvider",
    );
  }

  return context;
}
