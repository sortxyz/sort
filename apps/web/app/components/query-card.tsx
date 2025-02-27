import { Avatar } from "~/components/avatar";
import { RelativeTime } from "./relative-time";

export function QueryCard({
  author,
  databaseName,
  lastUpdatedAt,
  cta,
  summary,
  tags,
  buttonGroup,
}: {
  author?: { name: string; username: string; picture?: string | null };
  databaseName?: string;
  lastUpdatedAt: string;
  cta: React.ReactNode;
  summary?: string | null;
  tags?: React.ReactElement<unknown>[];
  buttonGroup?: React.ReactElement<unknown>;
}) {
  return (
    <div className="flex grow flex-col gap-2 rounded-md border border-gray-300 p-3 shadow-md md:px-5 md:py-4 lg:rounded-xl">
      <div className="flex grow flex-col gap-1">
        {author ? (
          <div className="flex items-center gap-1.5">
            <Avatar alt={author.name} src={author.picture ?? undefined} />
            <span className="text-xs font-medium text-gray-900 md:text-sm">
              {author.username}
            </span>
          </div>
        ) : undefined}
        {databaseName ? (
          <div className="text-xs font-medium text-gray-600">
            {databaseName}
          </div>
        ) : undefined}
        <div className="pt-1 font-semibold break-all text-gray-900">{cta}</div>
        {summary ? (
          <div className="text-sm break-all text-gray-500">{summary}</div>
        ) : undefined}
      </div>
      {tags ? (
        <div className="flex gap-2 overflow-x-auto">{tags}</div>
      ) : undefined}
      <div className="flex items-center justify-between gap-3">
        <RelativeTime
          dateTime={lastUpdatedAt}
          className="text-xs font-medium text-gray-600"
        />
        {buttonGroup ? (
          <div className="shrink-0">{buttonGroup}</div>
        ) : undefined}
      </div>
    </div>
  );
}
