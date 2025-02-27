import {
  IconArrowsMaximize,
  IconArrowsMinimize,
  IconBuilding,
  IconDatabase,
  IconLogout,
  IconMenu2,
  IconSearch,
  IconSettings,
  IconTable,
  IconUserCircle,
  IconX,
} from "@tabler/icons-react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  Form,
  Link,
  NavLink,
  useFetcher,
  useLocation,
  useNavigation,
  useRouteLoaderData,
} from "react-router";
import type { loader as rootLoader } from "~/root";
import type { loader as searchLoader } from "~/routes/search";
import { getNonBlankStringOrDefault } from "~/utils/string";
import { Avatar } from "../avatar";
import { Button } from "../button";
import { Field, FieldInput } from "../field";
import { FlashMessage, useGlobalFlashMessage } from "../flash-message";
import {
  FormDrawer,
  FormDrawerHeader,
  FormDrawerSection,
} from "../form-drawer";
import { Logo } from "../logo";
import { Spinner } from "../spinner";
import { GlobalSidebarCollapsedContext } from "./global-sidebar-collapsed-context";
import { GlobalSidebarMenuButtonItem } from "./global-sidebar-menu-button-item";

function SearchResultHeaderItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="sticky top-0 bg-gray-300 px-4 py-2 text-sm font-medium text-gray-600">
      {children}
    </li>
  );
}

function SearchResultNavLink({
  label,
  description,
  iconLeft,
  ...props
}: React.ComponentPropsWithoutRef<typeof NavLink> & {
  iconLeft: React.ReactElement<React.ComponentProps<"svg">, "svg">;
  label: string;
  description: React.ReactNode;
}) {
  return (
    <NavLink
      {...props}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-100 focus:bg-blue-50"
    >
      {(props) => (
        <>
          <span className="shrink-0 rounded-full bg-blue-600 p-3 text-white">
            {props.isPending ? (
              <Spinner
                aria-label="Loading..."
                className="size-4 animate-spin"
                role="status"
              />
            ) : (
              iconLeft
            )}
          </span>
          <div className="flex w-0 grow flex-col gap-0.5">
            <h3 className="truncate text-sm font-semibold text-gray-900">
              {label}
            </h3>
            <p className="truncate text-sm text-gray-700">{description}</p>
          </div>
        </>
      )}
    </NavLink>
  );
}

export function GlobalSidebar({
  children,
  menu,
}: {
  children: React.ReactNode;
  menu?: React.ReactNode;
}) {
  const rootLoaderData = useRouteLoaderData<typeof rootLoader>("root");
  const mainMenuRef = useRef<HTMLButtonElement>(null);
  const mainMenuDesktopRef = useRef<HTMLElement>(null);
  const searchMenuRef = useRef<HTMLElement>(null);
  const searchMenuInputRef = useRef<HTMLInputElement>(null);
  const userMenuRef = useRef<HTMLUListElement>(null);
  const userMenuRefDesktop = useRef<HTMLUListElement>(null);
  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mainMenuCollapsed, setMainMenuCollapsed] = useState(false);
  const navigation = useNavigation();
  const fetcher = useFetcher<typeof searchLoader>();

  useEffect(
    function handleNavigation() {
      const state = navigation.state;
      return function handleNavigationcleanup() {
        if (state !== "idle") {
          setMainMenuOpen(false);
          setSearchMenuOpen(false);
          setUserMenuOpen(false);
        }
      };
    },
    [navigation.state],
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (
        mainMenuDesktopRef.current &&
        mainMenuRef.current &&
        !mainMenuRef.current.contains(event.target) &&
        !mainMenuDesktopRef.current.contains(event.target)
      ) {
        setMainMenuOpen(false);
      }

      if (
        searchMenuRef.current &&
        !searchMenuRef.current.contains(event.target)
      ) {
        setSearchMenuOpen(false);
      }

      if (
        userMenuRef.current &&
        userMenuRefDesktop.current &&
        !userMenuRef.current.contains(event.target) &&
        !userMenuRefDesktop.current.contains(event.target)
      ) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return function registerMenuEventsCleanup() {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(
    function focusSearchInput() {
      if (searchMenuOpen) {
        searchMenuInputRef.current?.focus();
      }
    },
    [searchMenuOpen],
  );

  const flash = useGlobalFlashMessage();
  const location = useLocation();

  return (
    <div className="relative isolate flex grow flex-col lg:overflow-x-hidden">
      <div
        className={clsx({
          "lg:ml-16": mainMenuCollapsed,
          "lg:ml-60": !mainMenuCollapsed,
        })}
      >
        {flash ? <FlashMessage {...flash} /> : undefined}
      </div>
      <header className="flex items-center justify-between border-b border-gray-300 p-3 lg:hidden">
        <div className="flex items-center gap-5">
          {navigation.state === "idle" ? (
            <button
              ref={mainMenuRef}
              className="inline-flex shrink-0 appearance-none"
              onClick={() => setMainMenuOpen((prev) => !prev)}
              aria-label="Menu"
            >
              {mainMenuOpen ? (
                <IconX className="stroke-1.5 size-6" />
              ) : (
                <IconMenu2 className="stroke-1.5 size-6" />
              )}
            </button>
          ) : (
            <Spinner
              aria-label="Loading..."
              className="size-6 animate-spin"
              role="status"
            />
          )}
          <a href="/" className="inline-flex shrink-0" aria-label="Home">
            <Logo className="h-5 w-24 shrink-0" />
          </a>
        </div>
        <div className="flex items-center gap-5">
          <button
            className="inline-flex shrink-0"
            onClick={() => setSearchMenuOpen((prev) => !prev)}
            aria-label="Search"
          >
            <IconSearch className="stroke-1.5 size-6" />
          </button>
          <nav className="relative inline-flex shrink-0" ref={userMenuRef}>
            <button
              className="inline-flex shrink-0"
              onClick={() => setUserMenuOpen((prev) => !prev)}
            >
              {rootLoaderData?.sortProfile?.name &&
              rootLoaderData?.sortProfile?.picture ? (
                <Avatar
                  src={rootLoaderData?.sortProfile.picture}
                  alt={rootLoaderData?.sortProfile.name}
                />
              ) : (
                <IconUserCircle className="stroke-1.5 size-6" />
              )}
            </button>
            {userMenuOpen ? (
              rootLoaderData?.sortProfile ? (
                <ul className="absolute top-full right-0 z-50 mt-2 flex flex-col overflow-hidden rounded-lg bg-white shadow-xs">
                  <li>
                    <Link
                      to="/my/profile"
                      className="border-0.5 flex gap-2 rounded-t-lg border-gray-300 p-2 text-gray-700 hover:bg-gray-100"
                    >
                      <span className="shrink-0">
                        <IconSettings className="stroke-1.5 size-6" />
                      </span>
                      <span className="w-min grow whitespace-nowrap">
                        Account Settings
                      </span>
                    </Link>
                  </li>
                  <li>
                    <Form action="/api/auth/logout" method="POST">
                      <button className="border-0.5 -mt-px flex w-full gap-2 rounded-b-lg border-gray-300 p-3 text-left text-red-600 hover:bg-gray-100">
                        <span className="shrink-0">
                          <IconLogout className="stroke-1.5 size-6" />
                        </span>
                        <span className="w-min grow whitespace-nowrap">
                          Sign out
                        </span>
                      </button>
                    </Form>
                  </li>
                </ul>
              ) : (
                <ul className="absolute top-full right-0 z-50 mt-2 flex min-w-32 flex-col items-center justify-center gap-3 overflow-hidden rounded-lg border border-solid border-gray-300 bg-white px-3 py-6 whitespace-nowrap shadow-xs">
                  <li>
                    <Link
                      to={{
                        pathname: "/api/auth/login",
                        search: new URLSearchParams({
                          returnTo: location.pathname + location.search,
                        }).toString(),
                      }}
                      className="w-full text-center text-sm font-medium text-gray-900 underline decoration-gray-100 underline-offset-6 hover:decoration-gray-900 hover:decoration-2"
                    >
                      Log in
                    </Link>
                  </li>
                  <li>
                    <Form
                      action="/api/auth/login?screen_hint=signup"
                      method="POST"
                      className="flex"
                    >
                      <Button
                        type="submit"
                        intent="tertiary"
                        space="sm"
                        fullWidth
                      >
                        Try Sort - It&apos;s Free
                      </Button>
                    </Form>
                  </li>
                </ul>
              )
            ) : undefined}
          </nav>
        </div>
      </header>
      <div
        className={clsx(
          "pointer-events-none fixed inset-0 z-50 flex grow transition-opacity",
          {
            "lg:left-60": !mainMenuCollapsed,
            "lg:left-16": mainMenuCollapsed,
            "opacity-0": !searchMenuOpen,
            "opacity-100 backdrop-blur-md": searchMenuOpen,
          },
        )}
      >
        <FormDrawer
          open={searchMenuOpen}
          onClose={() => setSearchMenuOpen(false)}
        >
          <FormDrawerHeader>
            <fetcher.Form action="/search" className="flex flex-row gap-2">
              <Field fullWidth>
                <FieldInput
                  aria-label="Search"
                  autoCapitalize="none"
                  autoComplete="off"
                  iconLeft={
                    <IconSearch className="stroke-1.5 size-4 text-gray-600" />
                  }
                  name="q"
                  placeholder="Search"
                  ref={searchMenuInputRef}
                  type="search"
                  iconRight={
                    fetcher.state !== "idle" ? (
                      <Spinner
                        aria-label="Loading..."
                        className="size-4 animate-spin"
                        role="status"
                      />
                    ) : undefined
                  }
                />
              </Field>
              <Button
                type="button"
                intent="secondary"
                onClick={() => setSearchMenuOpen((prev) => !prev)}
              >
                Close
              </Button>
            </fetcher.Form>
          </FormDrawerHeader>
          <FormDrawerSection layout="flush">
            <ul className="flex flex-col divide-y divide-gray-300 overflow-x-hidden overflow-y-auto bg-white">
              {fetcher.data &&
              !fetcher.data.results.databases.length &&
              !fetcher.data.results.organizations.length &&
              !fetcher.data.results.tables.length ? (
                <li>
                  <div className="flex items-center gap-3 px-6 py-4">
                    <span className="rounded-full bg-blue-600 p-3 text-white">
                      <IconSearch className="stroke-1.5 size-4" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        No Results Found
                      </h3>
                      <p className="text-sm text-gray-700">
                        Try searching for something else
                      </p>
                    </div>
                  </div>
                </li>
              ) : undefined}
              {fetcher.data?.results.organizations.length ? (
                <SearchResultHeaderItem>Organizations</SearchResultHeaderItem>
              ) : undefined}
              {fetcher.data?.results.organizations.map((organization) => (
                <li
                  key={[
                    organization.org_name,
                    organization.org_slug,
                  ].toString()}
                >
                  <SearchResultNavLink
                    end
                    to={`/orgs/${organization.org_slug}`}
                    iconLeft={<IconBuilding className="stroke-1.5 size-4" />}
                    label={organization.org_name}
                    description={organization.org_slug}
                  />
                </li>
              ))}
              {fetcher.data?.results.databases.length ? (
                <SearchResultHeaderItem>Databases</SearchResultHeaderItem>
              ) : undefined}
              {fetcher.data?.results.databases.map((database) => (
                <li
                  key={[
                    database.connection_id,
                    database.connection_name,
                    database.db_name,
                    database.db_name_raw,
                    database.org_name,
                    database.org_slug,
                  ].toString()}
                >
                  <SearchResultNavLink
                    end
                    to={`/orgs/${database.org_slug}/databases/${database.db_slug}`}
                    iconLeft={<IconDatabase className="stroke-1.5 size-4" />}
                    label={getNonBlankStringOrDefault(
                      database.db_name,
                      database.db_name_raw,
                    )}
                    description={
                      <>
                        {getNonBlankStringOrDefault(
                          database.org_name,
                          database.org_slug,
                        )}{" "}
                        /{" "}
                        {getNonBlankStringOrDefault(
                          database.connection_name,
                          database.connection_id,
                        )}
                      </>
                    }
                  />
                </li>
              ))}
              {fetcher.data?.results.tables.length ? (
                <SearchResultHeaderItem>Tables</SearchResultHeaderItem>
              ) : undefined}
              {fetcher.data?.results.tables.map((table) => (
                <li
                  key={[
                    table.connection_id,
                    table.connection_name,
                    table.db_name,
                    table.db_name_raw,
                    table.org_name,
                    table.org_slug,
                    table.schema_name,
                    table.schema_name_raw,
                    table.table_name,
                    table.table_name_raw,
                  ].toString()}
                >
                  <SearchResultNavLink
                    end
                    to={`/orgs/${table.org_slug}/databases/${table.db_slug}/explorer/schemas/${table.schema_name_raw}/tables/${table.table_name_raw}`}
                    iconLeft={<IconTable className="stroke-1.5 size-4" />}
                    label={getNonBlankStringOrDefault(
                      table.table_name,
                      table.table_name_raw,
                    )}
                    description={
                      <>
                        {getNonBlankStringOrDefault(
                          table.org_name,
                          table.org_slug,
                        )}{" "}
                        /{" "}
                        {getNonBlankStringOrDefault(
                          table.connection_name,
                          table.connection_id,
                        )}{" "}
                        /{" "}
                        {getNonBlankStringOrDefault(
                          table.db_name,
                          table.db_name_raw,
                        )}{" "}
                        /{" "}
                        {getNonBlankStringOrDefault(
                          table.schema_name,
                          table.schema_name_raw,
                        )}
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          </FormDrawerSection>
        </FormDrawer>
      </div>
      <div className="relative flex grow lg:gap-9">
        <aside
          ref={mainMenuDesktopRef}
          className={clsx(
            "absolute inset-0 z-40 flex max-h-dvh shrink-0 flex-col bg-white transition-transform lg:fixed lg:border-r lg:border-gray-300 lg:bg-gray-50 lg:shadow-xs",
            {
              "-translate-x-full lg:translate-x-0": !mainMenuOpen,
              "translate-x-0": mainMenuOpen,
              "lg:w-60": !mainMenuCollapsed,
              "lg:w-16": mainMenuCollapsed,
            },
          )}
        >
          <GlobalSidebarCollapsedContext.Provider value={mainMenuCollapsed}>
            <div
              className={clsx("hidden lg:flex lg:flex-col", {
                "px-3 lg:gap-4 lg:pt-4 lg:pb-5": !mainMenuCollapsed,
                "lg:items-center lg:gap-2 lg:py-3 lg:pb-8": mainMenuCollapsed,
              })}
            >
              <a
                href="/"
                className={clsx("lg:inline-flex lg:shrink-0", {
                  "lg:h-8 lg:w-8 lg:items-center lg:overflow-hidden":
                    mainMenuCollapsed,
                })}
                title="Sort"
              >
                <Logo
                  className={clsx("lg:shrink-0", {
                    "lg:h-5 lg:w-24": !mainMenuCollapsed,
                    "lg:h-6 lg:w-[7.5rem]": mainMenuCollapsed,
                  })}
                />
              </a>
              <div className="hidden rounded-md border border-gray-300 hover:border-blue-500 lg:flex lg:items-center">
                <GlobalSidebarMenuButtonItem
                  aria-pressed={searchMenuOpen}
                  title="Search"
                  iconLeft={<IconSearch className="stroke-1.5 size-6" />}
                  onClick={() => setSearchMenuOpen((prev) => !prev)}
                >
                  Search
                </GlobalSidebarMenuButtonItem>
              </div>
            </div>
            {menu ? menu : <div className="grow" />}
            <nav
              className={clsx("hidden lg:flex lg:flex-col", {
                "lg:p-3": !mainMenuCollapsed,
                "lg:py-3": mainMenuCollapsed,
              })}
            >
              <GlobalSidebarMenuButtonItem
                aria-pressed={mainMenuCollapsed}
                title={mainMenuCollapsed ? "Expand Menu" : "Collapse Menu"}
                iconLeft={
                  mainMenuCollapsed ? (
                    <IconArrowsMaximize className="stroke-1.5 size-6" />
                  ) : (
                    <IconArrowsMinimize className="stroke-1.5 size-6" />
                  )
                }
                onClick={() => setMainMenuCollapsed((prev) => !prev)}
              >
                {mainMenuCollapsed ? "Expand Menu" : "Collapse Menu"}
              </GlobalSidebarMenuButtonItem>
            </nav>

            {rootLoaderData?.sortProfile ? (
              <nav
                className={clsx(
                  "hidden lg:flex lg:flex-col lg:border-t lg:border-gray-300",
                  {
                    "lg:p-3": !mainMenuCollapsed,
                    "lg:py-1": mainMenuCollapsed,
                  },
                )}
                ref={userMenuRefDesktop}
              >
                <GlobalSidebarMenuButtonItem
                  aria-pressed={userMenuOpen}
                  title="My Account"
                  iconLeft={
                    rootLoaderData?.sortProfile.name &&
                    rootLoaderData?.sortProfile.picture ? (
                      <Avatar
                        aria-hidden
                        src={rootLoaderData?.sortProfile.picture}
                        alt={rootLoaderData?.sortProfile.name}
                      />
                    ) : (
                      <IconUserCircle
                        aria-hidden
                        className="stroke-1.5 size-6"
                      />
                    )
                  }
                  onClick={() => setUserMenuOpen((prev) => !prev)}
                >
                  My Account
                </GlobalSidebarMenuButtonItem>
                {userMenuOpen ? (
                  <ul
                    className={clsx(
                      "lg:absolute lg:flex lg:flex-col lg:overflow-hidden lg:rounded-lg lg:bg-white lg:shadow-lg",
                      {
                        "lg:bottom-0 lg:left-0 lg:mb-4 lg:ml-14":
                          mainMenuCollapsed,
                        "lg:inset-x-0 lg:bottom-0 lg:mx-4 lg:mb-20":
                          !mainMenuCollapsed,
                      },
                    )}
                  >
                    <li>
                      <Link
                        to="/my/profile"
                        className="border-0.5 flex gap-2 rounded-t-lg border-gray-300 p-2 text-gray-700 hover:bg-gray-100"
                      >
                        <span className="shrink-0">
                          <IconSettings className="stroke-1.5 size-6" />
                        </span>
                        <span className="w-min grow whitespace-nowrap">
                          Account Settings
                        </span>
                      </Link>
                    </li>
                    <li>
                      <Form action="/api/auth/logout" method="POST">
                        <button className="border-0.5 -mt-px flex w-full gap-2 rounded-b-lg border-gray-300 p-3 text-left text-red-600 hover:bg-gray-100">
                          <span className="shrink-0">
                            <IconLogout className="stroke-1.5 size-6" />
                          </span>
                          <span className="w-min grow whitespace-nowrap">
                            Sign out
                          </span>
                        </button>
                      </Form>
                    </li>
                  </ul>
                ) : undefined}
              </nav>
            ) : (
              <nav
                className={clsx({
                  "hidden gap-3 lg:flex lg:flex-col lg:border-t lg:border-gray-300 lg:p-2":
                    !mainMenuCollapsed,
                  hidden: mainMenuCollapsed,
                })}
                ref={userMenuRefDesktop}
              >
                <Link
                  to={{
                    pathname: "/api/auth/login",
                    search: new URLSearchParams({
                      returnTo: location.pathname + location.search,
                    }).toString(),
                  }}
                  className="w-full text-center text-sm font-medium text-gray-900 underline decoration-gray-100 underline-offset-6 hover:decoration-gray-900 hover:decoration-2"
                >
                  Log in
                </Link>
                <Form
                  action="/api/auth/login?screen_hint=signup"
                  method="POST"
                  className="flex"
                >
                  <Button type="submit" intent="tertiary" space="sm" fullWidth>
                    Try Sort - It&apos;s Free
                  </Button>
                </Form>
              </nav>
            )}
          </GlobalSidebarCollapsedContext.Provider>
        </aside>
        <div
          className={clsx("relative flex w-0 grow flex-col", {
            "hidden lg:flex": mainMenuOpen,
            "lg:ml-16": mainMenuCollapsed,
            "lg:ml-60": !mainMenuCollapsed,
          })}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
