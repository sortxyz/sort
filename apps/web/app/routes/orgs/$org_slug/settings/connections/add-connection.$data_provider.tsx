import { clsx } from "clsx";
import type { UIMatch } from "react-router";
import { NavLink, Outlet, useParams } from "react-router";
import { Article } from "~/components/article";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";

export const handle = {
  breadcrumb(match: UIMatch) {
    const provider = match.params.data_provider || "";
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        <span className="capitalize">{provider}</span>
      </BreadcrumbNavLink>
    );
  },
};

export default function Route() {
  const params = useParams();

  return (
    <Article>
      <div className="flex gap-4 border-b">
        <NavLink
          end
          className={clsx(
            "border-b-2 border-transparent p-4 aria-current-page:border-gray-900",
          )}
          to={`/orgs/${params.org_slug}/settings/connections/add-connection/${params.data_provider}`}
        >
          Connection Details
        </NavLink>
      </div>
      <Outlet />
    </Article>
  );
}
