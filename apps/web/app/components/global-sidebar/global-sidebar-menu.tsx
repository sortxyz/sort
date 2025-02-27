import { useContext } from "react";
import { genericForwardRef } from "~/utils/react";
import type { GetGlobalSidebarMenuProps } from "./get-global-sidebar-menu-props";
import { getGlobalSidebarMenuProps } from "./get-global-sidebar-menu-props";
import { GlobalSidebarCollapsedContext } from "./global-sidebar-collapsed-context";

export const GlobalSidebarMenu = genericForwardRef<
  React.ElementRef<"div">,
  Omit<GetGlobalSidebarMenuProps<"div">, "collapsed">
>(function GlobalSidebarMenu(props, ref) {
  const collapsed = useContext(GlobalSidebarCollapsedContext);

  return (
    <div
      {...getGlobalSidebarMenuProps("div", { collapsed, ...props })}
      ref={ref}
    />
  );
});
