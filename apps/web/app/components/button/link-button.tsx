import { Link } from "react-router";
import { genericForwardRef } from "~/utils/react";
import type { GetButtonProps } from "./get-button-props";
import { getButtonProps } from "./get-button-props";

export const LinkButton = genericForwardRef<
  React.ElementRef<typeof Link>,
  GetButtonProps<typeof Link>
>(function LinkButton(props, ref) {
  return <Link {...getButtonProps(Link, props)} ref={ref} />;
});
