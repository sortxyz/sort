import type { Meta, StoryObj } from "@storybook/react";
import { FieldHelperText } from "~/components/field";

const meta = {
  args: {
    children: "Helper Text",
  },
  component: FieldHelperText,
} satisfies Meta<typeof FieldHelperText>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;

export const Error = {
  args: {
    intent: "error",
    children: "Error Helper Text",
  },
} satisfies Story;
