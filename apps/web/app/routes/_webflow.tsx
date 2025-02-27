import type { LoaderFunctionArgs } from "react-router";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const webflowUrl = new URL(
    url.pathname + url.search,
    "https://webflow.sort.xyz",
  );
  const response = await fetch(webflowUrl);
  const body = await response.arrayBuffer();
  const headers = new Headers(response.headers);
  headers.delete("Content-Encoding");

  return new Response(body, {
    headers,
  });
}
