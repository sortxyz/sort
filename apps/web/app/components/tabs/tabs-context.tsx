import { createContext, useContext } from "react";
import type { useTabs } from "./use-tabs";

export const TabsContext = createContext<
  ReturnType<typeof useTabs> | undefined
>(undefined);

export function useTabsContext() {
  const context = useContext(TabsContext);
  if (context === undefined) {
    throw new Error("useTabsContext must be used within a Tabs component");
  }
  return context;
}
