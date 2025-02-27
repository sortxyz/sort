import type { Meta, StoryObj } from "@storybook/react";
import { IconSearch } from "@tabler/icons-react";
import { FieldSelect } from "~/components/field";

const meta = {
  args: {
    children: (
      <>
        <option>Option 1</option>
        <option>Option 2</option>
        <option>Option 3</option>
      </>
    ),
  },
  component: FieldSelect,
} satisfies Meta<typeof FieldSelect>;

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
