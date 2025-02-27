import type { UIComponentProps } from "~/utils/component";
import { getTabsListTabProps } from "./get-tabs-list-tab-props";
import { useTabsContext } from "./tabs-context";

function getLastElement(prefix: string): HTMLElement | null {
  let i = 0;
  let element = document.getElementById(`${prefix}-${i}`);

  while (element) {
    const nextElement = document.getElementById(`${prefix}-${i + 1}`);
    if (!nextElement) {
      break;
    }
    element = nextElement;
    i++;
  }

  return element;
}

export function TabsListTab({
  index,
  ...props
}: UIComponentProps<"button"> & { index: number }) {
  const {
    asTabs,
    category,
    tabsId,
    selectedIndexState: [selectedIndex, setSelectedIndex],
  } = useTabsContext();

  if (!asTabs) {
    throw new Error("TabsListTab must be used with <Tabs asTabs />");
  }

  return (
    <button
      {...getTabsListTabProps("button", {
        ...props,
        "aria-controls": `${tabsId}-panel-${index}`,
        "aria-selected": index === selectedIndex,
        category,
        id: `${tabsId}-tab-${index}`,
        onClick(event: React.MouseEvent<HTMLButtonElement>) {
          props.onClick?.(event);
          if (event.defaultPrevented) {
            return;
          }

          setSelectedIndex(index);
        },
        onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
          props.onKeyDown?.(event);
          if (event.defaultPrevented) {
            return;
          }
          switch (event.key) {
            case "Home": {
              event.preventDefault();
              const nextElement = document.getElementById(`${tabsId}-tab-0`);
              if (nextElement) {
                nextElement.focus();
              }
              break;
            }
            case "End": {
              event.preventDefault();
              const nextElement = getLastElement(`${tabsId}-tab`);
              if (nextElement) {
                nextElement.focus();
              }
              break;
            }
            case "ArrowLeft":
            case "ArrowUp": {
              event.preventDefault();
              const nextElement =
                document.getElementById(`${tabsId}-tab-${index - 1}`) ??
                getLastElement(`${tabsId}-tab`);
              if (nextElement) {
                nextElement.focus();
              }
              break;
            }
            case "ArrowRight":
            case "ArrowDown": {
              event.preventDefault();
              const nextElement =
                document.getElementById(`${tabsId}-tab-${index + 1}`) ??
                document.getElementById(`${tabsId}-tab-0`);
              if (nextElement) {
                nextElement.focus();
              }
              break;
            }
          }
        },
        role: "tab",
        tabIndex: index === selectedIndex ? 0 : -1,
        type: "button",
      })}
    />
  );
}
