import { IconMinus, IconPlus } from "@tabler/icons-react";
import { useAnimatedDetails } from "~/hooks/use-animated-details";
import { Anchor, LinkAnchor } from "./anchor";
import { Logo } from "./logo";

export function GlobalFooter() {
  const details1 = useAnimatedDetails<HTMLDivElement>();
  const details2 = useAnimatedDetails<HTMLDivElement>();
  const details3 = useAnimatedDetails<HTMLDivElement>();
  const details4 = useAnimatedDetails<HTMLDivElement>();
  return (
    <footer className="mt-auto shrink-0 border-t border-solid border-gray-300 bg-gray-50">
      <div className="px-4 py-10 md:px-8">
        <a href="/" aria-label="Sort">
          <Logo className="h-6" />
        </a>
        <div className="mt-6 flex flex-col justify-between gap-4 md:flex-row md:gap-8 xl:gap-8">
          <div className="hidden grow gap-4 text-left md:order-2 md:grid md:grid-cols-2 md:gap-12 lg:grid-cols-4 xl:gap-24">
            <div className="flex flex-col gap-2">
              <div
                className="text-lg font-semibold"
                // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
                role="heading"
              >
                Learn
              </div>
              <div className="flex flex-col gap-3">
                <Anchor href="/pricing">Pricing</Anchor>
                <LinkAnchor to="/orgs/sort">About</LinkAnchor>
                <Anchor
                  href="https://docs.sort.xyz"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Docs / API
                </Anchor>
                <Anchor
                  href="https://aws.amazon.com/marketplace/pp/prodview-7n6kvjjd6ini6"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  AWS Marketplace
                </Anchor>
                <Anchor
                  href="https://zapier.com/apps/sort/integrations"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Zapier App
                </Anchor>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div
                className="text-lg font-semibold"
                // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
                role="heading"
              >
                Solutions
              </div>
              <div className="flex flex-col gap-3">
                <Anchor href="/solutions/customer-support">
                  Customer Support
                </Anchor>
                <Anchor href="/solutions/data-teams">Data Teams</Anchor>
                <Anchor href="/solutions/internal-operations">
                  Internal Operations
                </Anchor>
                <Anchor href="/solutions/community-managers">
                  Community Managers
                </Anchor>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div
                className="text-lg font-semibold"
                // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
                role="heading"
              >
                Support
              </div>
              <div className="flex flex-col gap-3">
                <Anchor
                  href="https://docs.sort.xyz/docs/general/support-and-general-inquiries"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Contact Us
                </Anchor>
                <Anchor
                  href="https://status.sort.xyz"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Status
                </Anchor>
                <Anchor
                  href="https://trust.sort.xyz"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Trust Center
                </Anchor>
                <LinkAnchor to="/privacy-policy">Privacy Policy</LinkAnchor>
                <LinkAnchor to="/terms-of-service">Terms of Service</LinkAnchor>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <div
                className="text-lg font-semibold"
                // eslint-disable-next-line jsx-a11y/role-has-required-aria-props
                role="heading"
              >
                Community
              </div>
              <div className="flex flex-col gap-3">
                <Anchor
                  href="https://x.com/sort_xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  X
                </Anchor>
                <Anchor
                  href="https://blog.sort.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Blog
                </Anchor>
              </div>
            </div>
          </div>
          <div className="grid grow grid-cols-1 md:hidden">
            <details
              ref={details2.ref}
              className="group w-full border-b border-solid border-gray-300 py-3"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium select-none marker:hidden [&::-webkit-details-marker]:hidden">
                Learn{" "}
                <span className="relative size-6">
                  <IconPlus className="stroke-1.5 absolute size-6 transition-opacity group-open:opacity-0" />
                  <IconMinus className="stroke-1.5 absolute size-6 opacity-0 transition-opacity group-open:opacity-100" />
                </span>
              </summary>
              <div
                ref={details2.contentRef}
                className="flex flex-col items-start gap-2 py-3"
              >
                <Anchor space="sm" href="/pricing">
                  Pricing
                </Anchor>
                <LinkAnchor space="sm" to="/orgs/sort">
                  About
                </LinkAnchor>
                <Anchor
                  href="https://docs.sort.xyz"
                  rel="noopener noreferrer"
                  space="sm"
                  target="_blank"
                >
                  Docs / API
                </Anchor>
                <Anchor
                  space="sm"
                  href="https://aws.amazon.com/marketplace/pp/prodview-7n6kvjjd6ini6"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  AWS Marketplace
                </Anchor>
                <Anchor
                  space="sm"
                  href="https://zapier.com/apps/sort/integrations"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Zapier App
                </Anchor>
              </div>
            </details>
            <details
              ref={details1.ref}
              className="group w-full border-b border-solid border-gray-300 py-3"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium marker:hidden [&::-webkit-details-marker]:hidden">
                Solutions{" "}
                <span className="relative size-6">
                  <IconPlus className="stroke-1.5 absolute size-6 transition-opacity group-open:opacity-0" />
                  <IconMinus className="stroke-1.5 absolute size-6 opacity-0 transition-opacity group-open:opacity-100" />
                </span>
              </summary>
              <div
                ref={details1.contentRef}
                className="flex flex-col items-start gap-2 py-3"
              >
                <Anchor href="/solutions/customer-support" space="sm">
                  Customer Support
                </Anchor>
                <Anchor space="sm" href="/solutions/data-teams">
                  Data Teams
                </Anchor>
                <Anchor space="sm" href="/solutions/internal-operations">
                  Internal Operations
                </Anchor>
                <Anchor space="sm" href="/solutions/community-managers">
                  Community Managers
                </Anchor>
              </div>
            </details>
            <details
              ref={details3.ref}
              className="group w-full border-b border-solid border-gray-300 py-3"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium select-none marker:hidden [&::-webkit-details-marker]:hidden">
                Support{" "}
                <span className="relative size-6">
                  <IconPlus className="stroke-1.5 absolute size-6 transition-opacity group-open:opacity-0" />
                  <IconMinus className="stroke-1.5 absolute size-6 opacity-0 transition-opacity group-open:opacity-100" />
                </span>
              </summary>
              <div
                ref={details3.contentRef}
                className="flex flex-col items-start gap-2 py-3"
              >
                <Anchor
                  space="sm"
                  href="https://docs.sort.xyz/docs/general/support-and-general-inquiries"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Contact Us
                </Anchor>
                <Anchor
                  space="sm"
                  href="https://status.sort.xyz"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Status
                </Anchor>
                <Anchor
                  space="sm"
                  href="https://trust.sort.xyz"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Trust Center
                </Anchor>
                <LinkAnchor to="/privacy-policy" space="sm">
                  Privacy Policy
                </LinkAnchor>
                <LinkAnchor to="/terms-of-service" space="sm">
                  Terms of Service
                </LinkAnchor>
              </div>
            </details>
            <details
              ref={details4.ref}
              className="group w-full border-b border-solid border-gray-300 py-3"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium select-none marker:hidden [&::-webkit-details-marker]:hidden">
                Community{" "}
                <span className="relative size-6">
                  <IconPlus className="stroke-1.5 absolute size-6 transition-opacity group-open:opacity-0" />
                  <IconMinus className="stroke-1.5 absolute size-6 opacity-0 transition-opacity group-open:opacity-100" />
                </span>
              </summary>
              <div
                ref={details4.contentRef}
                className="flex flex-col items-start gap-2 py-3"
              >
                <Anchor
                  space="sm"
                  href="https://x.com/sort_xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  X
                </Anchor>
                <Anchor
                  space="sm"
                  href="https://blog.sort.xyz"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Blog
                </Anchor>
              </div>
            </details>
          </div>
        </div>

        <div className="mt-4 flex flex-col justify-between gap-6 text-xs text-gray-800 md:mt-16 md:flex-row md:gap-0 md:text-sm">
          <p className="text-gray-800">
            &copy; {new Date().getFullYear()} Sort XYZ. All rights reserved
          </p>
          <p>
            Design by&nbsp;
            <Anchor
              href="https://avark.agency"
              rel="noopener noreferrer"
              target="_blank"
              space="sm"
            >
              Avark
            </Anchor>
          </p>
        </div>
      </div>
    </footer>
  );
}
