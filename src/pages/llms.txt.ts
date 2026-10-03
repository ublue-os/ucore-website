import { getCollection } from 'astro:content';
import intro from '../llms-intro.md?raw';
import { sortAnnouncements } from '../lib/announcements';
import { docsSidebar, type DocsLink } from '../lib/docs-sidebar';
import { SITE, markdownPath } from '../lib/markdown';

interface Section {
	title: string;
	entries: string[];
}

const entry = (title: string, route: string, description: string) => `- [${title}](${SITE}${markdownPath(route)}): ${description}`;

export async function GET() {
	const docs = new Map((await getCollection('docs')).map((page) => [`/${page.id.replace(/\/index$/, '')}/`, page]));
	const docEntry = ({ label, link }: DocsLink) => {
		const page = docs.get(link);
		if (!page?.data.description) throw new Error(`llms.txt: no docs page with a description for ${link}`);
		return entry(label, link, page.data.description);
	};

	// Sidebar groups become sections; loose links before the first group join the overview.
	const overview = [entry('Home', '/', 'What uCore is, the three image layers, and every published image reference.')];
	const sections: Section[] = [];
	for (const item of docsSidebar) {
		if ('items' in item) sections.push({ title: item.label, entries: item.items.map(docEntry) });
		else if (!sections.length) overview.push(docEntry(item));
		else {
			if (sections.at(-1)?.title !== 'More documentation') sections.push({ title: 'More documentation', entries: [] });
			sections.at(-1)?.entries.push(docEntry(item));
		}
	}
	overview.push(
		entry('Announcements', '/announcements/', 'Project news, newest first, including known issues and stream changes.'),
		'- [ublue-os/ucore on GitHub](https://github.com/ublue-os/ucore): Image definitions, build workflows, releases and issues; the source of truth for this site.',
	);

	const announcements = sortAnnouncements(await getCollection('announcements')).map((item) =>
		entry(item.data.title, `/announcements/${item.data.slug}/`, `(${item.data.date}) ${item.data.summary}`),
	);

	const body = [
		intro.trim(),
		...[{ title: 'Overview', entries: overview }, ...sections, { title: 'Optional', entries: announcements }].map(
			({ title, entries }) => `## ${title}\n\n${entries.join('\n')}`,
		),
	].join('\n\n');

	return new Response(`${body}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
