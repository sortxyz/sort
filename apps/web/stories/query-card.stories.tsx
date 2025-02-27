import type { Meta, StoryObj } from "@storybook/react";
import { IconDatabaseSearch } from "@tabler/icons-react";
import { createRoutesStub } from "react-router";
import { Button } from "~/components/button";
import { QueryCard } from "~/components/query-card";
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
    buttonGroup: (
      <div className="inline-flex items-center gap-2">
        <Button
          type="button"
          space="sm"
          intent="secondary"
          iconLeft={<IconDatabaseSearch className="stroke-1.5 size-6" />}
        >
          Explorer
        </Button>
      </div>
    ),
    databaseName: "My Database",
    lastUpdatedAt: "2022-01-01T00:00:00.000Z",
    cta: "My Query",
    summary: "My Query Summary",
    tags: ["Tag 1", "Tag 2"].map((tag) => (
      <Tag
        key={tag}
        intent="neutral"
        className={getTagSpaceClasses("lg", "md")}
      >
        Tag
      </Tag>
    )),
  },
  component: QueryCard,
} satisfies Meta<typeof QueryCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Basic = {} satisfies Story;

export const WithAuthor = {
  args: {
    author: {
      username: "username",
      picture: "https://avatars.githubusercontent.com/u/1?v=4",
      name: "Name",
    },
  },
} satisfies Story;
