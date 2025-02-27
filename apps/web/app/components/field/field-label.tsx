import type { UIComponentProps } from "~/utils/component";

export function FieldLabel(props: UIComponentProps<"label">) {
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <label {...props} className="text-sm font-medium text-gray-900" />;
}
