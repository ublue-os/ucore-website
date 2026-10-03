import type { AstroIntegration } from 'astro';
import type { Element, ElementContent, Parent, Root, Text } from 'hast';
import { matches, select, selectAll } from 'hast-util-select';
import { existsSync } from 'node:fs';
import { appendFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { SITE, markdownPath } from '../lib/markdown';

// Page chrome and interactive-only markup that has no place in the Markdown copy.
const DROP = [
	'nav', 'footer', 'button', 'summary', 'script', 'style', 'template',
	'[hidden]', '[aria-hidden="true"]', '.sr-only', '.status-message', '[data-page-actions]',
	'.breadcrumb', '.backlink',
].join(', ');

const parseHtml = unified().use(rehypeParse);
const toMarkdown = unified()
	.use(rehypeRemark)
	.use(remarkGfm)
	.use(remarkStringify, { bullet: '-', fences: true, rule: '-' });

const text = (value: string): Text => ({ type: 'text', value });
const element = (tagName: string, children: ElementContent[], properties: Element['properties'] = {}): Element => ({
	type: 'element', tagName, properties, children,
});

function textOf(node: Root | ElementContent): string {
	if (node.type === 'text') return node.value;
	return 'children' in node ? node.children.map((child) => textOf(child as ElementContent)).join('') : '';
}

/** `CommandBlock.astro` → a fenced block without prompts or the copy button. */
function codeBlock(node: Element): Element {
	const lines = selectAll('[data-copy-line]', node).map(textOf);
	const lang = node.properties.dataCodeKind === 'shell' ? 'sh' : 'text';
	return element('pre', [element('code', [text(lines.join('\n'))], { className: [`language-${lang}`] })]);
}

/** `Note.astro` → a blockquote that keeps the "Note" label in prose. */
function note(node: Element): Element {
	const body = select('.note-body', node)?.children ?? [];
	const label = element('strong', [text('Note:')]);
	const hasBlocks = body.some((child) => child.type === 'element' && matches('p, ul, ol, pre, div, blockquote', child));
	return element('blockquote', hasBlocks ? [element('p', [label]), ...body] : [element('p', [label, text(' '), ...body])]);
}

/** Homepage link rows, layer slabs and link cards → plain lists. */
function cardList(node: Element, titleSelector?: string, copySelector?: string): Element {
	const cards = node.children.filter((child): child is Element => child.type === 'element');
	return element('ul', cards.map((card) => {
		const part = (selector?: string) => {
			const match = selector ? select(selector, card) : card;
			return match ? textOf(match).trim() : '';
		};
		const title = part(titleSelector);
		const copy = copySelector ? part(copySelector) : '';
		const href = card.tagName === 'a' ? String(card.properties.href) : undefined;
		const name = href ? element('a', [text(title)], { href }) : element('strong', [text(title)]);
		return element('li', [name, text(copy ? `: ${copy}` : '')]);
	}));
}

function rewrite(parent: Parent): void {
	parent.children = parent.children.flatMap((child): typeof parent.children => {
		if (child.type === 'comment') return [];
		if (child.type !== 'element') return [child];
		if (matches('.layer-slabs', child)) return [cardList(child, '.layer-name', '.layer-description')];
		if (matches('.link-cards', child)) return [cardList(child, '.link-card-title', '.link-card-copy')];
		if (matches('.hero-actions', child)) return [cardList(child)];
		if (matches(DROP, child)) return [];
		if (matches('.code-block', child)) return [codeBlock(child)];
		if (matches('aside.note', child)) return [note(child)];
		if (matches('h1, h2, h3, h4, h5, h6', child)) {
			child.children = child.children.map((node) => (node.type === 'element' && node.tagName === 'br' ? text(' ') : node));
		}
		rewrite(child);
		// The image table lives inside a disclosure; keep only its contents.
		if (matches('details', child)) return child.children;
		return [child];
	});
}

function frontMatter(fields: Record<string, string>): string {
	return `---\n${Object.entries(fields).map(([key, value]) => `${key}: ${JSON.stringify(value)}`).join('\n')}\n---\n\n`;
}

/** Converts one built HTML page into Markdown with YAML front matter. */
export async function pageToMarkdown(html: string, route: string): Promise<string> {
	const tree = parseHtml.parse(html);
	const main = select('main', tree);
	if (!main) throw new Error(`No <main> element on ${route}`);
	const title = textOf(select('title', tree) ?? main).replace(/\s*\|\s*uCore$/, '').trim();
	const description = String(select('meta[name="description"]', tree)?.properties.content ?? '');
	const content: Root = { type: 'root', children: [main] };
	rewrite(content);
	for (const link of selectAll('a[href^="/"]', content)) link.properties.href = `${SITE}${link.properties.href}`;
	const markdown = toMarkdown.stringify(await toMarkdown.run(content)).trim();
	return `${frontMatter({ title, description, url: `${SITE}${route}` })}${markdown}\n`;
}

async function htmlPages(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { recursive: true });
	return entries.filter((entry) => entry.endsWith('index.html')).map((entry) => entry.split(path.sep).join('/')).sort();
}

function stripFrontMatter(markdown: string): { url: string; body: string } {
	const match = markdown.match(/^---\n([\s\S]*?)\n---\n\n/);
	const url = match?.[1].match(/^url: (.*)$/m)?.[1];
	if (!match || !url) throw new Error('Generated Markdown is missing its front matter.');
	return { url: JSON.parse(url), body: markdown.slice(match[0].length) };
}

export default function markdownForAgents(): AstroIntegration {
	return {
		name: 'markdown-for-agents',
		hooks: {
			'astro:build:done': async ({ dir, logger }) => {
				const output = fileURLToPath(dir);
				const routes: string[] = [];
				for (const file of await htmlPages(output)) {
					const route = `/${file.slice(0, -'index.html'.length)}`;
					const target = path.join(output, markdownPath(route));
					await mkdir(path.dirname(target), { recursive: true });
					await writeFile(target, await pageToMarkdown(await readFile(path.join(output, file), 'utf8'), route));
					routes.push(route);
				}

				// llms-full.txt follows the order curated in llms.txt.
				const index = await readFile(path.join(output, 'llms.txt'), 'utf8');
				const linked = [...new Set([...index.matchAll(/\]\((https:\/\/projectucore\.org\/[^)\s]+\.md)\)/g)].map((match) => match[1]))];
				const sections = await Promise.all(linked.map(async (url) => {
					const { url: page, body } = stripFrontMatter(await readFile(path.join(output, new URL(url).pathname), 'utf8'));
					return `Source: ${page}\n\n${body}`;
				}));
				const full = `# uCore: full site content\n\nEvery page listed in ${SITE}/llms.txt, in the same order. Images, builds and releases are defined in [ublue-os/ucore](https://github.com/ublue-os/ucore), the source of truth for this site.\n\n${sections.map((section) => `---\n\n${section}`).join('\n')}`;
				await writeFile(path.join(output, 'llms-full.txt'), full);

				// Cloudflare Pages headers: Markdown alternates for pages, canonical HTML for Markdown copies.
				const rules = [
					'/*.md\n  Content-Type: text/markdown; charset=utf-8',
					'/llms.txt\n  Content-Type: text/plain; charset=utf-8',
					'/llms-full.txt\n  Content-Type: text/plain; charset=utf-8',
					...routes.flatMap((route) => [
						`${route}\n  Link: <${markdownPath(route)}>; rel="alternate"; type="text/markdown", </llms.txt>; rel="llms-txt"`,
						`${markdownPath(route)}\n  Link: <${SITE}${route}>; rel="canonical"`,
					]),
				];
				const headersFile = path.join(output, '_headers');
				const headers = `${rules.join('\n\n')}\n`;
				if (existsSync(headersFile)) await appendFile(headersFile, `\n${headers}`);
				else await writeFile(headersFile, headers);

				logger.info(`Wrote ${routes.length} Markdown pages, llms-full.txt (${linked.length} pages) and _headers.`);
			},
		},
	};
}
