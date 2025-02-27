import type { MetaDescriptor } from "react-router";
import { Article } from "~/components/article";
export function meta() {
  return [{ title: "Maintenance" }] satisfies MetaDescriptor[];
}

export default function Route() {
  return (
    <Article>
      <div className="container mx-auto [&_:target]:scroll-mt-24">
        <h2 className="text-3xl font-medium">Sort is under maintenance</h2>
        <p className="mt-4 text-lg">
          We are currently performing maintenance on our systems. We will be
          back shortly.
        </p>
        <p className="pt-5">
          <a
            href="https://status.sort.xyz"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            status page
          </a>
        </p>
      </div>
    </Article>
  );
}
