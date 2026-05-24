/**
 * crawl-current-site.ts
 *
 * Fetches the live sitemap, crawls every URL, and saves:
 *   - Raw HTML snapshots to snapshots/html/
 *   - A manifest.json with page inventory and extracted metadata
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const SITE = "https://engineeringexec.tech";
const SITEMAP_URL = `${SITE}/sitemap.xml`;
const OUT_DIR = join(process.cwd(), "snapshots");
const HTML_DIR = join(OUT_DIR, "html");

interface PageMeta {
  url: string;
  slug: string;
  type: "post" | "category" | "page";
  status: number;
  title: string;
  description: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  jsonLd: unknown[];
  htmlFile: string;
  crawledAt: string;
}

async function fetchWithRetry(
  url: string,
  retries = 3,
): Promise<{ status: number; text: string }> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "EngineeringExec-Migrator/1.0" },
      });
      return { status: res.status, text: await res.text() };
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`  Retry ${i + 1}/${retries} for ${url}`);
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("unreachable");
}

function classifyUrl(url: string): PageMeta["type"] {
  if (url.includes("/posts/")) return "post";
  if (url.includes("/categories/")) return "category";
  return "page";
}

function slugFromUrl(url: string): string {
  const path = new URL(url).pathname.replace(/^\/|\/$/g, "");
  return path || "index";
}

function extractMeta(html: string, url: string): Omit<PageMeta, "htmlFile" | "crawledAt" | "status"> {
  const slug = slugFromUrl(url);
  const type = classifyUrl(url);

  const match = (pattern: RegExp): string => {
    const m = html.match(pattern);
    return m ? m[1].trim() : "";
  };

  const title = match(/<title[^>]*>([^<]+)<\/title>/i);
  const description =
    match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  const canonical =
    match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
    match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  const ogTitle =
    match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
    match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  const ogDescription =
    match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
    match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
  const ogImage =
    match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
    match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);

  // Extract all JSON-LD blocks
  const jsonLd: unknown[] = [];
  const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ldMatch;
  while ((ldMatch = ldRegex.exec(html)) !== null) {
    try {
      jsonLd.push(JSON.parse(ldMatch[1]));
    } catch {
      // skip malformed JSON-LD
    }
  }

  return { url, slug, type, title, description, canonical, ogTitle, ogDescription, ogImage, jsonLd };
}

async function parseSitemap(xml: string): Promise<string[]> {
  const urls: string[] = [];
  const locRegex = /<loc>([^<]+)<\/loc>/gi;
  let m;
  while ((m = locRegex.exec(xml)) !== null) {
    urls.push(m[1].trim());
  }
  return urls;
}

async function main() {
  console.log("Fetching sitemap...");
  const { text: sitemapXml } = await fetchWithRetry(SITEMAP_URL);
  const urls = await parseSitemap(sitemapXml);
  console.log(`Found ${urls.length} URLs in sitemap\n`);

  mkdirSync(HTML_DIR, { recursive: true });

  // Save raw sitemap
  writeFileSync(join(OUT_DIR, "sitemap.xml"), sitemapXml);

  const manifest: PageMeta[] = [];

  for (const url of urls) {
    const slug = slugFromUrl(url);
    const safeFilename = slug.replace(/\//g, "__") + ".html";
    const htmlPath = join(HTML_DIR, safeFilename);

    console.log(`Crawling: ${url}`);
    const { status, text: html } = await fetchWithRetry(url);

    if (status !== 200) {
      console.log(`  WARNING: status ${status}`);
    }

    writeFileSync(htmlPath, html);

    const meta = extractMeta(html, url);
    manifest.push({
      ...meta,
      status,
      htmlFile: `html/${safeFilename}`,
      crawledAt: new Date().toISOString(),
    });

    // Be polite: small delay between requests
    await new Promise((r) => setTimeout(r, 300));
  }

  // Also crawl RSS feed
  console.log("\nCrawling RSS feed...");
  try {
    const { text: rss } = await fetchWithRetry(`${SITE}/posts/rss.xml`);
    writeFileSync(join(OUT_DIR, "rss.xml"), rss);
    console.log("  Saved rss.xml");
  } catch {
    console.log("  WARNING: Could not fetch RSS feed");
  }

  // Save manifest
  const manifestPath = join(OUT_DIR, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`\nCrawl complete!`);
  console.log(`  ${manifest.length} pages crawled`);
  console.log(`  ${manifest.filter((p) => p.type === "post").length} posts`);
  console.log(`  ${manifest.filter((p) => p.type === "category").length} categories`);
  console.log(`  ${manifest.filter((p) => p.type === "page").length} pages`);
  console.log(`  Output: ${OUT_DIR}`);
}

main().catch((err) => {
  console.error("Crawl failed:", err);
  process.exit(1);
});
