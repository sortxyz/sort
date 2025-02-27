import { NavLink } from "react-router";
import { IconChevronRight } from "@tabler/icons-react";
import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";

export function BreadcrumbNavLink({
  children,
  ...props
}: UIComponentProps<typeof NavLink>) {
  return (
    <NavLink
      {...props}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-sm px-1.5 text-sm/7 font-medium text-gray-900 duration-100 ease-linear md:gap-2"
    >
      {(childrenProps) => (
        <>
          <span
            className={clsx({
              "underline decoration-gray-400 underline-offset-6":
                !childrenProps.isActive,
            })}
          >
            {children instanceof Function ? children(childrenProps) : children}
          </span>
          {childrenProps.isActive ? undefined : (
            <span aria-hidden>
              <IconChevronRight className="stroke-1.5 size-4" />
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}
