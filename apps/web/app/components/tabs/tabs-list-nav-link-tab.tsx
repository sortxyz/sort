import { NavLink } from "react-router";
import type { UIComponentProps } from "~/utils/component";
import { getTabsListTabProps } from "./get-tabs-list-tab-props";
import { useTabsContext } from "./tabs-context";

export function TabsListNavLinkTab({
  index,
  ...props
}: UIComponentProps<typeof NavLink> & { index: number }) {
  const { category, tabsId } = useTabsContext();
  return (
    <NavLink
      {...getTabsListTabProps(NavLink, {
        ...props,
        "aria-controls": `${tabsId}-panel-${index}`,
        id: `${tabsId}-tab-${index}`,
        category,
      })}
    />
  );
}
