import clsx from "clsx";

export function FormDrawerHeader({
  children,
  layout,
}: {
  children: React.ReactNode;
  layout?: "tabs";
}) {
  return (
    <header
      className={clsx("sticky top-0 z-10 bg-gray-100", {
        "border-b border-gray-300 p-4": layout === undefined,
        "pt-4": layout === "tabs",
      })}
    >
      {children}
    </header>
  );
}
