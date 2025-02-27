import clsx from "clsx";
import { NavLink } from "react-router";
import type { UIComponentProps } from "~/utils/component";
import { Spinner } from "../spinner";

export type GetGlobalSidebarMenuItemProps<T extends React.ElementType> =
  UIComponentProps<T> & {
    iconLeft?: React.ReactElement<React.ComponentProps<"svg">, "svg">;
    iconRight?: React.ReactElement<React.ComponentProps<"svg">, "svg">;
    collapsed: boolean;
    title: string;
  };

export function getGlobalSidebarMenuItemProps<
  T extends "button" | typeof NavLink,
>(
  type: T,
  props: GetGlobalSidebarMenuItemProps<T>,
): React.ComponentPropsWithoutRef<T> {
  switch (type) {
    case NavLink: {
      const { children, iconLeft, iconRight, collapsed, ...rest } = props;
      return {
        className: clsx(
          "group flex items-center gap-2 rounded-md border border-transparent text-left text-sm font-medium text-gray-600 transition-colors hover:bg-blue-100 hover:text-blue-500 hover:underline aria-current-page:border-gray-300 aria-current-page:bg-gray-200 aria-current-page:text-gray-800",
          {
            "p-1 w-full": !collapsed,
            "p-1.5 lg:self-center": collapsed,
          },
        ),
        children: (
          props: React.ComponentPropsWithoutRef<
            Extract<typeof children, (...args: never[]) => unknown>
          >,
        ) => (
          <>
            {iconLeft ? (
              <span className="shrink-0">
                {props.isPending ? (
                  <Spinner
                    aria-label="Loading..."
                    className="animate-spin"
                    role="status"
                  />
                ) : (
                  iconLeft
                )}
              </span>
            ) : undefined}
            <span
              className={clsx("w-0 grow truncate", {
                "lg:hidden": collapsed,
              })}
            >
              {typeof children === "function" ? children(props) : children}
            </span>
            {iconRight ? (
              <span
                className={clsx(
                  "shrink-0 rounded-full group-hover:bg-blue-200",
                  {
                    "lg:hidden": collapsed,
                  },
                )}
              >
                {iconRight}
              </span>
            ) : undefined}
          </>
        ),
        ...rest,
      } as React.ComponentPropsWithoutRef<T>;
    }
    case "button": {
      const { children, iconLeft, iconRight, collapsed, ...rest } =
        props as GetGlobalSidebarMenuItemProps<"button">;
      return {
        className: clsx(
          "group flex items-center gap-2 rounded-md border border-transparent text-left text-sm font-medium text-gray-600 transition-colors hover:bg-blue-100 hover:text-blue-500 aria-pressed:border-gray-300 aria-pressed:bg-gray-200 aria-pressed:text-gray-800",
          {
            "p-1 w-full": !collapsed,
            "lg:p-1.5 lg:w-auto lg:self-center": collapsed,
          },
        ),
        children: (
          <>
            {iconLeft ? (
              <span className="shrink-0">{iconLeft}</span>
            ) : undefined}
            <span
              className={clsx("w-0 grow truncate", {
                "lg:hidden": collapsed,
              })}
            >
              {children}
            </span>
            {iconRight ? (
              <span
                className={clsx(
                  "shrink-0 rounded-full group-hover:bg-blue-200",
                  {
                    "lg:hidden": collapsed,
                  },
                )}
              >
                {iconRight}
              </span>
            ) : undefined}
          </>
        ),
        ...rest,
      } as React.ComponentPropsWithoutRef<T>;
    }
    default:
      throw new Error(`Unknown type: ${String(type)}`);
  }
}
