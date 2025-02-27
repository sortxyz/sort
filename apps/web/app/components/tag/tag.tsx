import { genericForwardRef } from "~/utils/react";
import type { GetTagProps } from "./get-tag-props";
import { getTagProps } from "./get-tag-props";

export const Tag = genericForwardRef<
  React.ElementRef<"span">,
  GetTagProps<"span">
>(function Tag(props, ref) {
  return <span {...getTagProps("span", props)} ref={ref} />;
});
