import type { Meta, StoryObj } from "@storybook/react";
import { InlineFieldHelperText } from "~/components/inline-field";

const meta = {
  args: {
    children: "Helper Text",
  },
  component: InlineFieldHelperText,
} satisfies Meta<typeof InlineFieldHelperText>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;

export const Error = {
  args: {
    intent: "error",
    children: "Error Helper Text",
  },
} satisfies Story;
