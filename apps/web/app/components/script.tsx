import { useEffect } from "react";

export function Script({
  async,
  crossOrigin,
  defer,
  integrity,
  noModule,
  nonce,
  referrerPolicy,
  src,
  type,
  id,
}: React.ComponentPropsWithoutRef<"script">) {
  useEffect(() => {
    const script = document.createElement("script");
    if (async) {
      script.setAttribute("async", String(async));
    }
    if (crossOrigin) {
      script.setAttribute("crossOrigin", String(crossOrigin));
    }
    if (defer) {
      script.setAttribute("defer", String(defer));
    }
    if (integrity) {
      script.setAttribute("noModule", String(noModule));
    }
    if (nonce) {
      script.setAttribute("nonce", String(nonce));
    }
    if (referrerPolicy) {
      script.setAttribute("referrerPolicy", String(referrerPolicy));
    }
    if (src) {
      script.setAttribute("src", String(src));
    }
    if (type) {
      script.setAttribute("type", String(type));
    }
    if (id) {
      script.setAttribute("id", String(id));
    }
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, [
    async,
    crossOrigin,
    defer,
    id,
    integrity,
    noModule,
    nonce,
    referrerPolicy,
    src,
    type,
  ]);

  return null;
}
