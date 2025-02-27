import type { UIComponentProps } from "~/utils/component";

export function GroupFieldFieldLabel(props: UIComponentProps<"label">) {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label
      {...props}
      className="cursor-pointer text-sm font-medium text-gray-900"
    />
  );
}
