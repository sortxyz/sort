import { Link } from "react-router";
import type { V2 } from "@sort/sdk";
import { IconGitPullRequest, IconTicket } from "@tabler/icons-react";
import { getTextColor } from "~/utils/color";
import { Avatar } from "./avatar";
import { RelativeTime } from "./relative-time";

export function DashboardListItem({
  dashboard,
  members,
  org_slug,
}: {
  dashboard: V2.DashboardItem;
  members: V2.Member[];
  org_slug: string;
}) {
  const createdByMember = members.find(
    (member) => member.user.id === dashboard.created_by,
  );

  const people = dashboard.reviewers.concat(dashboard.assignees);

  return (
    <li className="last-of-type:rounded-b-inherit relative flex flex-col gap-4 px-5 py-4 hover:bg-gray-100 md:flex-row md:px-10">
      <div className="flex grow flex-wrap items-center gap-x-2">
        <h4 className="flex items-center gap-2 font-medium">
          {dashboard.item_type === "issue" ? (
            <IconTicket className="stroke-1.5 size-6 shrink-0" aria-hidden />
          ) : (
            <IconGitPullRequest
              className="stroke-1.5 size-6 shrink-0"
              aria-hidden
            />
          )}
          {dashboard.title}
        </h4>
        {dashboard.labels.length ? (
          <ul className="flex flex-wrap items-center gap-2">
            {dashboard.labels.map((label) => (
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
          #{dashboard.item_number} opened{" "}
          <RelativeTime dateTime={dashboard.created_at} />
          {createdByMember
            ? ` by ${createdByMember.user.username}`
            : undefined}{" "}
          &bull; {dashboard.status} &bull; {dashboard.database_name}
        </p>
      </div>
      {people ? (
        <ul className="hidden items-center gap-2 md:flex">
          {members
            .filter((member) =>
              people.some((person) => person.user.id === member.user.id),
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
      {dashboard.item_type === "change_request" ? (
        <Link
          className="absolute inset-0 size-full"
          aria-label={`Link to Change Request. ${dashboard.title}`}
          to={`/orgs/${org_slug}/databases/${dashboard.database_slug}/change-requests/${dashboard.item_number}`}
        />
      ) : undefined}
      {dashboard.item_type === "issue" ? (
        <Link
          className="absolute inset-0 size-full"
          aria-label={`Link to Issue. ${dashboard.title}`}
          to={`/orgs/${org_slug}/databases/${dashboard.database_slug}/issues/${dashboard.item_number}`}
        />
      ) : undefined}
    </li>
  );
}
