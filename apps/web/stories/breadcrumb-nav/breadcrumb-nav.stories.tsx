import type { Meta, StoryObj } from "@storybook/react";
import { createRoutesStub } from "react-router";
import { BreadcrumbNav } from "~/components/breadcrumb-nav";
import * as breadcrumbNavLinkStories from "./breadcrumb-nav-link.stories";

const meta = {
  args: {
    children: (
      <>
        <breadcrumbNavLinkStories.default.component
          {...breadcrumbNavLinkStories.default.args}
        />
        <breadcrumbNavLinkStories.default.component
          {...breadcrumbNavLinkStories.default.args}
        >
          Organizations
        </breadcrumbNavLinkStories.default.component>
        <breadcrumbNavLinkStories.default.component
          {...breadcrumbNavLinkStories.default.args}
        >
          Organizations
        </breadcrumbNavLinkStories.default.component>
        <breadcrumbNavLinkStories.default.component
          {...breadcrumbNavLinkStories.default.args}
          {...breadcrumbNavLinkStories.Active.args}
        />
      </>
    ),
  },
  component: BreadcrumbNav,
  decorators: [
    (Story, context) => {
      const RoutesStub = createRoutesStub([
        {
          path: "/",
          Component: () => <Story {...context} />,
        },
      ]);

      return <RoutesStub />;
    },
  ],
} satisfies Meta<typeof BreadcrumbNav>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;
