import type { Meta, StoryObj } from "@storybook/react";
import { Skeleton } from "~/components/skeleton";

const meta = {
  args: {
    style: {
      height: "100px",
      width: "100%",
    },
  },
  component: Skeleton,
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;
