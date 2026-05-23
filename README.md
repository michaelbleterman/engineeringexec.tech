# EngineeringExec.tech

Phased migration workspace for `engineeringexec.tech`.

The goal is to move the current Webflow-hosted blog to a cost-efficient static site while preserving the public domain, URLs, content, SEO metadata, RSS, analytics continuity, and contact form behavior.

## Current Status

This repository currently contains planning and initialization files only.

The implementation plan is here:

- [Migration plan](docs/migration-plan.md)

## Target Architecture

- Astro static site
- Markdown/MDX posts
- GitHub Pages hosting
- AWS Lambda Function URL contact endpoint
- Amazon SES email delivery

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
