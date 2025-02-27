import type { Meta, StoryObj } from "@storybook/react";
import { GroupFieldLabel } from "~/components/group-field";

const meta = {
  component: GroupFieldLabel,
  args: {
    children: "Label",
  },
} satisfies Meta<typeof GroupFieldLabel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;
