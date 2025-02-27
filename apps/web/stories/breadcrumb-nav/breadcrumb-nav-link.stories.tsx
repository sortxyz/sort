import type { Meta, StoryObj } from "@storybook/react";
import { createRoutesStub } from "react-router";
import { BreadcrumbNavLink } from "~/components/breadcrumb-nav";

const meta = {
  args: {
    to: "/example",
    children: "Home",
  },
  component: BreadcrumbNavLink,
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
} satisfies Meta<typeof BreadcrumbNavLink>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;

export const Active = {
  args: {
    to: "/",
    children: "Sort XYZ",
  },
} satisfies Story;
