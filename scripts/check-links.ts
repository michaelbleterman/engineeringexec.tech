#!/usr/bin/env tsx
/**
 * Link checker placeholder.
 *
 * Scans the Astro build output (dist/) for internal links and verifies they
 * resolve to existing files. Will be expanded in later phases.
 *
 * Usage:
 *   npm run check:links
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

const distDir = resolve(process.cwd(), "dist");

if (!existsSync(distDir)) {
  console.error("Build output not found. Run 'npm run build' first.");
  process.exit(1);
}

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (full.endsWith(".html")) {
      files.push(full);
    }
  }
  return files;
}

const htmlFiles = walk(distDir);
const hrefPattern = /href="(\/[^"#?]*)"/g;
let broken = 0;

for (const file of htmlFiles) {
  const content = readFileSync(file, "utf-8");
  let match: RegExpExecArray | null;
  while ((match = hrefPattern.exec(content)) !== null) {
    const href = match[1];
    // Check if the target exists as a file or directory with index.html
    const candidates = [
      join(distDir, href),
      join(distDir, href, "index.html"),
      join(distDir, `${href}.html`),
    ];
    const found = candidates.some((c) => existsSync(c));
    if (!found) {
      const relative = file.replace(distDir, "");
      console.error(`BROKEN: ${href}  (in ${relative})`);
      broken++;
    }
  }
}

if (broken > 0) {
  console.error(`\n${broken} broken internal link(s) found.`);
  process.exit(1);
} else {
  console.log(`Checked ${htmlFiles.length} HTML file(s). No broken internal links.`);
}
