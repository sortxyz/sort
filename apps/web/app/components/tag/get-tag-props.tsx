import clsx from "clsx";
import type { Tagged } from "type-fest";

type TagClassName = Tagged<string, "TagClassName">;

export type GetTagProps<T extends React.ElementType = React.ElementType> = {
  intent: "positive" | "negative" | "neutral" | "primary" | "terminal";
  iconLeft?: React.ReactElement<React.ComponentPropsWithRef<"svg">, "svg">;
  space?: "sm" | "lg";
  className?: TagClassName;
} & Omit<React.ComponentPropsWithoutRef<T>, "className">;

export function getTagSpaceClasses(
  space: GetTagProps["space"],
  breakpoint: "sm" | "md" | "lg" | undefined,
): TagClassName {
  switch (breakpoint) {
    case "lg":
      return clsx({
        "lg:px-2.5 lg:py-1 lg:text-sm": space === undefined,
        "lg:px-2.5 lg:py-1 lg:text-xs": space === "sm",
        "lg:px-3 lg:py-2 lg:text-sm": space === "lg",
      }) as TagClassName;
    case "md":
      return clsx({
        "md:px-2.5 md:py-1 md:text-sm": space === undefined,
        "md:px-2.5 md:py-1 md:text-xs": space === "sm",
        "md:px-3 md:py-1 md:text-sm": space === "lg",
      }) as TagClassName;
    case "sm":
      return clsx({
        "sm:px-2.5 sm:py-1 sm:text-sm": space === undefined,
        "sm:px-2.5 sm:py-1 sm:text-xs": space === "sm",
        "sm:px-3 sm:py-2 sm:text-sm": space === "lg",
      }) as TagClassName;
    default:
      return clsx({
        "px-2.5 py-1 text-sm": space === undefined,
        "px-2.5 py-1 text-xs": space === "sm",
        "px-3 py-2 text-sm": space === "lg",
      }) as TagClassName;
  }
}

export function getTagProps<T extends "span">(
  type: T,
  props: GetTagProps<T>,
): React.ComponentPropsWithoutRef<T> {
  switch (type) {
    case "span": {
      const { intent, iconLeft, space, children, className, ...rest } =
        props as GetTagProps<"span">;
      return {
        className: clsx(
          "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full border",
          getTagSpaceClasses(space, undefined),
          {
            "bg-white text-gray-900 border-gray-300": intent === "neutral",
            "bg-green-100 text-green-700 border-green-100":
              intent === "positive",
            "bg-red-100 text-red-700 border-red-100": intent === "negative",
            "bg-blue-100 text-blue-700 border-blue-100": intent === "primary",
            "bg-purple-100 text-purple-700 border-purple-100":
              intent === "terminal",
          },
          className,
        ),
        children: (
          <>
            {iconLeft ? (
              <span className="shrink-0">{iconLeft}</span>
            ) : undefined}
            <span className="truncate">{children}</span>
          </>
        ),
        ...rest,
      } as React.ComponentPropsWithoutRef<T>;
    }
    default:
      throw new Error(`Unknown type: ${type}`);
  }
}
