import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";

export async function GET(context: APIContext) {
  const posts = (await getCollection("posts", ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  return rss({
    title: "EngineeringExec",
    description: "Engineering leadership insights and technical strategy.",
    site: new URL(base || "/", context.site!).toString(),
    items: posts.map((post) => ({
      title: post.data.title,
      pubDate: post.data.date,
      description: post.data.description,
      link: new URL(`${base}/posts/${post.data.slug}`, context.site!).href,
      categories: post.data.categories,
    })),
  });
}
