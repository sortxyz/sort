import type { Meta, StoryObj } from "@storybook/react";
import { IconPlus } from "@tabler/icons-react";
import { useCallback, useState } from "react";
import { Button } from "~/components/button";
import {
  FormDrawer,
  FormDrawerFooter,
  FormDrawerHeader,
  FormDrawerSection,
} from "~/components/form-drawer";

const meta = {
  component: FormDrawer,
  args: {},
} satisfies Meta<typeof FormDrawer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {
  render: function Component(args) {
    const [open, setOpen] = useState(false);
    const handleClick = useCallback(() => setOpen((prev) => !prev), []);

    return (
      <div>
        <button onClick={handleClick}>Toggle Dialog</button>
        <FormDrawer {...args} open={open} onClose={handleClick}>
          <FormDrawerHeader>
            <div className="flex justify-between gap-2">
              <h3 className="text-lg font-semibold">Filters</h3>
              <Button
                type="submit"
                iconLeft={<IconPlus className="stroke-1.5 size-6" />}
                space="xs"
                intent="tertiary"
              >
                Add Filter
              </Button>
            </div>
          </FormDrawerHeader>
          <FormDrawerSection>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
            <p>Hello World</p>
          </FormDrawerSection>
          <FormDrawerFooter>
            <div className="flex gap-2">
              <Button space="sm" type="submit" fullWidth>
                Update
              </Button>
              <Button
                space="sm"
                type="button"
                fullWidth
                intent="secondary"
                onClick={handleClick}
              >
                Cancel
              </Button>
            </div>
          </FormDrawerFooter>
        </FormDrawer>
      </div>
    );
  },
} satisfies Story;
