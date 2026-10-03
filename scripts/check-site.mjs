import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dirIndex = args.indexOf('--dir');
const output = path.resolve(dirIndex >= 0 ? args[dirIndex + 1] : path.join(root, 'dist'));
const fixture = args.includes('--fixture');

function walk(directory) {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const fullPath = path.join(directory, entry.name);
		return entry.isDirectory() ? walk(fullPath) : [fullPath];
	});
}

function routeFile(route) {
	const normalized = route.split('?')[0].split('#')[0];
	const relative = normalized.replace(/^\/+/, '');
	const direct = path.join(output, relative);
	if (existsSync(direct) && !normalized.endsWith('/')) return direct;
	return path.join(output, relative, 'index.html');
}

function htmlAttributes(source, name) {
	const attributes = [];
	const matcher = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'gis');
	for (const match of source.matchAll(matcher)) attributes.push(match[2].replaceAll('&amp;', '&').replaceAll('&#x2F;', '/'));
	return attributes;
}

function decodeHtml(value) {
	return value
		.replaceAll('&quot;', '"')
		.replaceAll('&#39;', "'")
		.replaceAll('&#x27;', "'")
		.replaceAll('&lt;', '<')
		.replaceAll('&gt;', '>')
		.replaceAll('&amp;', '&');
}

function assertExists(relative) {
	const file = path.join(output, relative);
	assert(existsSync(file), `Missing build output: ${relative}`);
	return file;
}

assert(existsSync(output), `Build output does not exist: ${output}`);
const docs = [
	'index', 'first-install', 'rebasing', 'secure-boot', 'images', 'verification',
	'containers', 'services', 'selinux', 'distrobox', 'zfs', 'nas', 'nvidia', 'diy',
];
const slugs = [
	'2026-08-18-image-upgrade-recovery', '2026-07-20-build-transparency', '2026-05-23-fedora-44',
	'2026-01-08-lts-sysext', '2025-12-10-nvidia-variants', '2025-11-20-fedora-43',
	'2025-11-08-arm64', '2025-06-12-build-streamlining', '2025-05-14-fedora-42',
	'2025-04-30-fedora-42-delay', '2024-11-12-fedora-41', '2024-11-12-kernel-hold',
];

assertExists('index.html');
assertExists('404.html');
assertExists('docs/index.html');
assertExists('announcements/index.html');
assertExists('feed.xml');
assertExists('robots.txt');
assertExists('sitemap-index.xml');
assertExists('examples/ucore-autorebase.butane');
assertExists('favicon.svg');
assertExists('licenses/space-grotesk-OFL.txt');
assertExists('licenses/ibm-plex-mono-OFL.txt');
assertExists('licenses/ucore-LICENSE.txt');
assertExists('pagefind/pagefind.js');
const pagefindEntry = JSON.parse(readFileSync(assertExists('pagefind/pagefind-entry.json'), 'utf8'));
for (const slug of docs.slice(1)) assertExists(`docs/${slug}/index.html`);
for (const slug of slugs) assertExists(`announcements/${slug}/index.html`);

const pages = walk(output).filter((file) => file.endsWith('.html'));
const expectedHtmlCount = docs.length + slugs.length + 3;
assert.equal(pages.length, expectedHtmlCount, `Expected ${expectedHtmlCount} HTML pages; got ${pages.length}.`);

const allHtml = pages.map((file) => readFileSync(file, 'utf8'));
assert(!allHtml.some((html) => /<meta\s+name=["']robots["']\s+content=["']noindex/i.test(html)), 'A page disables indexing.');
assert(!readFileSync(path.join(output, 'robots.txt'), 'utf8').match(/^Disallow:\s*\/$/m), 'robots.txt disallows all crawling.');
assert(readFileSync(path.join(output, 'robots.txt'), 'utf8').includes('https://projectucore.org/sitemap-index.xml'), 'robots.txt does not reference the sitemap index.');

for (const file of pages) {
	const html = readFileSync(file, 'utf8');
	const markup = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');
	const relative = path.relative(output, file).split(path.sep).join('/');
	for (const block of markup.matchAll(/<div\b(?=[^>]*\bdata-code-kind=["']shell["'])[^>]*>[\s\S]*?<pre>([\s\S]*?)<\/pre>/gi)) {
		for (const line of block[1].matchAll(/<code\b[^>]*\bdata-copy-line\b[^>]*>([\s\S]*?)<\/code>/gi)) {
			const command = decodeHtml(line[1]);
			assert(command.length <= 78, `${relative} has a shell snippet line longer than 78 characters (${command.length}): ${command}`);
		}
	}
	const canonicalCount = (markup.match(/<link\b[^>]*\brel=["']canonical["']/gi) ?? []).length;
	assert.equal(canonicalCount, relative === '404.html' ? 0 : 1, `${relative} has an unexpected canonical URL count.`);
	const route = relative.endsWith('/index.html') ? `/${relative.slice(0, -'index.html'.length)}` : `/${relative}`;
	const pageUrl = new URL(route, 'https://projectucore.org');
	for (const href of [...htmlAttributes(markup, 'href'), ...htmlAttributes(markup, 'src')]) {
		if (/^(?:[a-z]+:|\/\/)/i.test(href)) continue;
		const target = new URL(href, pageUrl);
		if (target.origin !== 'https://projectucore.org') continue;
		const targetFile = routeFile(`${target.pathname}${target.search}`);
		assert(existsSync(targetFile), `${relative} points to missing internal URL ${href} (expected ${path.relative(output, targetFile)}).`);
		if (target.hash && target.pathname.endsWith('.html') || target.hash && target.pathname.endsWith('/')) {
			const targetHtml = readFileSync(targetFile, 'utf8');
			const ids = new Set(htmlAttributes(targetHtml, 'id'));
			assert(ids.has(decodeURIComponent(target.hash.slice(1))), `${relative} points to missing anchor ${href}.`);
		}
	}
}

const home = readFileSync(path.join(output, 'index.html'), 'utf8');
const pickerData = home.match(/<script\b[^>]*id=["']picker-data["'][^>]*>([\s\S]*?)<\/script>/i);
assert(pickerData, 'Server-rendered picker manifest is missing from the homepage.');
const pickerManifest = JSON.parse(pickerData[1]);
const imageRefs = new Set(pickerManifest.combinations.map(({ imageRef }) => imageRef));
assert.equal(imageRefs.size, fixture ? 2 : 27, `Expected ${fixture ? 2 : 27} picker references on the homepage, got ${imageRefs.size}.`);
assert.equal(pickerManifest.combinations.length, imageRefs.size, 'Each picker combination should have its own full image reference.');
const visiblePickerGroups = pickerManifest.dimensions.filter((dimension) => dimension.options.length > 1).length;
assert.equal((home.match(/role="group"/g) ?? []).length, visiblePickerGroups, 'The picker should render every multi-option group.');
assert.equal((home.match(/aria-pressed="true"/g) ?? []).length, visiblePickerGroups, 'The picker should mark one selected option in each visible group.');
assert(/<details\b[^>]*class=["']picker-fallback["'][^>]*\bdata-pagefind-ignore/i.test(home), 'The static picker table should be available and excluded from Pagefind.');
assert.equal((home.match(/<tr>/g) ?? []).length, imageRefs.size + 1, 'The no-JavaScript picker table should contain every image reference.');
assert(!home.includes('cosign verify') && !home.includes('Where are you starting'), 'Transition workflows or verification should not be embedded in the homepage picker.');
assert.equal((home.match(/<section\b/g) ?? []).length, 4, 'The Substrate homepage should contain its four designed sections.');
assert.equal(pagefindEntry.languages.en.page_count, pages.length - 1, 'Pagefind should index every non-404 page.');
assert(htmlAttributes(home, 'id').includes('images'), 'Missing Substrate picker anchor #images.');
assert(!home.includes('id="what-is-ucore"') && !home.includes('id="image-picker"') && !home.includes('id="trust"'), 'Direction B homepage sections remain.');
const imageGuide = readFileSync(path.join(output, 'docs/images/index.html'), 'utf8');
assert(htmlAttributes(imageGuide, 'id').includes('tags'), 'The image guide is missing its #tags anchor.');
const editLinkBase = 'https://github.com/ublue-os/ucore-website/edit/main/';
for (const slug of docs) {
	const file = path.join(output, slug === 'index' ? 'docs/index.html' : `docs/${slug}/index.html`);
	const html = readFileSync(file, 'utf8');
	const links = htmlAttributes(html.replace(/<script\b[\s\S]*?<\/script>/gi, ''), 'href').filter((href) => href.startsWith(editLinkBase));
	assert.equal(links.length, 1, `${file} should have one Edit this page link.`);
}
for (const file of pages.filter((page) => page.includes(`${path.sep}announcements${path.sep}`) || path.basename(page) === 'index.html' && !page.includes(`${path.sep}docs${path.sep}`))) {
	const html = readFileSync(file, 'utf8').replace(/<script\b[\s\S]*?<\/script>/gi, '');
	assert(!html.includes(editLinkBase), `${file} should not have an Edit this page link.`);
}
for (const target of ['docs/first-install/index.html', 'docs/secure-boot/index.html']) {
	const html = readFileSync(path.join(output, target), 'utf8');
	const required = target.includes('first-install')
		? ['prepare', 'configure', 'compile', 'install', 'verify', 'existing']
		: ['what-needs-trust', 'enroll', 'confirm', 'trouble'];
	const ids = new Set(htmlAttributes(html, 'id'));
	for (const id of required) assert(ids.has(id), `${target} is missing preserved heading ID #${id}.`);
}

const announcements = readFileSync(path.join(output, 'feed.xml'), 'utf8');
assert.equal((announcements.match(/<item>/g) ?? []).length, 12, 'RSS feed must contain all 12 announcements.');
assert.equal((announcements.match(/https:\/\/projectucore\.org\/announcements\//g) ?? []).length, 24, 'RSS items must link to production announcement URLs.');
assert(announcements.includes('2024-11-12-fedora-41') && announcements.includes('2024-11-12-kernel-hold'), 'Both same-day 2024 announcements must be present.');

function markdownRoute(route) {
	const trimmed = route.replace(/\/+$/, '');
	return trimmed ? `${trimmed}.md` : '/index.md';
}

const contentPages = pages.filter((file) => path.basename(file) === 'index.html');
const markdownFiles = walk(output).filter((file) => file.endsWith('.md'));
assert.equal(markdownFiles.length, contentPages.length, `Expected one Markdown copy per page (${contentPages.length}); got ${markdownFiles.length}.`);
const headers = readFileSync(assertExists('_headers'), 'utf8');
const headerRules = headers.split(/\n(?=\S)/).filter((rule) => rule.trim());
assert(headerRules.length <= 100, `_headers has ${headerRules.length} rules; Cloudflare Pages allows 100.`);
for (const file of contentPages) {
	const relative = path.relative(output, file).split(path.sep).join('/');
	const route = `/${relative.slice(0, -'index.html'.length)}`;
	const markdownUrl = markdownRoute(route);
	const html = readFileSync(file, 'utf8');
	const alternates = [...html.matchAll(/<link\b[^>]*\brel=["']alternate["'][^>]*\btype=["']text\/markdown["'][^>]*>/gi)];
	assert.equal(alternates.length, 1, `${relative} should have one Markdown alternate link.`);
	assert.deepEqual(htmlAttributes(alternates[0][0], 'href'), [markdownUrl], `${relative} links the wrong Markdown copy.`);
	const markdown = readFileSync(assertExists(markdownUrl.slice(1)), 'utf8');
	assert(markdown.startsWith(`---\ntitle: `) && markdown.includes(`\nurl: "https://projectucore.org${route}"\n---\n`), `${markdownUrl} has unexpected front matter.`);
	assert(/^# \S/m.test(markdown), `${markdownUrl} has no H1.`);
	assert(!/<\/?(?:div|span|button|aside|nav|details|summary)\b|\bCOPY\b|Copy as Markdown|View as Markdown|^\$ /m.test(markdown), `${markdownUrl} contains page chrome or component markup.`);
	assert(headers.includes(`\n${route}\n  Link: <${markdownUrl}>; rel="alternate"; type="text/markdown"`), `_headers lacks the Markdown alternate for ${route}.`);
	assert(headers.includes(`\n${markdownUrl}\n  Link: <https://projectucore.org${route}>; rel="canonical"`), `_headers lacks the canonical link for ${markdownUrl}.`);
}
assert(!readFileSync(path.join(output, '404.html'), 'utf8').includes('text/markdown'), '404 should not advertise a Markdown copy.');
assert(readFileSync(path.join(output, 'docs/zfs.md'), 'utf8').includes('```sh\necho zfs | sudo tee /etc/modules-load.d/zfs.conf\n```'), 'docs/zfs.md lost its shell code block.');
const homeMarkdown = readFileSync(path.join(output, 'index.md'), 'utf8');
for (const imageRef of imageRefs) assert(homeMarkdown.includes(`\`${imageRef}\``), `index.md is missing image reference ${imageRef}.`);

const llms = readFileSync(assertExists('llms.txt'), 'utf8');
for (const [rel, href] of [['llms-txt', '/llms.txt'], ['llms-full-txt', '/llms-full.txt']]) {
	assert(new RegExp(`<link\\b[^>]*\\brel=["']${rel}["'][^>]*\\bhref=["']${href}["']`).test(home), `Homepage is missing <link rel="${rel}">.`);
}
assert(llms.startsWith('# uCore\n\n> '), 'llms.txt must start with an H1 and a summary blockquote.');
assert(/^## Optional$/m.test(llms), 'llms.txt is missing its Optional section.');
const llmsLinks = [...llms.matchAll(/\]\((https:\/\/projectucore\.org\/[^)\s]+\.md)\)/g)].map((match) => new URL(match[1]).pathname);
assert.equal(new Set(llmsLinks).size, contentPages.length, `llms.txt should link every Markdown page once; got ${llmsLinks.length}.`);
for (const link of llmsLinks) assertExists(link.slice(1));
const llmsFull = readFileSync(assertExists('llms-full.txt'), 'utf8');
for (const [name, text] of [['llms.txt', llms], ['llms-full.txt', llmsFull]]) {
	assert(text.includes('](https://github.com/ublue-os/ucore)'), `${name} must link the upstream ublue-os/ucore repository.`);
}
for (const link of llmsLinks) {
	const route = link === '/index.md' ? '/' : `${link.slice(0, -'.md'.length)}/`;
	assert(llmsFull.includes(`\nSource: https://projectucore.org${route}\n`), `llms-full.txt is missing ${link}.`);
}

const searchFiles = walk(path.join(output, 'pagefind'));
assert(searchFiles.some((file) => file.endsWith('.pf_meta')), 'Pagefind metadata index is missing.');
const article = readFileSync(path.join(output, 'announcements/2026-08-18-image-upgrade-recovery/index.html'), 'utf8');
assert(article.includes('Manual recovery for failed image upgrades'), 'Announcement detail page is missing its title.');

console.log(`PASS: ${pages.length} pages, ${markdownFiles.length} Markdown copies, llms.txt, _headers, ${imageRefs.size} image references, 12 RSS items, local links/anchors, sitemap and Pagefind output${fixture ? ' (reduced picker fixture)' : ''}.`);
