import {
  IconBuilding,
  IconDatabase,
  IconSearch,
  IconTable,
  IconUserCircle,
} from "@tabler/icons-react";
import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Form, Link, useFetcher } from "react-router";
import { ClientOnly } from "remix-utils/client-only";
import { Logo } from "~/components/logo";
import type { loader as searchLoader } from "~/routes/search";
import { getNonBlankStringOrDefault } from "~/utils/string";
import { Button } from "./button";
import { FlashMessage, useGlobalFlashMessage } from "./flash-message";
import { Spinner } from "./spinner";

export function PublicGlobalHeader() {
  const [menuHidden, setMenuHidden] = useState(true);
  const [searchHidden, setSearchHidden] = useState(true);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchMenuRef = useRef<HTMLDivElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const focusRef = useRef<HTMLButtonElement | HTMLInputElement | null>(null);
  const [resultsHidden, setResultsHidden] = useState(true);
  const fetcher = useFetcher<typeof searchLoader>();
  const shouldHideResults = searchHidden || resultsHidden;

  function handleMenuToggle() {
    focusRef.current = menuButtonRef.current;
    setSearchHidden(true);
    return setMenuHidden((prev) => !prev);
  }

  function handleSearchToggle() {
    focusRef.current = searchButtonRef.current;
    setMenuHidden(true);
    return setSearchHidden((prev) => !prev);
  }

  useEffect(() => {
    if (menuHidden && searchHidden) {
      return;
    }

    function handleClickOutside(event: MouseEvent) {
      if (
        !menuHidden &&
        event.target instanceof Node &&
        !menuButtonRef.current?.contains(event.target)
      ) {
        setMenuHidden(true);
        menuButtonRef.current?.focus();
      } else if (
        !searchHidden &&
        event.target instanceof Node &&
        !searchButtonRef.current?.contains(event.target) &&
        !searchMenuRef.current?.contains(event.target)
      ) {
        setSearchHidden(true);
        searchButtonRef.current?.focus();
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuHidden(true);
        setSearchHidden(true);
        focusRef.current?.focus();
      }
    }

    document.addEventListener("keyup", handleEscape);
    document.addEventListener("click", handleClickOutside);

    return function registerMenuEventsCleanup() {
      document.removeEventListener("keyup", handleEscape);
      document.removeEventListener("click", handleClickOutside);
    };
  });

  useEffect(() => {
    if (searchHidden) {
      return;
    }

    searchInputRef.current?.focus();
  }, [searchHidden]);

  const shouldShowDesktopMenuItems = true;

  const menuItems = (
    <>
      <li>
        <Link
          to="/explore"
          className="w-full text-center text-sm font-medium text-gray-900 underline decoration-gray-100 underline-offset-6 hover:decoration-gray-900 hover:decoration-2"
        >
          Explore
        </Link>
      </li>
      <li>
        <Link
          to="/api/auth/login"
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
          <Button type="submit" intent="tertiary" space="sm" fullWidth>
            Try Sort - It&apos;s Free
          </Button>
        </Form>
      </li>
    </>
  );

  const flash = useGlobalFlashMessage();

  return (
    <header className="sticky top-0 z-30 flex shrink-0 flex-col">
      {flash ? <FlashMessage {...flash} /> : undefined}
      <div className="backdrop-blur-md">
        <nav className="z-20 flex items-center justify-between border-b border-gray-300 bg-white/70 px-4 py-3 md:px-8 md:py-5 lg:px-20">
          <a className="shrink-0" href="/" aria-label="Sort">
            <Logo className="h-4 w-auto md:h-6" />
          </a>
          <div className="flex items-center gap-6 md:gap-9">
            <button
              ref={searchButtonRef}
              onClick={handleSearchToggle}
              aria-label="Search"
            >
              <IconSearch className="stroke-1.5 size-6" />
            </button>

            <div
              className={clsx("inline-flex shrink-0", {
                "md:hidden": shouldShowDesktopMenuItems,
              })}
            >
              <div className="relative inline-flex shrink-0">
                <button
                  onClick={handleMenuToggle}
                  ref={menuButtonRef}
                  aria-label="Menu"
                >
                  <IconUserCircle className="stroke-1.5 size-6" />
                </button>
                <ul
                  className={clsx(
                    "absolute top-full right-0 mt-3 flex min-w-32 flex-col items-center justify-center gap-3 divide-y divide-gray-300 overflow-hidden rounded-xl border border-solid border-gray-300 bg-white px-3 py-6 whitespace-nowrap shadow-md",
                    {
                      hidden: menuHidden,
                    },
                  )}
                >
                  {menuItems}
                </ul>
              </div>
            </div>
            <div
              className={clsx({
                hidden: !shouldShowDesktopMenuItems,
                "hidden items-center gap-6 md:flex": shouldShowDesktopMenuItems,
              })}
            >
              <Link
                to="/explore"
                className="text-center font-medium text-gray-900 not-italic underline decoration-gray-100 underline-offset-6 hover:decoration-gray-900 hover:decoration-2"
              >
                Explore
              </Link>
              <Link
                to="/api/auth/login"
                className="text-center font-medium text-gray-900 not-italic underline decoration-gray-100 underline-offset-6 hover:decoration-gray-900 hover:decoration-2"
              >
                Log in
              </Link>
              <Form
                action="/api/auth/login?screen_hint=signup"
                method="POST"
                className="flex"
              >
                <Button type="submit" intent="tertiary" fullWidth>
                  Try Sort - It&apos;s Free
                </Button>
              </Form>
            </div>
          </div>
        </nav>
      </div>
      <div
        ref={searchMenuRef}
        className={clsx("absolute inset-x-0 top-full isolate", {
          "pointer-events-none": searchHidden,
          "pointer-events-auto": !searchHidden,
        })}
      >
        <div
          className={clsx(
            "relative z-20 flex items-center justify-between gap-4 border-b border-gray-300 bg-gray-100/70 px-4 py-2 backdrop-blur-md transition-transform md:px-8 md:py-5 lg:px-20",
            {
              "translate-y-0": !searchHidden,
              "-translate-y-[400%]": searchHidden,
            },
          )}
        >
          <fetcher.Form
            action="/search"
            className="flex grow md:gap-2"
            onSubmit={() => setResultsHidden(false)}
          >
            <div className="relative flex grow items-center justify-center">
              <IconSearch className="stroke-1.5 pointer-events-none absolute left-3 size-5 text-gray-600" />
              <input
                autoCapitalize="none"
                autoComplete="off"
                className="w-full rounded-lg border border-gray-300 py-2 pr-2 pl-10 font-medium text-gray-900 caret-blue-600 placeholder:font-normal placeholder:text-gray-600 focus:outline-2 focus:outline-offset-2 focus:outline-gray-900"
                name="q"
                onFocus={() => {
                  if (fetcher.data) {
                    setResultsHidden(false);
                  }
                }}
                placeholder="Search..."
                ref={searchInputRef}
                type="search"
              />
            </div>
            <div className="hidden md:block">
              <Button
                type="submit"
                intent="tertiary"
                space="lg"
                iconRight={
                  fetcher.state !== "idle" ? (
                    <Spinner
                      aria-label="Loading..."
                      className="size-6 animate-spin"
                      role="status"
                    />
                  ) : undefined
                }
              >
                Search
              </Button>
            </div>
          </fetcher.Form>
          <button
            className="font-semibold text-gray-600 md:hidden"
            onClick={() => {
              setSearchHidden(true);
            }}
          >
            Close
          </button>
        </div>
        <ul
          className={clsx(
            "absolute inset-x-0 top-full z-10 flex max-h-72 flex-col divide-y divide-gray-300 overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-md transition-transform md:inset-x-20",
            {
              "-translate-y-[200%] opacity-0": shouldHideResults,
              "translate-y-0 opacity-100": !shouldHideResults,
            },
          )}
        >
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
            <li className="sticky top-0 bg-gray-300">
              <span className="px-6 py-2 text-sm font-medium text-gray-600">
                Organizations
              </span>
            </li>
          ) : undefined}
          {fetcher.data?.results.organizations.map((organization) => (
            <li key={[organization.org_name, organization.org_slug].toString()}>
              <Link
                to={`/orgs/${organization.org_slug}`}
                className="flex items-center gap-3 px-6 py-4 hover:bg-gray-100 focus:bg-blue-50"
              >
                <span className="rounded-full bg-blue-600 p-3 text-white">
                  <IconBuilding className="stroke-1.5 size-4" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {organization.org_name}
                  </h3>
                  <p className="text-sm text-gray-700">
                    {organization.org_slug}
                  </p>
                </div>
              </Link>
            </li>
          ))}
          {fetcher.data?.results.databases.length ? (
            <li className="sticky top-0 bg-gray-300">
              <span className="px-6 py-2 text-sm font-medium text-gray-600">
                Databases
              </span>
            </li>
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
              <Link
                to={`/orgs/${database.org_slug}/databases/${database.db_slug}`}
                className="flex items-center gap-3 px-6 py-4 hover:bg-gray-100 focus:bg-blue-50"
              >
                <span className="rounded-full bg-blue-600 p-3 text-white">
                  <IconDatabase className="stroke-1.5 size-4" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {getNonBlankStringOrDefault(
                      database.db_name,
                      database.db_name_raw,
                    )}
                  </h3>
                  <p className="text-sm text-gray-700">
                    {getNonBlankStringOrDefault(
                      database.org_name,
                      database.org_slug,
                    )}
                    &nbsp;/&nbsp;
                    {getNonBlankStringOrDefault(
                      database.connection_name,
                      database.connection_id,
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
          {fetcher.data?.results.tables.length ? (
            <li className="sticky top-0 bg-gray-300">
              <span className="px-6 py-2 text-sm font-medium text-gray-600">
                Tables
              </span>
            </li>
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
              <Link
                to={`/orgs/${table.org_slug}/databases/${table.db_slug}/explorer/schemas/${table.schema_name_raw}/tables/${table.table_name_raw}`}
                className="flex items-center gap-3 px-6 py-4 hover:bg-gray-100 focus:bg-blue-50"
              >
                <span className="rounded-full bg-blue-600 p-3 text-white">
                  <IconTable className="stroke-1.5 size-4" />
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {getNonBlankStringOrDefault(
                      table.table_name,
                      table.table_name_raw,
                    )}
                  </h3>
                  <p className="text-sm text-gray-700">
                    {getNonBlankStringOrDefault(table.org_name, table.org_slug)}
                    &nbsp;/&nbsp;
                    {getNonBlankStringOrDefault(
                      table.connection_name,
                      table.connection_id,
                    )}
                    &nbsp;/&nbsp;
                    {getNonBlankStringOrDefault(
                      table.db_name,
                      table.db_name_raw,
                    )}
                    &nbsp;/&nbsp;
                    {getNonBlankStringOrDefault(
                      table.schema_name,
                      table.schema_name_raw,
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <ClientOnly>
          {() =>
            createPortal(
              <div
                role="none"
                className={clsx(
                  "fixed inset-0 backdrop-blur-xs transition-opacity",
                  {
                    "pointer-events-none opacity-0": searchHidden,
                    "opacity-100": !searchHidden,
                  },
                )}
                onClick={() => {
                  setSearchHidden(true);
                }}
              />,
              document.body,
            )
          }
        </ClientOnly>
      </div>
    </header>
  );
}
