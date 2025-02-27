import type { Meta, StoryObj } from "@storybook/react";
import { GroupFieldFieldLabel } from "~/components/group-field";

const meta = {
  component: GroupFieldFieldLabel,
  args: {
    children: "Label",
  },
} satisfies Meta<typeof GroupFieldFieldLabel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;
