import { genericForwardRef } from "~/utils/react";
import type { GetAnchorProps } from "./get-anchor-props";
import { getAnchorProps } from "./get-anchor-props";

export const Anchor = genericForwardRef<
  React.ElementRef<"a">,
  GetAnchorProps<"a">
>(function Anchor(props, ref) {
  // eslint-disable-next-line jsx-a11y/anchor-has-content
  return <a {...getAnchorProps("a", props)} ref={ref} />;
});
