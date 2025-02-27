import { createContext, useContext } from "react";

export type TableContextValue = {
  tone?: "striped";
};

export const TableContext = createContext<TableContextValue | undefined>(
  undefined,
);

export function useTableContext() {
  const context = useContext(TableContext);

  if (!context) {
    throw new Error("useTableContext must be used within a Table");
  }

  return context;
}
