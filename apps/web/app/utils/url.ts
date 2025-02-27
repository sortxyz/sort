export function getAbsoluteURL(request: Request, url: string) {
  if (url.startsWith("http:") || url.startsWith("https:")) {
    return new URL(url).toString();
  }
  const host =
    request.headers.get("X-Forwarded-Host") ??
    request.headers.get("host") ??
    new URL(request.url).host;
  const protocol = host.includes("localhost") ? "http" : "https";
  if (url.startsWith("/")) {
    return new URL(url, `${protocol}://${host}`).toString();
  }

  return new URL(`${protocol}//${url}`).toString();
}
