import { ClientOnly } from "remix-utils/client-only";
import { getRelativeTimeString } from "~/utils/date";
import { genericForwardRef } from "~/utils/react";

export const RelativeTime = genericForwardRef<
  React.ElementRef<"time">,
  Omit<React.ComponentPropsWithoutRef<"time">, "children">
>(function RelativeTime(props, ref) {
  const { dateTime } = props;

  if (!dateTime) {
    return null;
  }

  return (
    <time {...props} ref={ref}>
      <ClientOnly fallback={dateTime}>
        {() => getRelativeTimeString(new Date(dateTime), props.lang)}
      </ClientOnly>
    </time>
  );
});
