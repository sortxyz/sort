import { genericForwardRef } from "~/utils/react";
import type { GetButtonProps } from "./get-button-props";
import { getButtonProps } from "./get-button-props";

export const LabelButton = genericForwardRef<
  React.ElementRef<"label">,
  GetButtonProps<"label">
>(function LabelButton(props, ref) {
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <label {...getButtonProps("label", props)} ref={ref} />;
});
