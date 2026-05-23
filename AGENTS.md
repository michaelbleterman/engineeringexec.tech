# EngineeringExec.tech Agent Context

## Project Purpose

This repository is for the phased migration of `engineeringexec.tech` from Webflow to a self-managed static site.

Target architecture:

- Astro static site
- Markdown/MDX content
- GitHub Pages hosting
- AWS Lambda Function URL for the contact form
- Amazon SES for contact email delivery
- Public GitHub repository
- Domain preserved as `engineeringexec.tech`

The detailed migration plan lives in `docs/migration-plan.md`.

## Current Phase

The project is in early planning/repo-initialization phase.

Do not start the Astro rebuild, content migration, AWS implementation, DNS work, or GitHub Pages setup unless the user explicitly asks for that phase.

## Hard Requirements

- Preserve existing public domain: `engineeringexec.tech`.
- Preserve existing URLs/slugs wherever possible.
- Preserve blog content, SEO metadata, RSS, sitemap, analytics continuity, and mobile-friendly design.
- Keep the private Gmail address out of frontend code and committed files.
- Do not commit secrets, AWS credentials, reCAPTCHA secrets, SES credentials, or private tokens.
- Prefer incremental, reviewable commits by phase.
- Treat the repository as public by default.
- Before every commit, review staged changes for secrets, PII, irrelevant local context, and code/documentation quality.
- Never commit directly to `main`; use a side branch and PR-style review flow.

## Development Conventions

- Use `docs/migration-plan.md` as the source of truth for planned migration behavior.
- Keep generated/build artifacts out of Git unless they are deliberate release artifacts.
- Prefer scripts and repeatable workflows over manual one-off migration steps.
- For future Astro work, use Markdown/MDX for posts and reusable Astro components/layouts for styling.

## Git Notes

- Create descriptive side branches for all changes; do not use tool-specific branch prefixes unless the user requests one.
- Do not commit directly to `main`.
- Do not merge to `main`, rewrite shared history, or push to a remote unless the user explicitly asks.
- If committing, stage only files relevant to the requested phase.
- Before committing, run at minimum:
  - `git diff --cached --check`
  - `git diff --cached`
  - a targeted scan for secrets, PII, and local machine paths

## Useful Starting Commands

```powershell
git status --short --branch
git log --oneline -5
Get-Content docs/migration-plan.md
```
