import { describe, expect, it, vi } from "vitest";
import createPlugin from "../src/runtime.js";

const plugin = createPlugin();

function makeContentCtx(posts: unknown[] = [], pages: unknown[] = []) {
	const list = vi.fn(async (collection: string) => {
		if (collection === "posts") return { items: posts };
		if (collection === "pages") return { items: pages };
		return { items: [] };
	});
	return { content: { list } };
}

// The route handler's declared return type is `unknown` (the shared
// SandboxedPlugin route interface), so tests assert on the actual runtime
// shape via this cast rather than fighting the type at every call site.
async function callEntries(ctx: unknown) {
	return (await plugin.routes.entries.handler(ctx as never)) as any;
}

describe("entries route", () => {
	it("returns 503 when content:read is unavailable", async () => {
		const res = await callEntries({ content: undefined });
		expect(res.status).toBe(503);
	});

	it("counts images from an array-valued images field", async () => {
		const ctx = makeContentCtx([
			{ id: "p1", data: { title: "Post 1", images: [{ mediaId: "a" }, { mediaId: "b" }] } },
		]);
		const result = await callEntries(ctx);

		expect(result.entries).toEqual([
			{ collection: "posts", slug: "p1", title: "Post 1", imageCount: 2 },
		]);
	});

	it("counts images from a JSON-string-valued images field", async () => {
		const ctx = makeContentCtx([
			{ id: "p1", data: { title: "Post 1", images: JSON.stringify([{ mediaId: "a" }]) } },
		]);
		const result = await callEntries(ctx);

		expect(result.entries[0].imageCount).toBe(1);
	});

	it("treats malformed JSON in the images field as zero images instead of throwing", async () => {
		const ctx = makeContentCtx([
			{ id: "p1", data: { title: "Post 1", images: "{not json" } },
		]);
		const result = await callEntries(ctx);

		expect(result.entries[0].imageCount).toBe(0);
	});

	it("treats a missing images field as zero images", async () => {
		const ctx = makeContentCtx([{ id: "p1", data: { title: "Post 1" } }]);
		const result = await callEntries(ctx);

		expect(result.entries[0].imageCount).toBe(0);
	});

	it("falls back to 'Untitled' when the entry has no title", async () => {
		const ctx = makeContentCtx([{ id: "p1", data: {} }]);
		const result = await callEntries(ctx);

		expect(result.entries[0].title).toBe("Untitled");
	});

	it("combines posts and pages into one entries list, tagged by collection", async () => {
		const ctx = makeContentCtx(
			[{ id: "p1", data: { title: "Post" } }],
			[{ id: "pg1", data: { title: "Page" } }],
		);
		const result = await callEntries(ctx);

		expect(result.entries.map((e: { collection: string }) => e.collection)).toEqual(["posts", "pages"]);
	});

	it("does not fail the whole request when content.list() rejects for one collection", async () => {
		const list = vi.fn(async (collection: string) => {
			if (collection === "posts") throw new Error("boom");
			return { items: [{ id: "pg1", data: { title: "Page" } }] };
		});
		const result = await callEntries({ content: { list } });

		expect(result.entries).toEqual([
			{ collection: "pages", slug: "pg1", title: "Page", imageCount: 0 },
		]);
	});
});
