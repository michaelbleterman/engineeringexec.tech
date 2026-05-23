#!/usr/bin/env tsx
/**
 * Scaffold a new blog post.
 *
 * Usage:
 *   npm run new-post "My Post Title"
 */

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const title = process.argv[2];

if (!title) {
  console.error("Usage: npm run new-post \"Post Title\"");
  process.exit(1);
}

const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");

const today = new Date().toISOString().slice(0, 10);

const postDir = join(process.cwd(), "src", "content", "posts");
const assetDir = join(process.cwd(), "public", "assets", "posts", slug);
const filePath = join(postDir, `${slug}.mdx`);

if (existsSync(filePath)) {
  console.error(`Post already exists: ${filePath}`);
  process.exit(1);
}

mkdirSync(postDir, { recursive: true });
mkdirSync(assetDir, { recursive: true });

const frontmatter = `---
title: "${title}"
slug: "${slug}"
date: "${today}"
updated: "${today}"
description: ""
categories: []
tags: []
heroImage: "/assets/posts/${slug}/hero.jpg"
heroAlt: ""
ogImage: "/assets/posts/${slug}/og.jpg"
canonical: "https://engineeringexec.tech/posts/${slug}"
draft: true
---

Write your post content here.
`;

writeFileSync(filePath, frontmatter, "utf-8");

console.log(`Created post:  ${filePath}`);
console.log(`Asset folder:  ${assetDir}`);
