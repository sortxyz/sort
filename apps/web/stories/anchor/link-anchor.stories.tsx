import type { Meta, StoryObj } from "@storybook/react";
import { IconDatabase } from "@tabler/icons-react";
import { createRoutesStub } from "react-router";
import { LinkAnchor } from "~/components/anchor";

const meta = {
  args: {
    "aria-disabled": false,
    to: "/",
    children: "Anchor",
  },
  component: LinkAnchor,
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
} satisfies Meta<typeof LinkAnchor>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;

export const WithIconLeft = {
  args: {
    iconLeft: <IconDatabase className="stroke-1.5 size-6" />,
  },
} satisfies Story;

export const Disabled = {
  args: {
    "aria-disabled": true,
  },
} satisfies Story;
