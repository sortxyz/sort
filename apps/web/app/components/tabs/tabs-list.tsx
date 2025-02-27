import clsx from "clsx";
import { useEffect, useId } from "react";
import { useTabsContext } from "./tabs-context";
import type { TabsLabel } from "./tabs-label";

export function TabsList({
  label,
  ...props
}: Omit<
  React.ComponentPropsWithoutRef<"div">,
  "role" | "aria-label" | "aria-labelledby"
> &
  (
    | {
        label: React.FunctionComponentElement<typeof TabsLabel>;
      }
    | (Required<Pick<React.ComponentPropsWithoutRef<"div">, "aria-label">> & {
        label?: never;
      })
    | (Required<
        Pick<React.ComponentPropsWithoutRef<"div">, "aria-labelledby">
      > & {
        label?: never;
      })
  )) {
  const {
    asTabs,
    category,
    layout,
    tabsListLabelledByState: [tabsListLabelledBy, setTabsListLabelledBy],
  } = useTabsContext();

  const id = useId();

  const labelExists = !!label;

  useEffect(() => {
    if (labelExists) {
      setTabsListLabelledBy(id);
    }
  }, [id, labelExists, setTabsListLabelledBy]);

  return (
    <>
      {label}
      <div
        {...props}
        role={asTabs ? "tablist" : undefined}
        aria-labelledby={tabsListLabelledBy}
        className={clsx("flex shrink-0 gap-3 border-b", {
          "rounded-t-inherit min-h-8 gap-3 border-gray-300 bg-gray-100 py-1":
            category === undefined,
          "px-3": category === undefined && layout === undefined,
          "px-3 md:px-6": category === undefined && layout === "page",
          "border-gray-300": category === "underlined",
        })}
      />
    </>
  );
}
