import type { Meta, StoryObj } from "@storybook/react";
import { GroupFieldFieldHelperText } from "~/components/group-field";

const meta = {
  component: GroupFieldFieldHelperText,
  args: {
    children: "Helper text",
  },
} satisfies Meta<typeof GroupFieldFieldHelperText>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;
