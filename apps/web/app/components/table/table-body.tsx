import type { UIComponentProps } from "~/utils/component";

export function TableBody(props: UIComponentProps<"tbody">) {
  return <tbody {...props} className="bg-white" />;
}
