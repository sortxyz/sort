import type { Meta, StoryObj } from "@storybook/react";
import { createRoutesStub } from "react-router";
import { GlobalFooter } from "~/components/global-footer";

const meta = {
  component: GlobalFooter,

  decorators: [
    (Story, context) => {
      const RoutesStub = createRoutesStub([
        {
          path: "/",
          Component: () => <Story {...context} />,
        },
      ]);

      return <RoutesStub />;
    },
  ],
} satisfies Meta<typeof GlobalFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;
