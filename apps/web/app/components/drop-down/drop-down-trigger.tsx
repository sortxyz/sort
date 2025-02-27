import type { UIComponentProps } from "~/utils/component";
import { useDropDownContext } from "./drop-down-context";

export function DropDownTrigger(props: UIComponentProps<"button">) {
  const { menuId, expanded, buttonId, buttonRef } = useDropDownContext();

  return (
    <button
      {...props}
      aria-controls={menuId}
      aria-expanded={expanded}
      aria-haspopup="menu"
      id={buttonId}
      ref={buttonRef}
      className="inline-flex aspect-auto shrink-0 cursor-pointer items-center justify-center rounded-sm border border-gray-300 bg-gray-50 p-1 text-gray-700 select-none hover:border-gray-400 hover:bg-gray-100 focus:ring-2 focus:ring-gray-900 active:border-gray-400 active:bg-gray-200 disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 aria-disabled:border-gray-200 aria-disabled:bg-gray-50 aria-disabled:text-gray-400 aria-expanded:border-gray-400 aria-expanded:bg-gray-200"
    />
  );
}
