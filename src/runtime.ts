import { definePlugin } from "emdash";
import type { GalleryImage } from "./index.ts";

function parseImages(raw: unknown): GalleryImage[] {
	if (!raw) return [];
	if (Array.isArray(raw)) return raw as GalleryImage[];
	if (typeof raw === "string") {
		try { return JSON.parse(raw) as GalleryImage[]; }
		catch { return []; }
	}
	return [];
}

function sanitizeImages(images: unknown[]): GalleryImage[] {
	return images
		.filter((img): img is Record<string, unknown> => !!img && typeof img === "object")
		.map((img) => ({
			mediaId: String(img.mediaId ?? ""),
			caption: String(img.caption ?? ""),
			alt: String(img.alt ?? ""),
		}))
		.filter((img) => img.mediaId.length > 0);
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

export function createPlugin() {
	return definePlugin({
		id: "ebt-gallery-images",
		version: "1.1.0",
		capabilities: ["content:read", "content:write"],

		admin: {
			fieldWidgets: [
				{
					name: "gallery-uploader",
					label: "Gallery Photos",
					fieldTypes: ["json"],
				},
			],
		},

		routes: {
			entries: {
				handler: async (ctx: any) => {
					const content = ctx.content;
					if (!content) return json({ error: "content:read not available" }, 503);
					const [postsResult, pagesResult] = await Promise.all([
						content.list("posts", { orderBy: { published_at: "desc" }, limit: 200 }).catch(() => ({ entries: [] })),
						content.list("pages", { orderBy: { title: "asc" }, limit: 100 }).catch(() => ({ entries: [] })),
					]);
					return {
						entries: [
							...(postsResult.entries ?? []).map((e: any) => ({
								collection: "posts", slug: e.id,
								title: String(e.data?.title ?? "Untitled"),
								imageCount: parseImages(e.data?.images).length,
							})),
							...(pagesResult.entries ?? []).map((e: any) => ({
								collection: "pages", slug: e.id,
								title: String(e.data?.title ?? "Untitled"),
								imageCount: parseImages(e.data?.images).length,
							})),
						],
					};
				},
			},
		},
	});
}

export default createPlugin;
