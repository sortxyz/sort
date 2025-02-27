import type { Meta, StoryObj } from "@storybook/react";
import { IconSearch } from "@tabler/icons-react";
import { FieldInput } from "~/components/field";

const meta = {
  args: {
    type: "text",
    placeholder: "Search",
  },
  component: FieldInput,
} satisfies Meta<typeof FieldInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;

export const WithIcon = {
  args: {
    iconLeft: <IconSearch className="stroke-1.5 size-6" />,
  },
} satisfies Story;

export const Disabled = {
  args: {
    disabled: true,
  },
} satisfies Story;

export const Required = {
  args: {
    required: true,
  },
} satisfies Story;
