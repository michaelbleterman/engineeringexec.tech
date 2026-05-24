import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  return context.redirect("/posts/rss.xml", 301);
}
