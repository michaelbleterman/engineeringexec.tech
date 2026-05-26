import type { RehypePlugin } from "@astrojs/markdown-remark";
import { visit } from "unist-util-visit";

/**
 * Rehype plugin that prepends the Astro base path to internal links and images
 * in MDX/Markdown content so they resolve correctly when deployed under a
 * sub-path (e.g. GitHub Pages project sites).
 */
const rehypeBasePath: RehypePlugin = () => {
  const base = (process.env.ASTRO_BASE || "").replace(/\/$/, "");
  if (!base) return () => {};

  return (tree) => {
    visit(tree, "element", (node: any) => {
      if (node.tagName === "a" && node.properties?.href?.startsWith("/")) {
        node.properties.href = base + node.properties.href;
      }
      if (node.tagName === "img" && node.properties?.src?.startsWith("/")) {
        node.properties.src = base + node.properties.src;
      }
    });
  };
};

export default rehypeBasePath;
