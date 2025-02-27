import { useEffect } from "react";
import { createUpdateEffect } from "./create-update-effect";

export const useUpdateEffect = createUpdateEffect(useEffect);
