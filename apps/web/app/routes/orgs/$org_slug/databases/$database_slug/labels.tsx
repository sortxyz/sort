import type { UIMatch } from "react-router";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";

export const handle = {
  breadcrumb(match: UIMatch) {
    return (
      <BreadcrumbNavLink end to={match.pathname}>
        Labels
      </BreadcrumbNavLink>
    );
  },
};
