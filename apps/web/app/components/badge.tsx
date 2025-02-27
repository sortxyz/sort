import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";

export function Badge({
  text,
  children,
  intent,
  ...rest
}: {
  text: string;
  children: React.ReactNode;
  intent: "negative" | "neutral";
} & Required<Pick<UIComponentProps<"span">, "aria-label">>) {
  return (
    <span className="relative inline-flex shrink-0 items-center justify-center">
      {children}
      {text ? (
        <span
          className={clsx(
            "pointer-events-none absolute top-0 left-full -mt-1 flex min-w-4 -translate-x-3 items-center justify-center rounded-full border px-1 text-center text-xs",
            {
              "border-transparent bg-red-600 text-white": intent === "negative",
              "border-gray-300 bg-gray-50 text-gray-900": intent === "neutral",
            },
          )}
          role="status"
          {...rest}
        >
          {text}
        </span>
      ) : undefined}
    </span>
  );
}
