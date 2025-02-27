import { Fragment, isValidElement } from "react";
import type { UIMatch } from "react-router";
import { Outlet, useMatches } from "react-router";
import { BreadcrumbNav } from "~/components/breadcrumb-nav";
import { GlobalFooter } from "~/components/global-footer";
import { GlobalSidebar } from "~/components/global-sidebar";
import { findLast } from "~/utils/array";
import { isNonNullableObject } from "~/utils/object";

function isMenu(
  match: UIMatch,
): match is UIMatch<unknown, { menu: React.ReactElement<unknown> }> {
  return (
    isNonNullableObject(match.handle) &&
    "menu" in match.handle &&
    isValidElement(match.handle.menu)
  );
}

function isBreadcrumb(
  match: UIMatch,
): match is UIMatch<unknown, { breadcrumb(props: UIMatch): React.ReactNode }> {
  return (
    isNonNullableObject(match.handle) &&
    "breadcrumb" in match.handle &&
    typeof match.handle.breadcrumb === "function"
  );
}

function isFooterHidden(match: UIMatch) {
  return (
    isNonNullableObject(match.handle) &&
    "hideFooter" in match.handle &&
    !!match.handle.hideFooter
  );
}

function isBanner(
  match: UIMatch,
): match is UIMatch<unknown, { banner(props: UIMatch): React.ReactNode }> {
  return (
    isNonNullableObject(match.handle) &&
    "banner" in match.handle &&
    typeof match.handle.banner === "function"
  );
}

export default function Route() {
  const matches = useMatches();
  const breadcrumbMatches = matches.filter(isBreadcrumb);
  const hideFooter = matches.some(isFooterHidden);
  const menuMatch = findLast(isMenu, matches);
  const bannerMatch = findLast(isBanner, matches);

  return (
    <GlobalSidebar menu={menuMatch?.handle.menu}>
      <main className="flex grow flex-col">
        {bannerMatch ? bannerMatch.handle.banner(bannerMatch) : undefined}
        {breadcrumbMatches.length ? (
          <BreadcrumbNav aria-label="Breadcrumbs">
            {breadcrumbMatches.map((match) => (
              <Fragment key={match.id}>
                {match.handle.breadcrumb(match)}
              </Fragment>
            ))}
          </BreadcrumbNav>
        ) : undefined}
        <Outlet />
      </main>
      {!hideFooter ? <GlobalFooter /> : undefined}
    </GlobalSidebar>
  );
}
