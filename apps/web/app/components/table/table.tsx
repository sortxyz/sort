import clsx from "clsx";
import type { UIComponentProps } from "~/utils/component";
import type { TableContextValue } from "./table-context";
import { TableContext } from "./table-context";

export function Table({
  inset,
  tone,
  borderless,
  ...props
}: UIComponentProps<"table"> &
  TableContextValue & {
    inset?: true;
    borderless?: boolean;
  }) {
  const table = { tone };

  return (
    <TableContext.Provider value={table}>
      <div
        className={clsx("flex grow flex-col overflow-hidden", {
          "basis-0": inset,
        })}
      >
        <div
          className={clsx(
            "not-prose relative grow overflow-auto rounded-sm bg-transparent",
            {
              "pb-20": inset,
              "border border-gray-200": borderless !== true,
            },
          )}
        >
          <table
            {...props}
            className="w-full table-auto border-collapse text-sm"
          />
        </div>
      </div>
    </TableContext.Provider>
  );
}
