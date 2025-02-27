import type { UIComponentProps } from "~/utils/component";

export function TableHead(props: UIComponentProps<"thead">) {
  return <thead {...props} />;
}
