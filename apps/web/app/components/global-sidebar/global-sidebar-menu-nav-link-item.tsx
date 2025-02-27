import { NavLink } from "react-router";
import { useContext } from "react";
import { genericForwardRef } from "~/utils/react";
import type { GetGlobalSidebarMenuItemProps } from "./get-global-sidebar-menu-item-props";
import { getGlobalSidebarMenuItemProps } from "./get-global-sidebar-menu-item-props";
import { GlobalSidebarCollapsedContext } from "./global-sidebar-collapsed-context";

export const GlobalSidebarMenuNavLinkItem = genericForwardRef<
  React.ElementRef<typeof NavLink>,
  Omit<GetGlobalSidebarMenuItemProps<typeof NavLink>, "collapsed">
>(function GlobalSidebarMenuNavLinkItem(props, ref) {
  const collapsed = useContext(GlobalSidebarCollapsedContext);
  return (
    <NavLink
      ref={ref}
      {...getGlobalSidebarMenuItemProps(NavLink, { collapsed, ...props })}
    />
  );
});
