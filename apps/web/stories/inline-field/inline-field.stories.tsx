import type { Meta, StoryObj } from "@storybook/react";
import { InlineField } from "~/components/inline-field";
import * as fieldHelperTextStories from "./inline-field-helper-text.stories";
import * as fieldInputStories from "./inline-field-input.stories";
import * as fieldLabelStories from "./inline-field-label.stories";

const meta = {
  component: InlineField,

  args: {
    label: (
      <fieldLabelStories.default.component
        {...fieldLabelStories.default.args}
      />
    ),
    helperText: (
      <fieldHelperTextStories.default.component
        {...fieldHelperTextStories.default.args}
      />
    ),
    errorHelperText: (
      <fieldHelperTextStories.default.component
        {...fieldHelperTextStories.default.args}
        {...fieldHelperTextStories.Error.args}
      />
    ),
    children: (
      <fieldInputStories.default.component
        {...fieldInputStories.default.args}
        {...fieldInputStories.Required.args}
      />
    ),
    fullWidth: true,
  },
} satisfies Meta<typeof InlineField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Checkbox = {} satisfies Story;
export const Radio = {
  args: {
    children: (
      <fieldInputStories.default.component
        {...fieldInputStories.default.args}
        {...fieldInputStories.Radio.args}
      />
    ),
  },
} satisfies Story;
