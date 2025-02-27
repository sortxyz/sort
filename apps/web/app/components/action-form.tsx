import { Form } from "react-router";
import { AuthenticityTokenInput } from "remix-utils/csrf/react";
import { genericForwardRef } from "~/utils/react";

export const ActionForm = genericForwardRef<
  React.ElementRef<typeof Form>,
  React.ComponentPropsWithoutRef<typeof Form>
>(function ActionForm({ children, ...props }, ref) {
  return (
    <Form {...props} method="POST" ref={ref}>
      <AuthenticityTokenInput />
      {children}
    </Form>
  );
});
