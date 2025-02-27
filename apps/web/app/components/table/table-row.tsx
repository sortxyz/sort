import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";
import { useTableContext } from "./table-context";

export function TableRow(props: UIComponentProps<"tr">) {
  const { tone } = useTableContext();

  return (
    <tr
      {...props}
      className={clsx({ "even:bg-gray-50": tone === "striped" })}
    />
  );
}
