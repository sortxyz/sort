import { useContext } from "react";
import { genericForwardRef } from "~/utils/react";
import type { GetGlobalSidebarMenuItemProps } from "./get-global-sidebar-menu-item-props";
import { getGlobalSidebarMenuItemProps } from "./get-global-sidebar-menu-item-props";
import { GlobalSidebarCollapsedContext } from "./global-sidebar-collapsed-context";

export const GlobalSidebarMenuButtonItem = genericForwardRef<
  React.ElementRef<"button">,
  Omit<GetGlobalSidebarMenuItemProps<"button">, "collapsed">
>(function GlobalSidebarMenuButtonItem(props, ref) {
  const collapsed = useContext(GlobalSidebarCollapsedContext);
  return (
    <button
      {...getGlobalSidebarMenuItemProps("button", { collapsed, ...props })}
      ref={ref}
    />
  );
});
