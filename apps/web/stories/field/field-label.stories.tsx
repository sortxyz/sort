import type { Meta, StoryObj } from "@storybook/react";
import { FieldLabel } from "~/components/field";

const meta = {
  args: {
    children: "Label",
  },
  component: FieldLabel,
} satisfies Meta<typeof FieldLabel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;
