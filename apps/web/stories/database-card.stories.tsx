import type { Meta, StoryObj } from "@storybook/react";
import { IconLock } from "@tabler/icons-react";
import { createRoutesStub } from "react-router";
import { Button } from "~/components/button";
import { DatabaseCard } from "~/components/database-card";
import { Tag, getTagSpaceClasses } from "~/components/tag";

const meta = {
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
  args: {
    rawName: "my-database",
    summary: "My Database Summary",
    visibilityTag: (
      <Tag
        intent="negative"
        space="sm"
        iconLeft={<IconLock className="stroke-1.5 size-4" />}
      >
        Private
      </Tag>
    ),
    cta: "My Database",
    tags: ["Tag 1", "Tag 2"].map((tag) => (
      <Tag
        key={tag}
        intent="neutral"
        className={getTagSpaceClasses("lg", "md")}
      >
        {tag}
      </Tag>
    )),
    buttonGroup: (
      <div className="inline-flex items-center gap-2">
        <Button type="button" space="sm" intent="secondary">
          Overview
        </Button>
        <Button type="button" space="sm" intent="secondary">
          Explorer
        </Button>
      </div>
    ),
  },
  component: DatabaseCard,
} satisfies Meta<typeof DatabaseCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;

export const WithOrgName = {
  args: {
    orgName: "My Org",
  },
} satisfies Story;
