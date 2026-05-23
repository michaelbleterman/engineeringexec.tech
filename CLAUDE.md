# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Phased migration of `engineeringexec.tech` from Webflow to a self-hosted Astro static site on GitHub Pages. The project is in early planning/repo-initialization phase — do not start implementation of later phases unless explicitly asked.

The detailed migration plan in `docs/migration-plan.md` is the single source of truth for all implementation decisions.

## Target Architecture

- **Static site:** Astro with Markdown/MDX content collections
- **Hosting:** GitHub Pages
- **Contact form:** AWS Lambda Function URL + Amazon SES (Python 3.12, SAM/CloudFormation)
- **Domain:** `engineeringexec.tech` (must be preserved)

## Planned Build Commands

These will exist once the Astro scaffold is created (Phase 2):

```bash
npm ci                       # Install dependencies
npm run dev                  # Local dev server (localhost:4321)
npm run build                # Production build
npm run typecheck            # TypeScript checks
npm run check:links          # Link validation
npm run new-post "Title"     # Scaffold a new post
```

## Hard Requirements

- Preserve existing URLs/slugs, SEO metadata, RSS, sitemap, and analytics (GA4: `G-6Q5V3L77KW`)
- Never commit secrets, AWS credentials, reCAPTCHA secrets, or the private Gmail address
- Treat the repository as public
- Never commit directly to `main` — use side branches with PR-based review
- Before committing: run `git diff --cached --check`, `git diff --cached`, and scan for secrets/PII/local paths
- Stage only files relevant to the requested phase
- Incremental, reviewable commits per phase

## Development Conventions

- EditorConfig: UTF-8, LF line endings, 2-space indent (4 for Python), trim trailing whitespace (except Markdown)
- Use `docs/migration-plan.md` as the authority for migration behavior
- Prefer scripts and repeatable workflows over manual one-off steps
- Keep build artifacts out of Git
- Create descriptive branch names; do not use tool-specific prefixes unless requested
- Do not merge to `main`, rewrite shared history, or push to remote unless explicitly asked

## Planned Repository Structure

```
src/
├── content/posts/*.mdx          # Blog posts (Astro Content Collections)
├── components/                  # Reusable Astro components
├── layouts/                     # BaseLayout.astro, PostLayout.astro
├── pages/                       # File-based routing
│   ├── posts/[slug].astro
│   └── categories/[slug].astro
└── styles/global.css

infra/contact-form/
├── template.yaml                # SAM/CloudFormation
└── src/app.py                   # Lambda handler

docs/migration-plan.md           # Detailed specification
```

## Custom Agents

Specialized agents live in `.claude/agents/`. Use them via the Agent tool with the matching `subagent_type`.

| Agent | Model | Purpose |
|-------|-------|---------|
| `orchestrator` | Opus | Breaks down goals into tasks, sequences work across phases, delegates to other agents |
| `reviewer` | Opus | Reviews code for security, URL preservation, SEO compliance, architecture, and git hygiene |
| `coder` | Sonnet | Implements Astro components, TypeScript, CSS, and configuration |
| `scraper` | Sonnet | Crawls the live Webflow site, extracts content, converts to MDX, downloads assets |
| `tester` | Sonnet | Writes and runs build validation, URL checks, Lambda tests, and security scans |
| `infra-coder` | Sonnet | Writes Lambda handler, SAM templates, GitHub Actions workflows, and deployment config |

Typical workflow: **orchestrator** plans and delegates -> **coder/scraper/infra-coder** implement -> **tester** validates -> **reviewer** approves.

## Phased Work

1. Repository setup and documentation (done)
2. Astro scaffold
3. Webflow crawl/import tooling
4. Layout and visual rebuild
5. Content migration
6. Contact form backend
7. Beta deployment
8. DNS cutover
9. Maintenance and backup automation
