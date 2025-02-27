import clsx from "clsx";
import { genericForwardRef } from "~/utils/react";
import { useTabsContext } from "./tabs-context";

export const TabsPanel = genericForwardRef<
  React.ElementRef<"div">,
  Omit<
    React.ComponentPropsWithoutRef<"div">,
    "role" | "aria-labelledby" | "hidden" | "id" | "tabIndex"
  > & { index: number }
>(function TabsPanel({ index, ...props }, ref) {
  const {
    asTabs,
    tabsId,
    selectedIndexState: [selectedIndex],
  } = useTabsContext();
  const id = `${tabsId}-panel-${index}`;

  return (
    <div
      {...props}
      className={clsx("flex grow flex-col [&[hidden]]:hidden", props.className)}
      ref={ref}
      role={asTabs ? "tabpanel" : undefined}
      aria-labelledby={`${tabsId}-tab-${index}`}
      hidden={index !== selectedIndex}
      id={id}
    />
  );
});
