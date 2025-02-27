import type { RequiredKeys } from "~/types/utilities";
import { genericForwardRef } from "~/utils/react";
import type { GetButtonProps } from "./get-button-props";
import { getButtonProps } from "./get-button-props";

export const Button = genericForwardRef<
  React.ElementRef<"button">,
  RequiredKeys<GetButtonProps<"button">, "type">
>(function Button(props, ref) {
  return <button {...getButtonProps("button", props)} ref={ref} />;
});
