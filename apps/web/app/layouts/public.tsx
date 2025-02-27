import type { UIMatch } from "react-router";
import { Outlet, useMatches } from "react-router";
import { GlobalFooter } from "~/components/global-footer";
import { PublicGlobalHeader } from "~/components/public-global-header";
import { isNonNullableObject } from "~/utils/object";

function isFooterHidden(match: UIMatch) {
  return (
    isNonNullableObject(match.handle) &&
    "hideFooter" in match.handle &&
    !!match.handle.hideFooter
  );
}

export default function Route() {
  const matches = useMatches();
  const hideFooter = matches.some(isFooterHidden);
  return (
    <div className="contents">
      <PublicGlobalHeader />
      <main className="flex grow flex-col">
        <Outlet />
      </main>
      {!hideFooter ? <GlobalFooter /> : undefined}
    </div>
  );
}
