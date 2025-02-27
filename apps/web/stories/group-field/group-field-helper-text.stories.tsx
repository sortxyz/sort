import type { Meta, StoryObj } from "@storybook/react";
import { GroupFieldHelperText } from "~/components/group-field";

const meta = {
  component: GroupFieldHelperText,
  args: {
    children: "Helper text",
  },
} satisfies Meta<typeof GroupFieldHelperText>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;

export const Error = {
  args: {
    intent: "error",
    children: "Error helper text",
  },
} satisfies Story;
