import type { Meta, StoryObj } from "@storybook/react";
import { Spinner } from "~/components/spinner";

const meta = {
  args: {
    className: "animate-spin text-blue-600",
  },
  component: Spinner,
} satisfies Meta<typeof Spinner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;
