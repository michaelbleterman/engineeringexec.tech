# EngineeringExec.tech

Phased migration workspace for `engineeringexec.tech`.

The goal is to move the current Webflow-hosted blog to a cost-efficient static site while preserving the public domain, URLs, content, SEO metadata, RSS, analytics continuity, and contact form behavior.

## Current Status

Phase 2 (Astro scaffold) is complete. The site builds and passes typechecks.

The implementation plan is here:

- [Migration plan](docs/migration-plan.md)

## Target Architecture

- Astro static site
- Markdown/MDX posts
- GitHub Pages hosting
- AWS Lambda Function URL contact endpoint
- Amazon SES email delivery

## Development

### Prerequisites

- Node.js 22+
- npm

### Commands

```bash
npm ci                       # Install dependencies
npm run dev                  # Local dev server (localhost:4321)
npm run build                # Production build (output: dist/)
npm run preview              # Preview production build
npm run typecheck            # TypeScript checks
npm run check:links          # Link validation (requires build first)
npm run new-post "Title"     # Scaffold a new draft post
```

### Project Structure

```
src/
  content.config.ts            # Content collection schema (Zod)
  content/posts/*.mdx          # Blog posts
  layouts/                     # BaseLayout, PostLayout
  pages/                       # File-based routing
  styles/global.css            # Global styles
public/
  CNAME                        # Custom domain for GitHub Pages
  robots.txt                   # Robots directives
scripts/
  new-post.ts                  # Post scaffolding script
  check-links.ts               # Internal link checker
.github/workflows/
  deploy.yml                   # Build and deploy to GitHub Pages
  pr-check.yml                 # PR validation (typecheck + build + links)
```

## License

Repository code and tooling are licensed under the MIT License.

Blog posts, images, and authored site content are not covered by the MIT License and remain copyright the site owner unless explicitly stated otherwise.

## Phased Work

Planned phases:

1. Repository setup and documentation
2. Astro scaffold
3. Webflow crawl/import tooling
4. Layout and visual rebuild
5. Content migration
6. Contact form backend
7. Beta deployment
8. DNS cutover
9. Maintenance and backup automation

Each phase should be implemented as a small, reviewable change.
