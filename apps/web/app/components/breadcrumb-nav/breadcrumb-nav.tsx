import type { UIComponentProps } from "~/utils/component";

export function BreadcrumbNav({ ...props }: UIComponentProps<"nav">) {
  return (
    <nav
      {...props}
      className="flex items-center overflow-x-auto py-2 pr-4 pl-3 md:pr-8 md:pl-6"
    />
  );
}
