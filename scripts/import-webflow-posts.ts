/**
 * import-webflow-posts.ts
 *
 * Reads HTML snapshots produced by crawl-current-site.ts and:
 *   - Identifies blog posts vs other pages
 *   - Extracts post content, metadata, dates, categories
 *   - Converts HTML body to MDX
 *   - Downloads Webflow-hosted images to public/assets/posts/{slug}/
 *   - Rewrites image and internal link URLs
 *   - Generates MDX files with frontmatter in src/content/posts/
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename, extname } from "node:path";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

const SITE = "https://engineeringexec.tech";
const SNAPSHOTS_DIR = join(process.cwd(), "snapshots");
const MANIFEST_PATH = join(SNAPSHOTS_DIR, "manifest.json");
const POSTS_OUT = join(process.cwd(), "src", "content", "posts");
const ASSETS_OUT = join(process.cwd(), "public", "assets", "posts");

interface ManifestEntry {
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

interface PostData {
  title: string;
  slug: string;
  date: string;
  updated: string;
  description: string;
  categories: string[];
  heroImage: string;
  heroAlt: string;
  ogImage: string;
  canonical: string;
  body: string;
  images: { remoteUrl: string; localPath: string }[];
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function extractDateFromText(text: string): string {
  // Parse "July 23, 2024" format
  const parsed = new Date(text.trim());
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0];
  }
  return "";
}

function extractPost(html: string, entry: ManifestEntry): PostData | null {
  const $ = cheerio.load(html);

  // Extract title from post-title-section h1
  const titleEl = $(".post-title-section h1").first();
  const title = decodeHtmlEntities(titleEl.text().trim());
  if (!title) return null;

  // Extract date from post-info divs
  const infoElements = $(".post-info-wrapper .post-info");
  let dateStr = "";
  infoElements.each((_, el) => {
    const text = $(el).text().trim();
    if (text && text !== "|" && !$(el).is("a")) {
      const d = extractDateFromText(text);
      if (d) dateStr = d;
    }
  });

  // Extract categories from post-info links
  const categories: string[] = [];
  $(".post-info-wrapper a.post-info.when-link").each((_, el) => {
    const href = $(el).attr("href") || "";
    const catSlug = href.replace("/categories/", "");
    if (catSlug) categories.push(catSlug);
  });

  // Extract dates from JSON-LD
  let jsonLdDate = "";
  let jsonLdUpdated = "";
  for (const ld of entry.jsonLd) {
    const obj = ld as Record<string, string>;
    if (obj["@type"] === "BlogPosting") {
      if (obj.datePublished) {
        jsonLdDate = new Date(obj.datePublished).toISOString().split("T")[0];
      }
      if (obj.dateModified) {
        jsonLdUpdated = new Date(obj.dateModified).toISOString().split("T")[0];
      }
    }
  }

  const finalDate = jsonLdDate || dateStr;
  const finalUpdated = jsonLdUpdated || finalDate;

  // Extract body content
  const bodyEl = $(".body-copy.w-richtext");

  // Extract hero image (first figure/image in body)
  let heroImage = "";
  let heroAlt = "";
  const firstFigure = bodyEl.find("figure").first();
  if (firstFigure.length) {
    const img = firstFigure.find("img");
    heroImage = img.attr("src") || "";
    heroAlt = img.attr("alt") || title;
    // Remove hero from body so it doesn't duplicate
    firstFigure.remove();
  }

  // Collect all images for downloading
  const images: PostData["images"] = [];
  const slug = entry.slug.replace("posts/", "");

  if (heroImage && heroImage.startsWith("http")) {
    const ext = extname(new URL(heroImage).pathname) || ".jpg";
    const localPath = `/assets/posts/${slug}/hero${ext}`;
    images.push({ remoteUrl: heroImage, localPath });
    heroImage = localPath;
  }

  // Process body images
  let imgCounter = 0;
  bodyEl.find("img").each((_, el) => {
    const src = $(el).attr("src") || "";
    if (src.startsWith("http")) {
      imgCounter++;
      const ext = extname(new URL(src).pathname) || ".jpg";
      const localPath = `/assets/posts/${slug}/img-${imgCounter}${ext}`;
      images.push({ remoteUrl: src, localPath });
      $(el).attr("src", localPath);
    }
  });

  // Rewrite internal links to root-relative
  bodyEl.find("a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (href.startsWith(SITE)) {
      $(el).attr("href", href.replace(SITE, ""));
    }
  });

  // Remove empty paragraphs (Webflow adds ‍ zero-width joiners)
  bodyEl.find("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text === "" || text === "\u200D" || /^[\u200B\u200C\u200D\uFEFF\s]+$/.test(text)) {
      $(el).remove();
    }
  });

  // Remove ShareThis embed
  bodyEl.find(".sharethis-inline-share-buttons").remove();

  const bodyHtml = bodyEl.html() || "";

  // Description from meta
  const description = decodeHtmlEntities(
    entry.description || entry.ogDescription || "",
  );

  return {
    title,
    slug,
    date: finalDate,
    updated: finalUpdated,
    description,
    categories,
    heroImage,
    heroAlt,
    ogImage: entry.ogImage || "",
    canonical: entry.canonical || `${SITE}/posts/${slug}`,
    body: bodyHtml,
    images,
  };
}

function htmlToMdx(html: string): string {
  const turndown = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
  });

  // Keep complex HTML that turndown would lose fidelity on
  turndown.addRule("figures", {
    filter: "figure",
    replacement(_content, node) {
      const el = node as unknown as Element;
      const img = (el as unknown as HTMLElement).querySelector?.("img");
      if (img) {
        const src = img.getAttribute("src") || "";
        const alt = img.getAttribute("alt") || "";
        return `\n\n![${alt}](${src})\n\n`;
      }
      // Preserve other figures as raw HTML
      return `\n\n${(el as unknown as HTMLElement).outerHTML}\n\n`;
    },
  });

  // Preserve role="list" ordered lists with start attribute
  turndown.addRule("orderedListWithStart", {
    filter(node) {
      return node.nodeName === "OL" && node.hasAttribute("start");
    },
    replacement(content, node) {
      // Preserve as raw HTML to keep start attribute
      return `\n\n${(node as unknown as HTMLElement).outerHTML}\n\n`;
    },
  });

  let md = turndown.turndown(html);

  // Clean up excessive blank lines and trailing whitespace
  md = md
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return md.trim();
}

function generateFrontmatter(post: PostData): string {
  const fm: Record<string, unknown> = {
    title: post.title,
    slug: post.slug,
    date: post.date,
  };
  if (post.updated && post.updated !== post.date) {
    fm.updated = post.updated;
  }
  fm.description = post.description;
  fm.categories = post.categories;
  fm.tags = [];
  if (post.heroImage) {
    fm.heroImage = post.heroImage;
    fm.heroAlt = post.heroAlt;
  }
  if (post.ogImage) {
    fm.ogImage = post.ogImage;
  }
  fm.canonical = post.canonical;
  fm.draft = false;

  // Manually format YAML to avoid dependency
  const lines = ["---"];
  for (const [key, value] of Object.entries(fm)) {
    if (typeof value === "string") {
      // Quote strings that contain special chars
      const needsQuotes = /[:#\[\]{}&*!|>'"%@`]/.test(value) || value === "";
      lines.push(`${key}: ${needsQuotes ? `"${value.replace(/"/g, '\\"')}"` : value}`);
    } else if (typeof value === "boolean") {
      lines.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - "${item}"`);
        }
      }
    }
  }
  lines.push("---");
  return lines.join("\n");
}

async function downloadImage(
  url: string,
  destPath: string,
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "EngineeringExec-Migrator/1.0" },
    });
    if (!res.ok) {
      console.log(`    WARNING: Failed to download ${url} (${res.status})`);
      return false;
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const dir = join(process.cwd(), "public", destPath.split("/").slice(0, -1).join("/"));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(process.cwd(), "public", destPath), buffer);
    return true;
  } catch (err) {
    console.log(`    WARNING: Error downloading ${url}: ${err}`);
    return false;
  }
}

async function main() {
  if (!existsSync(MANIFEST_PATH)) {
    console.error("No manifest.json found. Run 'npm run crawl' first.");
    process.exit(1);
  }

  const manifest: ManifestEntry[] = JSON.parse(
    readFileSync(MANIFEST_PATH, "utf-8"),
  );

  const posts = manifest.filter((e) => e.type === "post");
  console.log(`Found ${posts.length} blog posts in manifest\n`);

  mkdirSync(POSTS_OUT, { recursive: true });

  let imported = 0;
  let imageCount = 0;

  for (const entry of posts) {
    const htmlPath = join(SNAPSHOTS_DIR, entry.htmlFile);
    if (!existsSync(htmlPath)) {
      console.log(`  SKIP: ${entry.slug} - HTML file missing`);
      continue;
    }

    console.log(`Processing: ${entry.slug}`);
    const html = readFileSync(htmlPath, "utf-8");
    const post = extractPost(html, entry);

    if (!post) {
      console.log(`  SKIP: Could not extract post data`);
      continue;
    }

    // Download images
    for (const img of post.images) {
      process.stdout.write(`  Downloading: ${basename(img.localPath)}...`);
      const ok = await downloadImage(img.remoteUrl, img.localPath);
      console.log(ok ? " done" : " failed");
      if (ok) imageCount++;
      // Polite delay
      await new Promise((r) => setTimeout(r, 200));
    }

    // Convert body HTML to MDX
    const mdxBody = htmlToMdx(post.body);
    const frontmatter = generateFrontmatter(post);
    const mdxContent = `${frontmatter}\n\n${mdxBody}\n`;

    const outFile = join(POSTS_OUT, `${post.slug}.mdx`);
    writeFileSync(outFile, mdxContent);
    console.log(`  Wrote: ${post.slug}.mdx`);

    imported++;
  }

  // Remove the scaffold sample post if real posts were imported
  const samplePost = join(POSTS_OUT, "sample-scaffold-post.mdx");
  if (imported > 0 && existsSync(samplePost)) {
    const { unlinkSync } = await import("node:fs");
    unlinkSync(samplePost);
    console.log("\nRemoved sample-scaffold-post.mdx");
  }

  console.log(`\nImport complete!`);
  console.log(`  ${imported} posts imported`);
  console.log(`  ${imageCount} images downloaded`);
}

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
