import clsx from "clsx";
import { Link } from "react-router";
import type { Tagged } from "type-fest";
import type { UIComponentProps } from "~/utils/component";

type ButtonClassName = Tagged<string, "buttonClassName">;

export type GetButtonProps<T extends React.ElementType> = {
  fullWidth?: boolean;
  iconLeft?: React.ReactElement<React.ComponentProps<"svg">, "svg">;
  iconRight?: React.ReactElement<React.ComponentProps<"svg">, "svg">;
  intent?:
    | "destructive"
    | "secondary"
    | "tertiary"
    | "constructive"
    | "alternative";
  space?: "xs" | "sm" | "lg";
  className?: ButtonClassName;
} & UIComponentProps<T>;

function classNameConfig<T extends React.ElementType>({
  space,
  fullWidth,
  intent,
}: Pick<GetButtonProps<T>, "fullWidth" | "space" | "intent">) {
  return clsx(getButtonSpaceClasses(space, undefined), {
    "flex grow basis-0": fullWidth,
    "inline-flex shrink-0 w-max": !fullWidth,
    "bg-red-600 text-white border-transparent hover:bg-red-700 focus:ring-2 focus:ring-gray-900 active:bg-red-800 aria-pressed:bg-red-800 disabled:opacity-50 disabled:bg-gray-50 disabled:text-gray-800 disabled:border-transparent aria-disabled:opacity-50 aria-disabled:bg-gray-50 aria-disabled:text-gray-800 aria-disabled:border-transparent":
      intent === "destructive",
    "bg-green-700 text-white border-transparent hover:bg-green-800 focus:ring-2 focus:ring-gray-900 active:bg-green-900 aria-pressed:bg-green-900 disabled:opacity-50 disabled:bg-gray-50 disabled:text-gray-800 disabled:border-transparent aria-disabled:opacity-50 aria-disabled:bg-gray-50 aria-disabled:text-gray-800 aria-disabled:border-transparent":
      intent === "constructive",
    "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 hover:border-gray-400 focus:ring-2 focus:ring-gray-900 active:bg-gray-200 active:border-gray-400 aria-pressed:bg-gray-200 aria-pressed:border-gray-400 disabled:opacity-50 disabled:bg-gray-50 disabled:text-gray-800 disabled:border-transparent aria-disabled:opacity-50 aria-disabled:bg-gray-50 aria-disabled:text-gray-800 aria-disabled:border-transparent":
      intent === "secondary",
    "bg-blue-600 text-white border-transparent hover:bg-blue-700 focus:ring-2 focus:ring-gray-900 active:bg-blue-800 aria-pressed:bg-blue-800 disabled:opacity-50 disabled:bg-gray-50 disabled:text-gray-800 disabled:border-transparent aria-disabled:opacity-50 aria-disabled:bg-gray-50 aria-disabled:text-gray-800 aria-disabled:border-transparent":
      intent === undefined,
    "bg-yellow-400 text-gray-900 border-transparent hover:bg-yellow-500 focus:ring-2 focus:ring-gray-900 active:bg-yellow-600 aria-pressed:bg-yellow-600 disabled:opacity-50 disabled:bg-gray-50 disabled:text-gray-800 disabled:border-transparent aria-disabled:opacity-50 aria-disabled:bg-gray-50 aria-disabled:text-gray-800 aria-disabled:border-transparent":
      intent === "tertiary",
    "bg-purple-600 text-white border-transparent hover:bg-purple-700 focus:ring-2 focus:ring-gray-900 active:bg-purple-800 aria-pressed:bg-purple-800 disabled:opacity-50 disabled:bg-gray-50 disabled:text-gray-800 disabled:border-transparent aria-disabled:opacity-50 aria-disabled:bg-gray-50 aria-disabled:text-gray-800 aria-disabled:border-transparent":
      intent === "alternative",
  });
}

export function getButtonSpaceClasses(
  space: GetButtonProps<React.ElementType>["space"],
  breakpoint: "sm" | "md" | "lg" | undefined,
): ButtonClassName {
  switch (breakpoint) {
    case "lg":
      return clsx({
        "lg:py-1 lg:px-4 lg:text-xs": space === "xs",
        "lg:py-1.5 lg:px-4 lg:text-sm": space === "sm",
        "lg:py-2 lg:px-4 lg:text-sm": space === undefined,
        "lg:py-2.5 lg:px-6 lg:text-sm": space === "lg",
      }) as ButtonClassName;
    case "md":
      return clsx({
        "md:py-1 md:px-4 md:text-xs": space === "xs",
        "md:py-1.5 md:px-4 md:text-sm": space === "sm",
        "md:py-2 md:px-4 md:text-sm": space === undefined,
        "md:py-2.5 md:px-6 md:text-sm": space === "lg",
      }) as ButtonClassName;
    case "sm":
      return clsx({
        "sm:py-1 sm:px-4 sm:text-xs": space === "xs",
        "sm:py-1.5 sm:px-4 sm:text-sm": space === "sm",
        "sm:py-2 sm:px-4 sm:text-sm": space === undefined,
        "sm:py-2.5 sm:px-6 sm:text-sm sm:rounded-sm": space === "lg",
      }) as ButtonClassName;
    default:
      return clsx({
        "py-1 px-2.5 text-sm sm:text-xs": space === "xs",
        "py-1.5 px-4 text-sm": space === "sm",
        "py-2 px-4 text-sm": space === undefined,
        "py-2.5 px-6 rounded-lg": space === "lg",
      }) as ButtonClassName;
  }
}

export function getButtonProps<
  T extends typeof Link | "button" | "a" | "label",
>(type: T, props: GetButtonProps<T>): React.ComponentPropsWithoutRef<T> {
  switch (type) {
    case "button": {
      const {
        space,
        fullWidth,
        intent,
        children,
        iconLeft,
        iconRight,
        className,
        ...rest
      } = props;
      return {
        className: clsx(
          "cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border text-center font-semibold outline-hidden disabled:cursor-default aria-disabled:cursor-default",
          classNameConfig({ space, fullWidth, intent }),
          className,
        ),
        children: (
          <>
            {iconLeft ? (
              <>
                <span>{iconLeft}</span>{" "}
              </>
            ) : undefined}
            <span className="grow">{children}</span>
            {iconRight ? (
              <>
                {" "}
                <span>{iconRight}</span>
              </>
            ) : undefined}
          </>
        ),
        ...rest,
      } as React.ComponentPropsWithoutRef<T>;
    }
    case Link: {
      const {
        space,
        fullWidth,
        intent,
        children,
        iconLeft,
        iconRight,
        className,
        ...rest
      } = props;
      return {
        className: clsx(
          "cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border text-center font-semibold outline-hidden disabled:cursor-default aria-disabled:cursor-default",
          classNameConfig({ space, fullWidth, intent }),
          className,
        ),
        children: (
          <>
            {iconLeft ? (
              <>
                <span>{iconLeft}</span>{" "}
              </>
            ) : undefined}
            <span className="grow">{children}</span>
            {iconRight ? (
              <>
                {" "}
                <span>{iconRight}</span>
              </>
            ) : undefined}
          </>
        ),
        ...rest,
      } as React.ComponentPropsWithoutRef<T>;
    }

    case "a": {
      const {
        space,
        fullWidth,
        intent,
        children,
        iconLeft,
        iconRight,
        className,
        ...rest
      } = props;
      return {
        className: clsx(
          "cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border text-center font-semibold outline-hidden disabled:cursor-default aria-disabled:cursor-default",
          classNameConfig({ space, fullWidth, intent }),
          className,
        ),
        children: (
          <>
            {iconLeft ? (
              <>
                <span>{iconLeft}</span>{" "}
              </>
            ) : undefined}
            <span className="grow">{children}</span>
            {iconRight ? (
              <>
                {" "}
                <span>{iconRight}</span>
              </>
            ) : undefined}
          </>
        ),
        ...rest,
      } as React.ComponentPropsWithoutRef<T>;
    }

    case "label": {
      const {
        space,
        fullWidth,
        intent,
        children,
        iconLeft,
        iconRight,
        className,
        ...rest
      } = props;
      return {
        className: clsx(
          "cursor-pointer select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-sm border text-center font-semibold outline-hidden disabled:cursor-default aria-disabled:cursor-default",
          classNameConfig({ space, fullWidth, intent }),
          className,
        ),
        children: (
          <>
            {iconLeft ? (
              <>
                <span>{iconLeft}</span>{" "}
              </>
            ) : undefined}
            <span className="grow">{children}</span>
            {iconRight ? (
              <>
                {" "}
                <span>{iconRight}</span>
              </>
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
