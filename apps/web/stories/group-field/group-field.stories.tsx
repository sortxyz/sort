import type { Meta, StoryObj } from "@storybook/react";
import { GroupField } from "~/components/group-field";
import * as GroupFieldFieldStories from "./group-field-field.stories";
import * as GroupFieldHelperTextStories from "./group-field-helper-text.stories";
import * as GroupFieldLabelStories from "./group-field-label.stories";

const meta = {
  component: GroupField,
  args: {
    label: (
      <GroupFieldLabelStories.default.component
        {...GroupFieldLabelStories.default.args}
      />
    ),
    helperText: (
      <GroupFieldHelperTextStories.default.component
        {...GroupFieldHelperTextStories.default.args}
      />
    ),
    errorHelperText: (
      <GroupFieldHelperTextStories.default.component
        {...GroupFieldHelperTextStories.default.args}
        {...GroupFieldHelperTextStories.Error.args}
      />
    ),
    children: Array.from({ length: 3 }, (_v, k) => (
      <GroupFieldFieldStories.default.component
        key={k}
        {...GroupFieldFieldStories.default.args}
      />
    )),
  },
} satisfies Meta<typeof GroupField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;
