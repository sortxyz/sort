export function DatabaseCard({
  buttonGroup,
  orgName,
  rawName,
  summary,
  tags,
  visibilityTag,
  cta,
}: {
  buttonGroup: React.ReactElement<unknown>;
  orgName?: string;
  rawName: string;
  summary: string;
  tags: React.ReactElement<unknown>[];
  cta: React.ReactNode;
  visibilityTag?: React.ReactElement<unknown>;
}) {
  return (
    <div className="flex grow flex-col gap-2 rounded-md border border-gray-300 p-3 shadow-xs md:px-4 md:py-3">
      <div className="flex grow flex-col gap-1">
        {orgName ? (
          <div className="text-xs font-medium text-gray-600">{orgName}</div>
        ) : undefined}
        <div className="flex items-center justify-between gap-2">
          <div className="truncate font-semibold text-gray-900">{cta}</div>
          {visibilityTag ? <div>{visibilityTag}</div> : undefined}
        </div>
        {summary ? (
          <div className="text-sm text-gray-500">{summary}</div>
        ) : undefined}
      </div>
      <div className="flex -translate-x-1 gap-2 overflow-x-auto">{tags}</div>
      <div className="flex items-baseline justify-between gap-3">
        <div className="truncate text-xs font-medium text-gray-600">
          {rawName}
        </div>
        {buttonGroup ? (
          <div className="shrink-0">{buttonGroup}</div>
        ) : undefined}
      </div>
    </div>
  );
}
