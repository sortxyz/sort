import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";

export type GetGlobalSidebarMenuProps<T extends React.ElementType> =
  UIComponentProps<T> & {
    collapsed: boolean;
  };

export function getGlobalSidebarMenuProps<T extends "div">(
  type: T,
  props: GetGlobalSidebarMenuProps<T>,
): React.ComponentPropsWithoutRef<T> {
  switch (type) {
    case "div": {
      const { collapsed, ...rest } = props as GetGlobalSidebarMenuProps<"div">;
      return {
        className: clsx(
          "flex grow flex-col gap-2 overflow-y-auto bg-inherit p-3 lg:pt-0",
          {
            "lg:px-3 lg:pb-2": !collapsed,
            "lg:p-0 lg:gap-1": collapsed,
          },
        ),
        ...rest,
      } as React.ComponentPropsWithoutRef<T>;
    }
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}
