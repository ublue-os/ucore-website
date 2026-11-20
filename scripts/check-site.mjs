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
	'2026-11-20-fedora-45',
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
assert.equal((announcements.match(/<item>/g) ?? []).length, slugs.length, 'RSS feed must contain all announcements.');
assert.equal((announcements.match(/https:\/\/projectucore\.org\/announcements\//g) ?? []).length, slugs.length * 2, 'RSS items must link to production announcement URLs.');
assert(announcements.includes('2024-11-12-fedora-41') && announcements.includes('2024-11-12-kernel-hold'), 'Both same-day 2024 announcements must be present.');
assert(announcements.indexOf(slugs[0]) < announcements.indexOf(slugs[1]), 'The latest announcement must appear first in the feed.');
const announcementIndex = readFileSync(path.join(output, 'announcements/index.html'), 'utf8');
assert(announcementIndex.indexOf(slugs[0]) < announcementIndex.indexOf(slugs[1]), 'The latest announcement must appear first on the index.');
const fedora45 = readFileSync(path.join(output, `announcements/${slugs[0]}/index.html`), 'utf8');
assert(fedora45.includes('releases/tag/stable-20261120') && fedora45.includes('releases/tag/lts-20261120'), 'The Fedora 45 announcement must cite both releases.');
assert(!fedora45.includes('dated uCore README entry'), 'The Fedora 45 announcement must not cite a README entry.');
const fedora44 = readFileSync(path.join(output, 'announcements/2026-05-23-fedora-44/index.html'), 'utf8');
assert(fedora44.includes('dated uCore README entry') && fedora44.includes('Publication date preserved.'), 'Historical announcement source wording must be preserved.');

const searchFiles = walk(path.join(output, 'pagefind'));
assert(searchFiles.some((file) => file.endsWith('.pf_meta')), 'Pagefind metadata index is missing.');
const article = readFileSync(path.join(output, 'announcements/2026-08-18-image-upgrade-recovery/index.html'), 'utf8');
assert(article.includes('Manual recovery for failed image upgrades'), 'Announcement detail page is missing its title.');

console.log(`PASS: ${pages.length} pages, ${imageRefs.size} image references, ${slugs.length} RSS items, local links/anchors, sitemap and Pagefind output${fixture ? ' (reduced picker fixture)' : ''}.`);
