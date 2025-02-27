import type { Meta, StoryObj } from "@storybook/react";
import { Field } from "~/components/field";
import * as fieldHelperTextStories from "./field-helper-text.stories";
import * as fieldInputStories from "./field-input.stories";
import * as fieldLabelStories from "./field-label.stories";
import * as fieldSelectStories from "./field-select.stories";
import * as fieldTextareaStories from "./field-textarea.stories";

const meta = {
  component: Field,

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
    fullWidth: true,
  },
} satisfies Meta<typeof Field>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Input = {
  args: {
    children: (
      <fieldInputStories.default.component
        {...fieldInputStories.default.args}
        {...fieldInputStories.Required.args}
      />
    ),
  },
} satisfies Story;

export const Textarea = {
  args: {
    children: (
      <fieldTextareaStories.default.component
        {...fieldTextareaStories.default.args}
        {...fieldTextareaStories.Required.args}
      />
    ),
  },
} satisfies Story;

export const Select = {
  args: {
    children: (
      <fieldSelectStories.default.component
        {...fieldSelectStories.default.args}
        {...fieldSelectStories.Required.args}
      />
    ),
  },
} satisfies Story;
