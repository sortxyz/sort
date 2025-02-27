import { TabsContext } from "./tabs-context";
import { useTabs } from "./use-tabs";

export function Tabs({
  asTabs,
  category,
  defaultSelectedIndex,
  layout,
  selectedIndex,
  setSelectedIndex,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & {
  asTabs?: true;
  category?: "underlined";
  defaultSelectedIndex?: number;
  layout?: "page";
  selectedIndex?: number;
  setSelectedIndex?: React.Dispatch<React.SetStateAction<number>>;
}) {
  const tabs = useTabs({
    asTabs,
    category,
    defaultSelectedIndex,
    layout,
    selectedIndex,
    setSelectedIndex,
  });

  return (
    <TabsContext.Provider value={tabs}>
      <div {...props} className="flex grow flex-col" />
    </TabsContext.Provider>
  );
}
