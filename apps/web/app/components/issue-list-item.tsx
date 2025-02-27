import { Link } from "react-router";
import type { V2 } from "@sort/sdk";
import { getTextColor } from "~/utils/color";
import { Avatar } from "./avatar";
import { RelativeTime } from "./relative-time";

export function IssueListItem({
  database_slug,
  issue,
  members,
  org_slug,
}: {
  database_slug: string;
  issue: V2.Issue;
  members: V2.Member[];
  org_slug: string;
}) {
  const createdByMember = members.find(
    (member) => member.user.id === issue.created_by,
  );

  return (
    <li className="first-of-type:rounded-t-inherit last-of-type:rounded-b-inherit relative flex flex-col gap-4 px-5 py-4 hover:bg-gray-100 md:flex-row md:px-10">
      <div className="flex grow flex-wrap items-center gap-x-2">
        <h4 className="font-medium">{issue.title}</h4>
        {issue.labels.length ? (
          <ul className="flex flex-wrap items-center gap-2">
            {issue.labels.map((label) => (
              <li key={label.id}>
                <span
                  className="inline-flex shrink-0 items-center justify-center rounded-sm border border-gray-200 px-2 py-1 text-sm"
                  style={{
                    backgroundColor: label.color,
                    color: getTextColor(label.color),
                  }}
                >
                  {label.name}
                </span>
              </li>
            ))}
          </ul>
        ) : undefined}
        <p className="basis-full text-sm text-gray-600">
          #{issue.issue_number} opened{" "}
          <RelativeTime dateTime={issue.created_at} />
          {createdByMember ? <> by {createdByMember.user.username}</> : ""}
        </p>
      </div>
      {issue.assignees.length ? (
        <ul className="hidden items-center gap-2 md:flex">
          {members
            .filter((member) =>
              issue.assignees.some(
                (assignee) => assignee.user.id === member.user.id,
              ),
            )
            .map((member) => (
              <li key={member.user.id}>
                <Avatar
                  title={member.user.username}
                  src={member.user.picture ?? undefined}
                />
              </li>
            ))}
        </ul>
      ) : undefined}
      <Link
        className="absolute inset-0 size-full"
        to={`/orgs/${org_slug}/databases/${database_slug}/issues/${issue.issue_number}`}
        aria-label={`Link to issue. ${issue.title}`}
      />
    </li>
  );
}
