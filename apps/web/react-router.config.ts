import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

export default {
  ssr: true,
  presets:
    process.env.SORT_HOSTED_WITH === "vercel" ? [vercelPreset()] : undefined,
} satisfies Config;
