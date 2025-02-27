import { useParams } from "react-router";
import { IconDatabase, IconLink, IconPlus } from "@tabler/icons-react";
import postgresImageUrl from "~/assets/connections/postgresql-ar21.svg?url";
import snowflakeImageUrl from "~/assets/connections/snowflake-ar21.svg?url";
import { Article } from "~/components/article";
import { LinkButton } from "~/components/button";

export default function Route() {
  const params = useParams();

  return (
    <Article>
      <h3 className="flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
        <IconDatabase className="stroke-1.5 size-6" aria-hidden />
        Add Database Connection
      </h3>
      <div className="mt-4 flex flex-col gap-4 md:flex-row">
        <ConnectionButton
          orgSlug={params.org_slug!}
          dataProvider="postgres"
          name="PostgresSQL"
          src={postgresImageUrl}
        />
        <ConnectionButton
          orgSlug={params.org_slug!}
          dataProvider="snowflake"
          name="Snowflake"
          src={snowflakeImageUrl}
        />
      </div>
      <h3 className="mt-12 flex items-center gap-2 text-xl font-semibold text-gray-900 md:font-bold">
        Getting Started
      </h3>
      <div>
        <div className="overflow-hidden rounded-lg border border-gray-300">
          <section className="flex flex-col gap-8 p-6">
            <div className="flex items-center justify-between text-gray-700">
              <p className="mr-4 font-medium">
                Explore the Sort Playground and Demo Database
              </p>
              <LinkButton
                to="https://sort.xyz/orgs/sort/databases/sort_playground-f25303"
                rel="noopener noreferrer"
                target="_blank"
                space="sm"
                intent="secondary"
                iconLeft={<IconDatabase className="stroke-1.5 size-6" />}
              >
                Explore Sort Playground
              </LinkButton>
            </div>
          </section>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-300">
          <section className="flex flex-col gap-8 p-6">
            <div className="flex items-center justify-between text-gray-700">
              <p className="mr-4 font-medium">
                View the Sort Getting Started Guide
              </p>
              <LinkButton
                to="https://docs.sort.xyz/docs/tutorials/quick-start"
                rel="noopener noreferrer"
                target="_blank"
                space="sm"
                intent="secondary"
                iconLeft={<IconLink className="stroke-1.5 size-6" />}
              >
                Getting Started With Sort
              </LinkButton>
            </div>
          </section>
        </div>
      </div>
    </Article>
  );
}

function ConnectionButton({
  orgSlug,
  dataProvider,
  name,
  src,
}: {
  orgSlug: string;
  dataProvider: string;
  name: string;
  src: string;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-gray-300 shadow-sm md:max-w-sm">
      <header className="flex items-center justify-center bg-white p-6">
        <img src={src} width={170} height={52} alt={name} />
      </header>
      <section className="flex flex-col gap-8 border-t border-gray-300 bg-gray-50 p-6">
        <p className="text-gray-700">
          Add your {name} connection and start browsing data instantly!
        </p>

        <LinkButton
          fullWidth
          to={`/orgs/${orgSlug}/settings/connections/add-connection/${dataProvider}`}
          space="sm"
          iconLeft={<IconPlus className="stroke-1.5 size-6" />}
        >
          Add Connection
        </LinkButton>
      </section>
    </div>
  );
}
