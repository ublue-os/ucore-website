export const SITE = 'https://projectucore.org';

/** Maps a page route such as `/docs/zfs/` to its Markdown copy, `/docs/zfs.md`. */
export function markdownPath(pathname: string): string {
	const route = pathname.replace(/\/+$/, '');
	return route ? `${route}.md` : '/index.md';
}
