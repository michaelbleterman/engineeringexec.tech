import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import rehypeBasePath from "./src/plugins/rehype-base-path.ts";

// https://astro.build/config
export default defineConfig({
  site: process.env.ASTRO_SITE || "https://engineeringexec.tech",
  base: process.env.ASTRO_BASE || "",
  trailingSlash: "never",
  markdown: {
    rehypePlugins: [rehypeBasePath],
  },
  integrations: [mdx(), sitemap()],
});
