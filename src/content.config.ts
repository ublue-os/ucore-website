import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { docsLoader, i18nLoader } from '@astrojs/starlight/loaders';
import { docsSchema, i18nSchema } from '@astrojs/starlight/schema';

const docs = defineCollection({
	loader: docsLoader(),
	schema: docsSchema({
		extend: z.object({
			source: z.url().optional(),
			sourceRevision: z.string().optional(),
			sourceCheckedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
		}),
	}),
});

const i18n = defineCollection({ loader: i18nLoader(), schema: i18nSchema() });

const announcements = defineCollection({
	loader: glob({ pattern: '**/*.mdx', base: './src/content/announcements' }),
	schema: z.object({
		title: z.string(),
		slug: z.string(),
		date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
		summary: z.string(),
		source: z.url().optional(),
		sourceRevision: z.string().optional(),
		sources: z.array(z.object({
			label: z.string(),
			url: z.url(),
			revision: z.string(),
		})).min(1).optional(),
		sourceCheckedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
		historical: z.boolean(),
		updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
	}).refine((data) => (data.source && data.sourceRevision) || data.sources, {
		message: 'Provide a source and revision or a list of sources.',
	}),
});

export const collections = { docs, i18n, announcements };
