import type { PluginDescriptor } from "emdash";

export interface GalleryImage {
	mediaId: string;
	caption: string;
	alt: string;
}

export function galleryImagesPlugin(): PluginDescriptor {
	return {
		id: "ebt-gallery-images",
		version: "1.4.0",
		entrypoint: "emdash-plugin-gallery-images/runtime",
		adminEntry: "emdash-plugin-gallery-images/admin",
		adminPages: [
			{ path: "/", label: "Photo Gallery Manager", icon: "image" },
		],
		options: {},
		// Only content.list() (read) is ever called; the gallery JSON is saved by
		// the host content editor, not by this plugin, so content:write isn't used.
		capabilities: ["content:read"],
	};
}
