import {
  IconChevronLeft,
  IconKey,
  IconMail,
  IconSettings,
} from "@tabler/icons-react";
import type { MetaDescriptor } from "react-router";
import {
  GlobalSidebarMenu,
  GlobalSidebarMenuNavLinkItem,
} from "~/components/global-sidebar";

export function meta() {
  return [
    {
      title: "API Keys",
    },
  ] satisfies MetaDescriptor[];
}

function Menu() {
  return (
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
        title="Account Settings"
        iconLeft={<IconSettings className="stroke-1.5 size-6" />}
        end
        to="/my/profile"
      >
        Account Settings
      </GlobalSidebarMenuNavLinkItem>
      <GlobalSidebarMenuNavLinkItem
        key="api-keys"
        title="API Keys"
        iconLeft={<IconKey className="stroke-1.5 size-6" />}
        end
        to="/my/profile/api-keys"
      >
        API Keys
      </GlobalSidebarMenuNavLinkItem>
      <GlobalSidebarMenuNavLinkItem
        key="email-preferences"
        title="Email preferences"
        iconLeft={<IconMail className="stroke-1.5 size-6" />}
        end
        to="/my/email-preferences"
      >
        Email Preferences
      </GlobalSidebarMenuNavLinkItem>
    </GlobalSidebarMenu>
  );
}

export const handle = {
  menu: <Menu />,
};
