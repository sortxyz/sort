import type { Meta, StoryObj } from "@storybook/react";
import { IconDatabase } from "@tabler/icons-react";
import { Tag } from "~/components/tag";

const meta = {
  args: {
    intent: "neutral",
    children: "Tag",
  },
  component: Tag,
} satisfies Meta<typeof Tag>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;

export const Small = {
  args: {
    space: "sm",
  },
} satisfies Story;

export const IconLeft = {
  args: {
    iconLeft: <IconDatabase className="stroke-1.5 size-6" />,
  },
} satisfies Story;

export const Positive = {
  args: {
    intent: "positive",
  },
} satisfies Story;

export const Negative = {
  args: {
    intent: "negative",
  },
} satisfies Story;
