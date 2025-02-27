import type { Meta, StoryObj } from "@storybook/react";
import { IconSearch } from "@tabler/icons-react";
import { FieldTextarea } from "~/components/field";

const meta = {
  args: {
    placeholder: "Search",
  },
  component: FieldTextarea,
} satisfies Meta<typeof FieldTextarea>;

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
