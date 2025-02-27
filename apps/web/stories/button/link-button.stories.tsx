import type { Meta, StoryObj } from "@storybook/react";
import { IconDatabase } from "@tabler/icons-react";
import { createRoutesStub } from "react-router";
import { LinkButton } from "~/components/button";

const meta = {
  args: {
    "aria-disabled": false,
    "aria-pressed": false,
    to: "/",
    children: "Button",
  },
  component: LinkButton,
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
} satisfies Meta<typeof LinkButton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;

export const Secondary = {
  args: {
    intent: "secondary",
  },
} satisfies Story;

export const Destructive = {
  args: {
    intent: "destructive",
  },
} satisfies Story;

export const Tertiary = {
  args: {
    intent: "tertiary",
  },
} satisfies Story;

export const IconLeft = {
  args: {
    iconLeft: <IconDatabase className="stroke-1.5 size-6" />,
  },
} satisfies Story;

export const IconRight = {
  args: {
    iconRight: <IconDatabase className="stroke-1.5 size-6" />,
  },
} satisfies Story;

export const DualIcon = {
  args: {
    iconLeft: <IconDatabase className="stroke-1.5 size-6" />,
    iconRight: <IconDatabase className="stroke-1.5 size-6" />,
  },
} satisfies Story;
