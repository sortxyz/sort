import clsx from "clsx";
import type { UseActionMenuButtonProps } from "~/hooks/use-action-menu-button";
import { useActionMenuButton } from "~/hooks/use-action-menu-button";
import { useMergeRef } from "~/hooks/use-merge-ref";
import type { UIComponentProps } from "~/utils/component";
import { genericForwardRef } from "~/utils/react";
import { DropDownContext } from "./drop-down-context";
import type { DropDownTrigger } from "./drop-down-trigger";

export const DropDown = genericForwardRef<
  React.ElementRef<"div">,
  UIComponentProps<"div"> &
    UseActionMenuButtonProps & {
      trigger: React.FunctionComponentElement<typeof DropDownTrigger>;
      position?:
        | "bottom left"
        | "bottom right"
        | "center left"
        | "center right";
    }
>(function DropDown(
  {
    children,
    defaultExpanded,
    expanded,
    position,
    setExpanded,
    trigger,
    ...props
  },
  forwardedRef,
) {
  const dropDown = useActionMenuButton<HTMLLIElement>({
    defaultExpanded,
    expanded,
    setExpanded,
  });

  const ref = useMergeRef(forwardedRef, dropDown.rootRef);

  return (
    <DropDownContext.Provider value={dropDown}>
      <div {...props} ref={ref} className="relative inline-flex shrink-0">
        {trigger}
        <ul
          aria-labelledby={dropDown.buttonId}
          className={clsx(
            "absolute z-20 divide-y divide-gray-300 rounded-xl border bg-white whitespace-nowrap shadow-lg [&[hidden]]:hidden",
            {
              "top-full left-full -translate-x-full": position === undefined,
              "top-full left-0 translate-y-2": position === "bottom left",
              "top-full right-0 translate-y-2": position === "bottom right",
              "top-1/2 left-0 translate-x-8 -translate-y-1/2":
                position === "center left",
              "top-1/2 right-0 -translate-x-8 -translate-y-1/2":
                position === "center right",
            },
          )}
          hidden={!dropDown.expanded}
          id={dropDown.menuId}
          role="menu"
        >
          {children}
        </ul>
      </div>
    </DropDownContext.Provider>
  );
});
