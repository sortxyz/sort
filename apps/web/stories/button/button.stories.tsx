import type { Meta, StoryObj } from "@storybook/react";
import { IconDatabase } from "@tabler/icons-react";
import { Button } from "~/components/button";

const meta = {
  args: {
    disabled: false,
    children: "Button",
    type: "button",
  },
  component: Button,
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Primary = {} satisfies Story;

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

export const Constructive = {
  args: {
    intent: "constructive",
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
