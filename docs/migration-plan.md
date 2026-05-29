# EngineeringExec.tech Migration Plan

## Summary

Migrate `engineeringexec.tech` from Webflow to an Astro static site hosted on GitHub Pages, with AWS Lambda + Amazon SES handling the contact form.

The migrated site must preserve:

- Public domain: `engineeringexec.tech`
- Existing URLs and slugs
- Visual design and mobile friendliness
- Blog content
- Images and embedded assets
- SEO metadata
- OpenGraph/social metadata
- JSON-LD structured data
- RSS
- Sitemap
- Google Analytics / Search Console continuity
- Contact form behavior without exposing the private Gmail address

Chosen architecture:

- Static site generator: **Astro**
- Content format: **Markdown/MDX**
- Hosting: **GitHub Pages**
- Repository: **public GitHub repo**
- Contact backend: **AWS Lambda Function URL**
- Email delivery: **Amazon SES**
- SES sender identity: **domain sender**, for example `contact@engineeringexec.tech`
- Recipient: private Gmail address stored only in AWS configuration
- AWS region: `us-east-1`

### Migration Progress

| Phase | Description | Status | PRs |
|-------|-------------|--------|-----|
| 1 | Repository setup and documentation | Done | #1 |
| 2 | Astro scaffold | Done | #2 |
| 3 | Webflow crawl/import tooling | Done | #5 |
| 4 | Layout and visual rebuild | Done | #6 |
| 5 | Content migration | Done | #7 |
| 6 | Contact form backend | Done | #8 |
| 7 | Beta deployment | Done | #9, #10, #11 |
| 8 | DNS cutover | Done | |
| 9 | Maintenance and backup automation | Not started | |

Beta site: `https://michaelbleterman.github.io/engineeringexec.tech/`

---

## Current Site Inventory

The current Webflow site has 28 public sitemap URLs:

- Home page
- About page
- All posts page
- Contact page
- Icons page
- Privacy policy page
- 10 blog posts
- 12 category pages

Detected integrations and assets:

- Google Analytics ID: `G-6Q5V3L77KW`
- Google Search Console expected to remain domain-based
- Google reCAPTCHA script
- CookieYes script
- ShareThis script
- Webflow JavaScript and jQuery
- Webflow-hosted images/assets
- JSON-LD structured data on some pages
- OpenGraph metadata on post pages
- RSS available at `/posts/rss.xml`
- `/rss.xml` currently returns 404 and should be fixed or redirected
- `robots.txt` points to `https://engineeringexec.tech/sitemap.xml`

Important migration note:

Webflow native code export is not sufficient because exported Webflow code does not preserve CMS-generated collection behavior, working forms, or Webflow form processing. The migration should use the live published site as the content/design source and rebuild it as an Astro static site.

---

## Target Repository Structure

Recommended structure:

```text
.
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── README.md
├── docs/
│   ├── runbook.md
│   ├── publishing-guide.md
│   ├── restore-guide.md
│   └── cutover-checklist.md
├── public/
│   ├── assets/
│   ├── robots.txt
│   └── favicon files
├── scripts/
│   ├── crawl-current-site.ts
│   ├── import-webflow-posts.ts
│   ├── new-post.ts
│   ├── check-links.ts
│   └── compare-live-vs-beta.ts
├── src/
│   ├── content/
│   │   ├── config.ts
│   │   └── posts/
│   │       └── *.mdx
│   ├── components/
│   ├── layouts/
│   │   ├── BaseLayout.astro
│   │   └── PostLayout.astro
│   ├── pages/
│   │   ├── index.astro
│   │   ├── about.astro
│   │   ├── all-posts.astro
│   │   ├── contact.astro
│   │   ├── privacy-policy.astro
│   │   ├── rss.xml.ts
│   │   ├── sitemap.xml.ts
│   │   ├── categories/
│   │   │   └── [slug].astro
│   │   └── posts/
│   │       └── [slug].astro
│   └── styles/
│       └── global.css
└── infra/
    └── contact-form/
        ├── template.yaml
        ├── src/
        │   └── app.py
        └── tests/
```

---

## Astro Content Model

Use Astro Content Collections for posts.

Each post should live in:

```text
src/content/posts/{slug}.mdx
```

Required frontmatter:

```yaml
title: "Post title"
slug: "post-slug"
date: "2026-05-23"
updated: "2026-05-23"
description: "Short SEO description."
categories:
  - "software-development"
tags:
  - "example"
heroImage: "/assets/posts/post-slug/hero.jpg"
heroAlt: "Accessible image description"
ogImage: "/assets/posts/post-slug/og.jpg"
canonical: "https://engineeringexec.tech/posts/post-slug"
draft: false
```

Rules:

- `slug` must match the existing Webflow URL slug for migrated posts.
- Published slugs should never change without a redirect.
- Draft posts must not appear in sitemap, RSS, category pages, or all-posts.
- Categories should use a controlled list unless intentionally adding a new category page.

---

## Public URL Requirements

Preserve these URL shapes:

```text
/
/about
/all-posts
/contact
/privacy-policy
/icons
/posts/{slug}
/categories/{slug}
/posts/rss.xml
/rss.xml
/sitemap.xml
/robots.txt
```

Implementation defaults:

- Configure Astro with `trailingSlash: "never"`.
- Add `/rss.xml` as either a duplicate feed or redirect to `/posts/rss.xml`.
- Preserve all current post and category slugs.
- Avoid changing URL casing.

---

## Migration Implementation

### Content Import

Build migration scripts that:

1. Fetch `https://engineeringexec.tech/sitemap.xml`.
2. Crawl every URL listed in the sitemap.
3. Save raw HTML snapshots for audit purposes.
4. Extract:
   - Title
   - Description
   - Canonical URL
   - OpenGraph metadata
   - JSON-LD blocks
   - Post body
   - Publish/update dates where available
   - Category labels
   - Hero image
   - Inline images
   - Internal links
5. Convert blog posts into MDX.
6. Preserve complex HTML blocks inside MDX when Markdown conversion would lose fidelity.
7. Download Webflow-hosted images/assets into `public/assets/`.
8. Rewrite asset URLs to local paths.
9. Rewrite internal links to root-relative paths.
10. Generate one MDX file per post.

### Layout Rebuild

Recreate the Webflow design in Astro layouts and CSS.

Acceptance standard:

- Not pixel-perfect.
- Must look the same to a normal visitor.
- Must remain mobile-friendly.
- Must preserve readable typography, spacing, navigation, footer, post cards, category pages, and contact page styling.

Avoid keeping Webflow-generated structure everywhere. Use clean Astro components for:

- Header/navigation
- Footer
- Post card/list item
- Category list
- Blog post layout
- SEO metadata
- Social metadata
- Contact form

### Metadata

Every page must produce:

- `<title>`
- Meta description where appropriate
- Canonical URL
- OpenGraph title
- OpenGraph description
- OpenGraph image where available
- JSON-LD for blog posts
- RSS entry for posts
- Sitemap entry for public non-draft pages

Preserve Google Analytics:

```text
G-6Q5V3L77KW
```

CookieYes and ShareThis should be migrated only if still desired after beta review.

---

## Contact Form Architecture

Replace Webflow form processing with:

```text
Static Astro contact page
        ↓
AWS Lambda Function URL
        ↓
reCAPTCHA verification
        ↓
Amazon SES
        ↓
Private Gmail inbox
```

### Browser Request

Endpoint:

```text
POST https://<lambda-function-url>/
```

Payload:

```json
{
  "name": "Visitor Name",
  "email": "visitor@example.com",
  "message": "Message text",
  "recaptchaToken": "token-from-google",
  "page": "https://engineeringexec.tech/contact",
  "honeypot": ""
}
```

### Lambda Behavior

The Lambda must:

- Accept `POST` and `OPTIONS`.
- Reject all other methods.
- Validate CORS.
- Validate request body JSON.
- Reject empty fields.
- Reject invalid email format.
- Reject oversized submissions.
- Reject filled honeypot field.
- Verify reCAPTCHA server-side.
- Send email through SES.
- Use visitor email as `Reply-To`.
- Never use visitor email as `From`.
- Never expose private Gmail address.
- Return generic success/failure messages.

### CORS Allowed Origins

Allow:

```text
https://engineeringexec.tech
https://www.engineeringexec.tech
https://<github-user>.github.io
http://localhost:4321
```

If using a beta subdomain, add it explicitly.

### SES Sender

Use a domain sender:

```text
EngineeringExec Contact <contact@engineeringexec.tech>
```

Recipient:

```text
private Gmail address stored in AWS SSM Parameter Store
```

The Gmail address must not be committed to the repo or exposed in built frontend files.

### AWS Parameters

Store configuration in AWS Systems Manager Parameter Store:

```text
/engineeringexec/contact/recaptcha_secret
/engineeringexec/contact/recipient_email
/engineeringexec/contact/sender_email
```

Use encrypted `SecureString` for secrets.

### IAM

The Lambda execution role should allow only:

- Reading the specific SSM parameters above.
- Calling `ses:SendEmail`.
- Writing CloudWatch logs.

Do not grant broad SES, SSM, or admin permissions.

---

## AWS Setup

### SES

1. Create SES identity for `engineeringexec.tech`.
2. Enable Easy DKIM.
3. Add SES DKIM DNS records in GoDaddy.
4. Verify identity status in SES.
5. Request SES production access before cutover, unless temporarily staying in sandbox.
6. If SES remains in sandbox, verify the private Gmail recipient as a temporary workaround.

### Lambda

Use AWS SAM or CloudFormation under:

```text
infra/contact-form/template.yaml
```

Recommended runtime:

```text
Python 3.12
```

Recommended memory/timeouts:

```text
Memory: 128 MB
Timeout: 10 seconds
```

Use Lambda Function URL rather than API Gateway for simplicity and cost efficiency.

---

## GitHub Pages Deployment

Use GitHub Actions.

### Pull Request Workflow

On PR:

```text
npm ci
npm run typecheck
npm run build
npm run check:links
```

### Main Branch Workflow

On push to `main`:

```text
npm ci
npm run build
deploy dist/ to GitHub Pages
```

Use official GitHub Pages deployment actions or Astro's GitHub Pages action.

### Repository Settings

- Repo visibility: public.
- Only owner can push to `main`.
- Enable branch protection for `main`.
- Require passing checks before merge if using PRs.
- GitHub Pages source: GitHub Actions.
- Custom domain: `engineeringexec.tech`.

Add a `CNAME` file containing:

```text
engineeringexec.tech
```

---

## Beta Development Plan

**Status: Complete.** Beta deployed at `https://michaelbleterman.github.io/engineeringexec.tech/`.

### Beta Goals

Validate the Astro rebuild before touching production DNS.

Beta must prove:

- [x] URLs are preserved.
- [x] Design is acceptable on desktop and mobile.
- [x] Metadata is preserved.
- [x] RSS works.
- [x] Sitemap works.
- [x] Contact form works.
- [x] GA4 receives page views.
- [x] No private data is exposed.

### Beta URL

GitHub Pages project site URL:

```text
https://michaelbleterman.github.io/engineeringexec.tech/
```

Base path (`/engineeringexec.tech`) is configured via GitHub repo variables `ASTRO_SITE` and `ASTRO_BASE`, consumed by `astro.config.mjs`.

### Beta Implementation Notes

Key challenges resolved during beta deployment:

1. **MSYS path conversion** — Git Bash on Windows converts env vars starting with `/` to Windows paths. Use `MSYS_NO_PATHCONV=1` when setting `ASTRO_BASE` or running `gh variable set`.
2. **Base path in MDX content** — Internal links and images in MDX files don't automatically include the base path. Solved with a rehype plugin (`src/plugins/rehype-base-path.ts`).
3. **Hero images** — `PostLayout.astro` now prepends the base path to `heroImage` src.
4. **RSS feed links** — `@astrojs/rss` strips trailing slashes, breaking relative URL resolution. Item links are now constructed as absolute URLs.
5. **Lambda CORS** — Added `michaelbleterman.github.io` to allowed origins in SAM template and redeployed.
6. **SES IAM policy** — Broadened from domain-only to `identity/*` for sandbox mode (both sender and recipient identities require authorization).
7. **reCAPTCHA domain** — Added `michaelbleterman.github.io` in Google reCAPTCHA admin console.

### Beta Checks

Automated checks:

- [x] Build succeeds.
- [x] All internal links work (29 HTML files, 0 broken).
- [x] Sitemap contains all expected URLs (29 entries).
- [x] RSS validates with correct links.
- [x] No draft posts appear.
- [x] No secrets appear in built files.
- [x] Contact Lambda test succeeds.
- [x] TypeScript check passes (0 errors).

Manual checks (Playwright E2E on live site):

- [x] Homepage — no console errors, all links correct.
- [x] About page — no errors, image loads.
- [x] All posts page — all 10 posts listed, links correct.
- [x] Category page (agile) — filtered correctly.
- [x] Post with hero image — loads after fix.
- [x] Post with inline images (estimation) — loads after fix.
- [x] Post with cross-links (AI-Scrum ↔ 50 Shades) — links correct after fix.
- [x] Contact page — form submits, email received.
- [x] Privacy policy — all internal links correct.
- [x] Footer/social links — functional.
- [x] Browser console — no errors on any page (after fixes).
- [ ] Lighthouse spot check for performance and SEO.

---

## Cutover Plan

### Pre-Cutover Checklist

Before changing DNS:

- Freeze Webflow edits.
- Run final crawl/import from live Webflow site.
- Deploy final Astro build to GitHub Pages.
- Confirm GitHub Pages custom domain is configured.
- Confirm `CNAME` file exists.
- Confirm SES identity is verified.
- Confirm SES production access is approved or Gmail recipient is verified.
- Confirm Lambda contact endpoint works from beta.
- Confirm GA4 receives traffic.
- Confirm Search Console access.
- Archive Webflow sitemap and current HTML snapshots.
- Lower DNS TTL if GoDaddy allows it.
- Record current Webflow DNS records for rollback.

### DNS Cutover

At GoDaddy, point the domain to GitHub Pages.

Use current GitHub Pages documentation for exact DNS records.

Typical setup:

- Apex domain `engineeringexec.tech`:
  - GitHub Pages `A` records
  - GitHub Pages `AAAA` records if desired
- `www.engineeringexec.tech`:
  - CNAME to `<github-user>.github.io`

Then:

1. Wait for DNS propagation.
2. Confirm GitHub Pages recognizes the custom domain.
3. Enable/enforce HTTPS in GitHub Pages.
4. Test production pages.
5. Submit sitemap in Google Search Console.

### Post-Cutover Smoke Test

Test:

```text
https://engineeringexec.tech/
https://engineeringexec.tech/about
https://engineeringexec.tech/all-posts
https://engineeringexec.tech/contact
https://engineeringexec.tech/privacy-policy
https://engineeringexec.tech/posts/rss.xml
https://engineeringexec.tech/rss.xml
https://engineeringexec.tech/sitemap.xml
```

Also test:

- A migrated post URL.
- A category URL.
- Contact form submission.
- Mobile layout.
- GA4 real-time events.
- Search Console sitemap submission.

Keep Webflow active for 7-14 days after cutover.

---

## Rollback Plan

### Rollback During First 14 Days

If production fails after DNS cutover:

1. Revert GoDaddy DNS records to previous Webflow records.
2. Confirm Webflow serves production again.
3. Keep GitHub Pages beta available.
4. Diagnose issue.
5. Repeat cutover after fix.

### Rollback After Webflow Cancellation

If Webflow is no longer active:

1. Revert GitHub repo to last known-good commit.
2. Re-run GitHub Pages deployment.
3. If needed, deploy a previous `dist/` build artifact.
4. Restore Lambda from SAM/CloudFormation template.
5. Manually restore SSM parameter values if Lambda config was lost.

---

## Backup And Restore

### Backup Strategy

Primary backup:

```text
Git repository + GitHub remote
```

Additional backups:

- GitHub Releases containing monthly `dist/` build artifact.
- Quarterly static crawl of production site.
- Raw Webflow migration snapshots retained in a release artifact or backup archive.
- AWS infrastructure stored as SAM/CloudFormation templates.
- DNS and SES setup documented in `docs/runbook.md`.

Never commit:

- Gmail recipient address if considered private.
- reCAPTCHA secret.
- AWS credentials.
- SES credentials.
- Any private token.

### Monthly Backup Task

Run:

```bash
npm ci
npm run build
```

Then archive:

```text
dist/
```

Attach the archive to a GitHub Release named like:

```text
site-backup-YYYY-MM
```

### Restore Procedure

To restore a previous website version:

```bash
git checkout <known-good-commit>
npm ci
npm run build
```

Then redeploy through GitHub Actions.

To restore from artifact:

1. Download latest known-good `dist/` artifact.
2. Deploy it through the GitHub Pages workflow or emergency static deploy branch.
3. Confirm production URLs.

To restore contact form:

1. Redeploy `infra/contact-form/template.yaml`.
2. Recreate SSM parameters.
3. Verify SES identity.
4. Submit test form.

---

## Ongoing Maintenance Plan

### Pending Repository Tasks

- After adding the MIT license during GitHub repository creation, document the license boundary: MIT applies to code and tooling, while blog posts, images, and authored content remain copyright the site owner unless explicitly stated otherwise.

### Monthly

- Publish or update content.
- Run local build.
- Run link check.
- Verify recent post appears in RSS and sitemap.
- Check GA4 for traffic continuity.
- Check Search Console for indexing issues.

### Quarterly

- Update npm dependencies.
- Run visual smoke test.
- Test contact form.
- Check AWS bill.
- Check CloudWatch logs for Lambda errors.
- Check SES sending reputation and bounces.
- Crawl site for broken external links.

### Semiannual

- Review CookieYes/ShareThis need.
- Review SEO metadata quality.
- Refresh screenshots for regression comparison.
- Confirm GoDaddy DNS records.
- Confirm GitHub Pages settings.
- Confirm SES DKIM remains verified.

### Annual

- Review hosting cost.
- Review AWS region/service pricing.
- Review GitHub Pages limits.
- Review backup restore procedure.
- Run a full restore drill from a previous artifact.

---

## Publishing Guide

### Create A New Post

Run:

```bash
npm run new-post "Post Title"
```

This should create:

```text
src/content/posts/post-title.mdx
public/assets/posts/post-title/
```

Edit the MDX file.

Required frontmatter:

```yaml
title: "Post Title"
slug: "post-title"
date: "2026-05-23"
updated: "2026-05-23"
description: "Short description for SEO and social previews."
categories:
  - "software-development"
tags:
  - "example"
heroImage: "/assets/posts/post-title/hero.jpg"
heroAlt: "Description of hero image"
ogImage: "/assets/posts/post-title/og.jpg"
canonical: "https://engineeringexec.tech/posts/post-title"
draft: false
```

Preview locally:

```bash
npm run dev
```

Before publishing:

```bash
npm run build
npm run check:links
```

Publish by merging/pushing to `main`.

### Edit Existing Post

1. Edit the MDX file in `src/content/posts/`.
2. Update `updated`.
3. Do not change `slug` unless adding a redirect.
4. Run build and link check.
5. Deploy.

### Drafts

Set:

```yaml
draft: true
```

Draft posts must not appear in:

- Post pages
- All posts
- Category pages
- RSS
- Sitemap

### Images

Store post images under:

```text
public/assets/posts/{slug}/
```

Reference them as:

```md
![Alt text](/assets/posts/{slug}/image.jpg)
```

Image rules:

- Use meaningful alt text.
- Compress large images before commit.
- Prefer `.webp` or optimized `.jpg`.
- Keep filenames lowercase and hyphenated.
- Avoid hotlinking Webflow CDN assets after migration.

### Links

Use root-relative internal links:

```md
[About](/about)
[Another post](/posts/example-post)
```

Avoid absolute internal links unless needed.

External links should include normal Markdown links:

```md
[Source](https://example.com)
```

---

## Styling Guide

### Global Styling

Global design tokens should live in:

```text
src/styles/global.css
```

Use shared variables for:

- Colors
- Font families
- Font sizes
- Spacing
- Content width
- Border radius
- Link styles

### Layout Components

Use shared components for:

- Header
- Footer
- Post card
- Category badge
- Share links
- SEO head metadata
- Contact form

Avoid one-off styling inside individual posts.

### Post Styling

Posts should use normal Markdown whenever possible:

```md
## Section

Paragraph text.

- Bullet
- Bullet

> Quote
```

Use MDX components only for reusable patterns such as:

```mdx
<Callout type="note">
Important note.
</Callout>
```

Do not add inline CSS in posts unless preserving legacy content that cannot otherwise be represented.

### Visual Consistency

Any styling change must be checked at:

- Mobile width
- Tablet width
- Desktop width

Core pages to check:

- Home
- All posts
- Blog post
- Category
- Contact
- About

### SEO Styling Constraints

Do not hide important text in images.

Do not remove headings just for visual reasons.

Each post page should have:

- Exactly one visible `h1`
- Logical `h2` / `h3` hierarchy
- Readable body text
- Accessible links
- Descriptive image alt text

---

## Test Plan

### Automated Tests

Required commands:

```bash
npm run typecheck
npm run build
npm run check:links
```

Contact form tests should cover:

- Valid submission
- Missing fields
- Invalid email
- Oversized message
- Honeypot filled
- Missing reCAPTCHA token
- Failed reCAPTCHA verification
- SES send failure
- CORS preflight
- Disallowed origin

Static site tests should cover:

- All migrated URLs build.
- Sitemap includes all public pages.
- RSS includes all non-draft posts.
- Drafts are excluded.
- Category pages include expected posts.
- Internal links resolve.
- Metadata is present.

### Manual Acceptance Tests

Before production cutover:

- Homepage visually acceptable on desktop/mobile.
- Blog post visually acceptable on desktop/mobile.
- Category page visually acceptable.
- Contact form sends email.
- Gmail address is not visible in page source.
- Browser console has no serious errors.
- GA4 receives traffic.
- Search Console accepts sitemap.
- RSS opens in browser/feed reader.
- Production URLs match old Webflow URLs.

---

## Acceptance Criteria

The migration is complete when:

- `engineeringexec.tech` is served by GitHub Pages.
- All existing public URLs work or intentionally redirect.
- All blog content is migrated.
- Design is visually close to Webflow.
- Site is mobile-friendly.
- Contact form sends email through AWS SES.
- Private Gmail is not exposed.
- GA4 is active.
- Search Console sitemap is submitted.
- RSS works.
- Backups and restore instructions exist.
- Webflow can be safely canceled after the observation window.

---

## References

- [GitHub Pages overview](https://docs.github.com/pages/getting-started-with-github-pages/what-is-github-pages)
- [GitHub Pages custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)
- [Astro deploy to GitHub Pages](https://v4.docs.astro.build/en/guides/deploy/github/)
- [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/)
- [AWS Lambda Function URLs](https://docs.aws.amazon.com/lambda/latest/dg/urls-configuration.html)
- [Amazon SES email sending](https://docs.aws.amazon.com/ses/latest/dg/send-email.html)
- [Amazon SES DKIM authentication](https://docs.aws.amazon.com/ses/latest/dg/send-email-authentication-dkim.html)
- [Google reCAPTCHA server verification](https://developers.google.com/recaptcha/docs/verify)
