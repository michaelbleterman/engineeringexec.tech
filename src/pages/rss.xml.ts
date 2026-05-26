import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return context.redirect(`${base}/posts/rss.xml`, 301);
}
