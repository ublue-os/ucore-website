# projectucore.org

The uCore project website, built as a static Astro site with Starlight documentation at `/docs/`.

The local `prototype/` directory contains the Substrate design handoff and is the visual authority. It is gitignored.

## Requirements

- Node.js 22 or newer
- pnpm 11.24.0
- Just

## Development

```sh
pnpm install --frozen-lockfile
just dev
```

Run the same checks as CI and generate the production site with:

```sh
just check
```

Pagefind's index is generated during the production build. After `just check`, run `just preview` to try the built-site search locally.

To verify the image picker supports a smaller fixture manifest:

```sh
just fixture
```

The production build is static output in `dist/`. Cloudflare Pages uses `pnpm install --frozen-lockfile && pnpm build` with `dist` as the output directory and Node.js 22.

## Content sources

The image picker is maintained in `src/data/picker.json`. Its 27 full image references were checked against the uCore README and workflow at revision `75ec7d8d10bc8af6fe23a284ea108bacd50f3173` on September 18, 2026. The Butane auto-rebase example is copied from the same revision. Announcement publication dates and original source links are retained in the content collection; docs pages record their source and review date.

The site adapts user-facing documentation from [ublue-os/ucore](https://github.com/ublue-os/ucore), licensed under Apache-2.0. Image definitions live in [`ucore/`](https://github.com/ublue-os/ucore/tree/main/ucore); build and release behavior is defined by the [Justfile](https://github.com/ublue-os/ucore/blob/main/ucore/Justfile) and [GitHub workflows](https://github.com/ublue-os/ucore/tree/main/.github/workflows). Site citations pin the source revision checked for each page. Review and refresh user-facing docs when those sources change.

## Markdown for agents

After the build, `src/integrations/markdown.ts` converts each page's final HTML into a Markdown copy next to it (`/docs/zfs/` → `/docs/zfs.md`, `/` → `/index.md`). It also writes `llms-full.txt` and a Cloudflare Pages `_headers` file with `Link` headers: each page points to its Markdown copy, and each copy points back to its canonical HTML page. `llms.txt` comes from `src/pages/llms.txt.ts`. Its intro, `src/llms-intro.md`, is written by hand; its sections follow the docs sidebar in `src/lib/docs-sidebar.ts`. The `rel="llms-txt"` relation is a convention, not a registered link type. When adding a component that renders interactive or decorative markup, check its Markdown output and extend the clean-up rules in the integration if needed.

## Hosting

Cloudflare Pages is configured through project settings and Git integration. Set the custom domain to `projectucore.org`; hostname redirects, if needed, are managed there. The site canonical origin is `https://projectucore.org`.
