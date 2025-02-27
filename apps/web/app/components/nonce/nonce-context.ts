import { createContext, useContext } from "react";

export const NonceContext = createContext<string>("");

export function useNonce() {
  return useContext(NonceContext);
}
