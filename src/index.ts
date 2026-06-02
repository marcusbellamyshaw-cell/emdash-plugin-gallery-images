import type { PluginDescriptor } from "emdash";

export interface GalleryImage {
	mediaId: string;
	caption: string;
	alt: string;
}

export function galleryImagesPlugin(): PluginDescriptor {
	return {
		id: "ebt-gallery-images",
		version: "1.2.0",
		entrypoint: "ebt-plugin-gallery-images/runtime",
		adminEntry: "ebt-plugin-gallery-images/admin",
		adminPages: [
			{ path: "/", label: "Photo Gallery Manager", icon: "image" },
		],
		options: {},
		capabilities: ["content:read", "content:write"],
	};
}
