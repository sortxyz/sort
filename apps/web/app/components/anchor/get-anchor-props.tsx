import clsx from "clsx";
import { Link } from "react-router";
import type { UIComponentProps } from "~/utils/component";

export type GetAnchorProps<T extends React.ElementType> = {
  iconLeft?: React.ReactElement<React.ComponentProps<"svg">, "svg">;
  iconRight?: React.ReactElement<React.ComponentProps<"svg">, "svg">;
  space?: "sm";
} & UIComponentProps<T>;

export function getAnchorProps<T extends typeof Link | "a">(
  type: T,
  props: GetAnchorProps<T>,
): React.ComponentPropsWithoutRef<T> {
  switch (type) {
    case Link:
    case "a": {
      const { iconLeft, iconRight, children, space, ...rest } = props;
      return {
        className: clsx(
          "inline-flex shrink-0 items-center gap-1.5 text-gray-900 underline decoration-gray-400 decoration-1 underline-offset-4 hover:decoration-gray-900 hover:decoration-2 focus:text-blue-600 focus:decoration-blue-600 focus:decoration-2 active:text-gray-800 active:decoration-gray-800 active:decoration-2 aria-disabled:text-gray-600 aria-disabled:decoration-gray-500 aria-disabled:decoration-1",
          {
            "text-sm": space === "sm",
          },
        ),
        children: (
          <>
            {iconLeft ? <span>{iconLeft}</span> : undefined}
            <span>{children}</span>
            {iconRight ? <span>{iconRight}</span> : undefined}
          </>
        ),
        ...rest,
      } as React.ComponentPropsWithoutRef<T>;
    }
    default:
      throw new Error(`Unknown type: ${String(type)}`);
  }
}
