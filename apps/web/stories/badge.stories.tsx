import type { Meta, StoryObj } from "@storybook/react";
import { IconMessageCircle } from "@tabler/icons-react";
import { Badge } from "~/components/badge";

const meta = {
  args: {
    children: "Badge",
    intent: "negative",
    text: "99+",
    "aria-label": "99+ unread messages",
  },
  component: Badge,
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;

export const WithIcon = {
  args: {
    children: <IconMessageCircle className="stroke-1.5 size-6" />,
  },
} satisfies Story;
