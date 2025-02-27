import type { UIComponentProps } from "~/utils/component";

export function TableHeadRow(props: UIComponentProps<"tr">) {
  return (
    <tr
      {...props}
      className="sticky inset-x-0 top-0 z-10 rounded-t-xl border-black/5 bg-gray-50 shadow-xs"
    />
  );
}
