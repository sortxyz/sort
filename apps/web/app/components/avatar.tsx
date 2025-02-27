import clsx from "clsx";
import { useState } from "react";
import type { UIComponentProps } from "~/utils/component";

function spaceToPx(space: "md" | "lg" | undefined) {
  switch (space) {
    case "md":
      return 32;
    case "lg":
      return 40;
    default:
      return 24;
  }
}

export function Avatar({
  space,
  ...props
}: UIComponentProps<"img"> & {
  space?: "md" | "lg";
}) {
  const [shouldFallback, setShouldFallback] = useState(false);
  return props.src && !shouldFallback ? (
    // eslint-disable-next-line jsx-a11y/alt-text
    <img
      {...props}
      onError={() => setShouldFallback(true)}
      width={spaceToPx(space)}
      height={spaceToPx(space)}
      className={clsx(
        "inline-flex shrink-0 rounded-full border border-solid border-gray-300 object-cover",
        {
          "size-6": space === undefined,
          "size-8": space === "md",
          "size-10": space === "lg",
        },
      )}
    />
  ) : (
    <span
      role="img"
      aria-label={props.alt}
      className={clsx(
        "inline-flex shrink-0 cursor-default items-center justify-center rounded-full border border-solid border-gray-300 bg-gray-100 text-black uppercase",
        {
          "size-6": space === undefined,
          "size-8": space === "md",
          "size-10": space === "lg",
        },
      )}
    >
      {props.alt?.[0]}
    </span>
  );
}
