import type { Meta, StoryObj } from "@storybook/react";
import { IconX } from "@tabler/icons-react";
import { createRoutesStub } from "react-router";
import { Button } from "~/components/button";
import { FlashMessage } from "~/components/flash-message";

const meta = {
  parameters: {
    layout: "fullscreen",
  },
  args: {
    closeButton: (
      <button className="flex">
        <IconX className="stroke-1.5 size-5 stroke-inherit" />
      </button>
    ),
  },
  component: FlashMessage,
  decorators: [
    (Story, context) => {
      const RoutesStub = createRoutesStub([
        {
          path: "/",
          id: "root",
          loader: () => ({ flash: { type: "error", message: "Hello World!" } }),
          Component: () => <Story {...context} />,
        },
      ]);

      return <RoutesStub />;
    },
  ],
} satisfies Meta<typeof FlashMessage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const PositiveWillHappen = {
  args: {
    description: "You will receive a bonus this month.",
    title: "Success",
    category: "positiveWillHappen",
  },
} satisfies Story;

export const PositiveWillHappenWithButtonGroup = {
  args: {
    description: "You will receive a bonus this month.",
    title: "Success",
    category: "positiveWillHappen",
    closeButton: undefined,
    buttonGroup: (
      <div className="flex gap-2">
        <Button type="button" intent="constructive" space="xs">
          Accept
        </Button>
        <Button type="button" intent="secondary" space="xs">
          Decline
        </Button>
      </div>
    ),
  },
} satisfies Story;

export const PositiveCouldHappen = {
  args: {
    description: "You could win the lottery.",
    title: "Success",
    category: "positiveCouldHappen",
  },
} satisfies Story;

export const NegativeWillHappen = {
  args: {
    category: "negativeWillHappen",
    description: "Your project deadline will be missed.",
    title: "Error",
  },
} satisfies Story;

export const NegativeCouldHappen = {
  args: {
    category: "negativeCouldHappen",
    description: "You could face a penalty for late submission.",
    title: "Warning",
  },
} satisfies Story;

export const NeutralWillHappen = {
  args: {
    category: "neutralWillHappen",
    description: "The system will undergo maintenance tonight.",
    title: "Notice",
  },
} satisfies Story;

export const NeutralCouldHappen = {
  args: {
    category: "neutralCouldHappen",
    description: "There could be a change in the meeting schedule.",
    title: "Notice",
  },
} satisfies Story;

export const GeneralNotice = {
  args: {
    category: "generalNotice",
    description: "A new version of the software is available.",
    title: "General Notice",
  },
} satisfies Story;

export const AlternativeInfo = {
  args: {
    category: "alternativeInfo",
    description: "You may also consider using a different tool for this task.",
    title: "Alternative Info",
  },
} satisfies Story;

export const HighPriorityAlert = {
  args: {
    category: "highPriorityAlert",
    description: "Security breach detected. Immediate action required.",
    title: "High Priority Alert",
  },
} satisfies Story;

export const LowPriorityAlert = {
  args: {
    category: "lowPriorityAlert",
    description: "A scheduled update will occur next week.",
    title: "Low Priority Alert",
  },
} satisfies Story;
