import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import { resolve } from 'node:path';
import { docsSidebar } from './src/lib/docs-sidebar';
import markdownForAgents from './src/integrations/markdown';

export default defineConfig({
	site: 'https://projectucore.org',
	output: 'static',
	trailingSlash: 'always',
	outDir: resolve(process.env.ASTRO_OUT_DIR ?? './dist'),
	integrations: [
		sitemap(),
		starlight({
			title: 'uCore',
			description: 'Documentation for the uCore server operating system.',
			disable404Route: true,
			defaultLocale: 'root',
			locales: { root: { label: 'English', lang: 'en' } },
			pagination: true,
			credits: false,
			expressiveCode: false,
			lastUpdated: true,
			editLink: { baseUrl: 'https://github.com/ublue-os/ucore-website/edit/main/' },
			head: [
				{
					tag: 'link',
					attrs: {
						rel: 'alternate',
						type: 'application/rss+xml',
						title: 'uCore announcements',
						href: 'https://projectucore.org/feed.xml',
					},
				},
			],
			components: {
				EditLink: './src/components/starlight/EditLink.astro',
				Footer: './src/components/starlight/Footer.astro',
				Head: './src/components/starlight/Head.astro',
				Header: './src/components/starlight/Header.astro',
				LastUpdated: './src/components/starlight/LastUpdated.astro',
				Search: './src/components/starlight/Search.astro',
				ThemeProvider: './src/components/starlight/ThemeProvider.astro',
				Sidebar: './src/components/starlight/Sidebar.astro',
				MobileMenuToggle: './src/components/starlight/MobileMenuToggle.astro',
				MobileMenuFooter: './src/components/starlight/MobileMenuFooter.astro',
				PageFrame: './src/components/starlight/PageFrame.astro',
				PageSidebar: './src/components/starlight/PageSidebar.astro',
				TwoColumnContent: './src/components/starlight/TwoColumnContent.astro',
				TableOfContents: './src/components/starlight/TableOfContents.astro',
				MobileTableOfContents: './src/components/starlight/MobileTableOfContents.astro',
				PageTitle: './src/components/starlight/PageTitle.astro',
				Pagination: './src/components/starlight/Pagination.astro',
			},
			customCss: ['./src/styles/tokens.css', './src/styles/site.css', './src/styles/starlight.css'],
			markdown: {
				headingLinks: false,
			},
			tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
			sidebar: docsSidebar,
		}),
		markdownForAgents(),
	],
});
