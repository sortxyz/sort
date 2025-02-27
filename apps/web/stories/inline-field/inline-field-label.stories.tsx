import type { Meta, StoryObj } from "@storybook/react";
import { InlineFieldLabel } from "~/components/inline-field";

const meta = {
  args: {
    children: "Label",
  },
  component: InlineFieldLabel,
} satisfies Meta<typeof InlineFieldLabel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;
