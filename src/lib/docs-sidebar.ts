export interface DocsLink {
	label: string;
	link: string;
}

export interface DocsGroup {
	label: string;
	items: DocsLink[];
}

/** Hand-ordered docs navigation, shared by Starlight and `llms.txt`. */
export const docsSidebar: (DocsLink | DocsGroup)[] = [
	{ label: 'Documentation', link: '/docs/' },
	{
		label: 'Get started',
		items: [
			{ label: 'First installation', link: '/docs/first-install/' },
			{ label: 'Existing systems and rebasing', link: '/docs/rebasing/' },
			{ label: 'Secure Boot', link: '/docs/secure-boot/' },
		],
	},
	{
		label: 'Images',
		items: [
			{ label: 'Choosing an image', link: '/docs/images/' },
			{ label: 'Verification and build transparency', link: '/docs/verification/' },
		],
	},
	{
		label: 'Running uCore',
		items: [
			{ label: 'Containers', link: '/docs/containers/' },
			{ label: 'Services', link: '/docs/services/' },
			{ label: 'SELinux', link: '/docs/selinux/' },
			{ label: 'Distrobox', link: '/docs/distrobox/' },
		],
	},
	{
		label: 'Storage',
		items: [
			{ label: 'ZFS', link: '/docs/zfs/' },
			{ label: 'NAS sharing', link: '/docs/nas/' },
		],
	},
	{ label: 'NVIDIA', link: '/docs/nvidia/' },
	{ label: 'Build your own image', link: '/docs/diy/' },
];
