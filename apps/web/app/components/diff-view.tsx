import clsx from "clsx";
import { diffJson } from "diff";

export function DiffView({
  oldValue,
  newValue,
}: {
  oldValue: unknown;
  newValue: unknown;
}) {
  // @ts-expect-error types are not correct
  const diff = diffJson(oldValue, newValue);
  const contents = diff.map((part, index) => {
    return (
      <span
        className={clsx("whitespace-nowrap", {
          "bg-green-200": part.added,
          "bg-red-200": part.removed,
        })}
        key={index}
      >
        {part.value}
      </span>
    );
  });

  return <div className="contents">{contents}</div>;
}
