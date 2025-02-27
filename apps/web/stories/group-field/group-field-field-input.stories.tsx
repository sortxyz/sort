import type { Meta, StoryObj } from "@storybook/react";
import { GroupFieldFieldInput } from "~/components/group-field";

const meta = {
  component: GroupFieldFieldInput,
  args: {
    type: "radio",
  },
} satisfies Meta<typeof GroupFieldFieldInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;
