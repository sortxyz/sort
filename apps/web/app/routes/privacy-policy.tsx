import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { MetaDescriptor } from "react-router";
import { useLoaderData } from "react-router";
import { Article } from "~/components/article";
import { Markdown } from "~/components/markdown";
export function meta() {
  return [{ title: "Privacy Policy" }] satisfies MetaDescriptor[];
}

export async function loader() {
  const fileText = await readFile(
    resolve("app", "data", "privacy-policy.md"),
    "utf-8",
  );

  return fileText;
}

export default function Route() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <Article>
      <div className="prose prose-sm container mx-auto [&_:target]:scroll-mt-24">
        <Markdown>{loaderData}</Markdown>
      </div>
    </Article>
  );
}
