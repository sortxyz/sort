import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";

export function Article(props: UIComponentProps<"article">) {
  return (
    <article
      {...props}
      className={clsx(
        "mx-auto flex w-full max-w-(--breakpoint-2xl) flex-col gap-4 p-4 md:gap-8 md:px-8 md:pb-14",
      )}
    />
  );
}
