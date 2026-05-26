import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: process.env.ASTRO_SITE || "https://engineeringexec.tech",
  base: process.env.ASTRO_BASE || "",
  trailingSlash: "never",
  integrations: [mdx(), sitemap()],
});
