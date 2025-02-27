import clsx from "clsx";

export function FormDrawerSection({
  children,
  layout,
}: {
  children: React.ReactNode;
  layout?: "flush";
}) {
  return (
    <section
      className={clsx("grow", {
        "p-4": layout === undefined,
        "": layout === "flush",
      })}
    >
      {children}
    </section>
  );
}
