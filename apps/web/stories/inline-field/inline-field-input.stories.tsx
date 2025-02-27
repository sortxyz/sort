import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useRef } from "react";
import { InlineFieldInput } from "~/components/inline-field";

const meta = {
  args: {
    type: "checkbox",
  },
  component: InlineFieldInput,
} satisfies Meta<typeof InlineFieldInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Checkbox = {} satisfies Story;

export const Indeterminate = {
  render: function Component(args) {
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => {
      if (!ref.current) {
        return;
      }
      ref.current.indeterminate = true;
    }, []);
    return <InlineFieldInput ref={ref} {...args} />;
  },
} satisfies Story;

export const Radio = {
  args: {
    type: "radio",
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

export const Checked = {
  args: {
    checked: true,
  },
} satisfies Story;
