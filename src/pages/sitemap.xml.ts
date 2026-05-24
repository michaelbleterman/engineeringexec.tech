import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  return context.redirect("/sitemap-index.xml", 301);
}
