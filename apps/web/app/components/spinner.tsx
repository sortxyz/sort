export function Spinner(props: React.ComponentPropsWithoutRef<"svg">) {
  const r = 11;
  const C = 2 * Math.PI * r;
  const percentage = 0.25;
  const strokeWidth = 2;

  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      shapeRendering="geometricPrecision"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r={r}
        stroke="currentColor"
        strokeWidth={strokeWidth}
      />
      <circle
        className="opacity-75"
        cx="12"
        cy="12"
        r={r}
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={C}
        strokeDashoffset={C * (1 - percentage)}
        strokeLinecap="round"
      />
    </svg>
  );
}
