import type { Meta, StoryObj } from "@storybook/react";
import {
  IconBuilding,
  IconChevronLeft,
  IconChevronRight,
  IconDatabase,
  IconSettings,
  IconUsers,
} from "@tabler/icons-react";
import { createRoutesStub } from "react-router";
import {
  GlobalSidebar,
  GlobalSidebarMenu,
  GlobalSidebarMenuNavLinkItem,
} from "~/components/global-sidebar";

const meta = {
  component: GlobalSidebar,
  decorators: [
    (Story, context) => (
      <div style={{ height: "100vh", display: "flex" }}>
        <Story {...context} />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
  subcomponents: {
    // @ts-expect-error - This is a bug in the Storybook types
    GlobalSidebarMenu,
    // @ts-expect-error - This is a bug in the Storybook types
    GlobalSidebarMenuNavLinkItem,
  },
} satisfies Meta<typeof GlobalSidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const MyOrganizations = {
  args: {
    children: "Hello, world!",
    menu: (
      <GlobalSidebarMenu>
        <GlobalSidebarMenuNavLinkItem
          title="My Organizations"
          iconLeft={<IconBuilding className="stroke-1.5 size-6" />}
          to="/"
        >
          My Organizations
        </GlobalSidebarMenuNavLinkItem>
        <GlobalSidebarMenuNavLinkItem
          title="Sort"
          iconLeft={<IconBuilding className="stroke-1.5 size-6" />}
          iconRight={<IconChevronRight className="stroke-1.5 size-5" />}
          to="/orgs/sort"
        >
          Sort
        </GlobalSidebarMenuNavLinkItem>
        <GlobalSidebarMenuNavLinkItem
          title="Sort"
          iconLeft={<IconBuilding className="stroke-1.5 size-6" />}
          iconRight={<IconChevronRight className="stroke-1.5 size-5" />}
          to="/orgs/sort"
        >
          Sort
        </GlobalSidebarMenuNavLinkItem>
        <GlobalSidebarMenuNavLinkItem
          title="Sort"
          iconLeft={<IconBuilding className="stroke-1.5 size-6" />}
          iconRight={<IconChevronRight className="stroke-1.5 size-5" />}
          to="/orgs/sort"
        >
          Sort
        </GlobalSidebarMenuNavLinkItem>
      </GlobalSidebarMenu>
    ),
  },
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
} satisfies Story;

export const Organization = {
  args: {
    children: "Hello, world!",
    menu: (
      <GlobalSidebarMenu>
        <GlobalSidebarMenuNavLinkItem
          end
          iconLeft={<IconChevronLeft className="stroke-1.5 size-6" />}
          title="My Organizations"
          to="/my/orgs"
        >
          My Organizations
        </GlobalSidebarMenuNavLinkItem>
        <GlobalSidebarMenuNavLinkItem
          title="Sort"
          iconLeft={<IconBuilding className="stroke-1.5 size-6" />}
          to="/orgs/sort"
        >
          Sort
        </GlobalSidebarMenuNavLinkItem>
        <GlobalSidebarMenuNavLinkItem
          title="Databases"
          iconLeft={<IconDatabase className="stroke-1.5 size-6" />}
          iconRight={<IconChevronRight className="stroke-1.5 size-5" />}
          to="/orgs/sort/databases"
        >
          Databases
        </GlobalSidebarMenuNavLinkItem>
        <GlobalSidebarMenuNavLinkItem
          title="Members"
          iconLeft={<IconUsers className="stroke-1.5 size-6" />}
          iconRight={<IconChevronRight className="stroke-1.5 size-5" />}
          to="/orgs/sort/members"
        >
          Members
        </GlobalSidebarMenuNavLinkItem>
        <GlobalSidebarMenuNavLinkItem
          title="Settings"
          iconLeft={<IconSettings className="stroke-1.5 size-6" />}
          to="/orgs/sort/settings"
        >
          Settings
        </GlobalSidebarMenuNavLinkItem>
      </GlobalSidebarMenu>
    ),
  },
  decorators: [
    (Story, context) => {
      const RoutesStub = createRoutesStub([
        {
          path: "/orgs/sort",
          Component: () => <Story {...context} />,
        },
      ]);

      return <RoutesStub initialEntries={[{ pathname: "/orgs/sort" }]} />;
    },
  ],
} satisfies Story;
