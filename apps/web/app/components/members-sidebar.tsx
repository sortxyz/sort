import type { Params } from "react-router";
import type { V2 } from "@sort/sdk";
import { IconPlus } from "@tabler/icons-react";
import clsx from "clsx";
import { Avatar } from "./avatar";
import { LinkButton } from "./button";

export function MembersSidebar({
  organization,
  members,
  params,
}: {
  organization: V2.Organization;
  members: V2.Member[];
  params: Readonly<Params<string>>;
}) {
  const canManageRoles = !!organization.permissions?.manage_roles.value;
  return (
    <aside
      className={clsx(
        "flex min-w-40 shrink-0 flex-col gap-7 pt-0 pb-12",
        canManageRoles ? "md:pt-0" : "md:pt-1.5",
      )}
    >
      {canManageRoles ? (
        <LinkButton
          to={`/orgs/${params.org_slug}/members/invites/new`}
          space="sm"
          intent="secondary"
          iconLeft={<IconPlus className="stroke-1.5 size-4" />}
        >
          Add Member
        </LinkButton>
      ) : undefined}

      <div className="flex flex-col gap-3">
        <h2 className="text-sm/6 font-semibold text-gray-700">Members</h2>
        <ul className="inline-flex shrink-0 pl-2">
          {members.map((member) => (
            <li key={member.user.id} className="-ml-2 shrink-0">
              <Avatar
                alt={member.user.username}
                space="md"
                src={member.user.picture ?? undefined}
              />
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}
