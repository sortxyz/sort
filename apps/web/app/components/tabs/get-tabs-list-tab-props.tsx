import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";

export function getTabsListTabProps<T extends React.ElementType>(
  _type: T,
  { category, ...props }: UIComponentProps<T> & { category?: "underlined" },
) {
  return {
    ...props,
    children: <span className="truncate">{props.children}</span>,
    className: clsx("flex w-0 max-w-fit basis-full items-center px-4 text-sm", {
      "-mt-2 mb-[-5px] rounded-t-lg border border-b-0 border-transparent bg-transparent text-gray-500 aria-selected:border-gray-300 aria-selected:bg-white aria-selected:text-gray-900 aria-[current=page]:border-gray-300 aria-[current=page]:bg-white aria-[current=page]:text-gray-900":
        category === undefined,
      "border-b-2 py-3 border-transparent text-gray-900 aria-selected:border-gray-900 aria-[current=page]:border-gray-800":
        category === "underlined",
    }),
  };
}
