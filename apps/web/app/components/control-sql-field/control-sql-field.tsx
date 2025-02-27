import { lazy, Suspense } from "react";
import { ClientOnly } from "remix-utils/client-only";
import { Spinner } from "../spinner";

const LazyComponent = lazy(() => import("./control-sql-field.client"));

export function ControlSqlField(
  props: React.ComponentPropsWithoutRef<typeof LazyComponent>,
) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-10 grow items-center justify-center">
          <Spinner
            aria-label="Loading..."
            className="animate-spin"
            role="status"
          />
        </div>
      }
    >
      <ClientOnly>{() => <LazyComponent {...props} />}</ClientOnly>
    </Suspense>
  );
}
