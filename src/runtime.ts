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
		version: "1.4.0",
		capabilities: ["content:read"],

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
					// ctx.content.list() returns a PaginatedResult shaped as { items },
					// and core's mapOrderField only accepts camelCase order keys
					// (publishedAt, not published_at — the latter throws and was being
					// silently swallowed by the .catch, so posts never appeared).
					const [postsResult, pagesResult] = await Promise.all([
						content.list("posts", { orderBy: { publishedAt: "desc" }, limit: 200 }).catch(() => ({ items: [] })),
						content.list("pages", { orderBy: { title: "asc" }, limit: 100 }).catch(() => ({ items: [] })),
					]);
					return {
						entries: [
							...(postsResult.items ?? []).map((e: any) => ({
								collection: "posts", slug: e.id,
								title: String(e.data?.title ?? "Untitled"),
								imageCount: parseImages(e.data?.images).length,
							})),
							...(pagesResult.items ?? []).map((e: any) => ({
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
