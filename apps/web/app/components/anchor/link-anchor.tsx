import { Link } from "react-router";
import { genericForwardRef } from "~/utils/react";
import type { GetAnchorProps } from "./get-anchor-props";
import { getAnchorProps } from "./get-anchor-props";

export const LinkAnchor = genericForwardRef<
  React.ElementRef<typeof Link>,
  GetAnchorProps<typeof Link>
>(function LinkAnchor(props, ref) {
  return <Link {...getAnchorProps(Link, props)} ref={ref} />;
});
