import type { Meta, StoryObj } from "@storybook/react";
import { GroupFieldField } from "~/components/group-field";
import * as GroupFieldFieldHelperTextStories from "./group-field-field-helper-text.stories";
import * as GroupFieldFieldInputStories from "./group-field-field-input.stories";
import * as GroupFieldFieldLabelStories from "./group-field-field-label.stories";

const meta = {
  component: GroupFieldField,
  args: {
    children: (
      <GroupFieldFieldInputStories.default.component
        {...GroupFieldFieldInputStories.default.args}
      />
    ),
    helperText: (
      <GroupFieldFieldHelperTextStories.default.component
        {...GroupFieldFieldHelperTextStories.default.args}
      />
    ),
    label: (
      <GroupFieldFieldLabelStories.default.component
        {...GroupFieldFieldLabelStories.default.args}
      />
    ),
  },
} satisfies Meta<typeof GroupFieldField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;
