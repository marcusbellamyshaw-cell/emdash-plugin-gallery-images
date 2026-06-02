// emdash 0.16.x / kumo 2.x
import { useState, useEffect, useRef } from "react";
import { apiFetch, MediaPickerModal, uploadMedia } from "@emdash-cms/admin";
import type { MediaItem } from "@emdash-cms/admin";

const PLUGIN_API = "/_emdash/api/plugins/ebt-gallery-images";

function extractErrorMessage(err: Record<string, unknown>, status: number): string {
	const e = err?.error;
	if (typeof e === "string") return e;
	if (e && typeof e === "object") {
		const nested = (e as Record<string, unknown>).message ?? (e as Record<string, unknown>).code;
		if (typeof nested === "string") return nested;
		return JSON.stringify(e);
	}
	const msg = err?.message;
	if (typeof msg === "string") return msg;
	return `Request failed (${status})`;
}

async function apiGet<T>(route: string): Promise<T> {
	const res = await apiFetch(`${PLUGIN_API}/${route}`);
	if (!res.ok) {
		const err = await res.json().catch(() => ({})) as Record<string, unknown>;
		throw new Error(extractErrorMessage(err, res.status));
	}
	return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface GalleryImage {
	mediaId: string;
	caption: string;
	alt: string;
}

interface EntryItem {
	collection: "posts" | "pages";
	slug: string;
	title: string;
	imageCount: number;
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function thumbUrl(mediaId: string, w = 200): string {
	return `/cdn-cgi/image/width=${w},format=webp,quality=80/_emdash/api/media/file/${encodeURIComponent(mediaId)}`;
}

function parseImages(v: unknown): GalleryImage[] {
	if (!v) return [];
	if (Array.isArray(v)) return v as GalleryImage[];
	if (typeof v === "string") {
		try { return JSON.parse(v) as GalleryImage[]; } catch { return []; }
	}
	return [];
}

// ── Gallery Uploader Field Widget ─────────────────────────────────────────────
// Rendered directly inside the post/page editor for the "Gallery Images" field.

export function GalleryUploaderField({
	value,
	onChange,
	minimal,
}: {
	value: unknown;
	onChange: (v: GalleryImage[]) => void;
	label?: string;
	id?: string;
	required?: boolean;
	options?: unknown;
	minimal?: boolean;
}) {
	const [images, setImages] = useState<GalleryImage[]>(() => parseImages(value));
	const [uploading, setUploading] = useState(false);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [pickerOpen, setPickerOpen] = useState(false);
	const fileRef = useRef<HTMLInputElement>(null);

	function update(next: GalleryImage[]) {
		setImages(next);
		onChange(next);
	}

	async function handleFiles(files: FileList | null) {
		if (!files || files.length === 0) return;
		setError(null);
		setUploading(true);
		setUploadProgress(0);
		const added: GalleryImage[] = [];
		const total = files.length;
		let done = 0;

		for (const file of Array.from(files)) {
			try {
				const mediaItem = await uploadMedia(file);
				const storageKey = mediaItem.storageKey;
				if (!storageKey) throw new Error("Upload response missing storageKey");
				added.push({
					mediaId: storageKey,
					caption: mediaItem.caption ?? "",
					alt: mediaItem.alt ?? "",
				});
			} catch (e: unknown) {
				console.error("[gallery-uploader] upload error:", e);
				const msg = e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
				setError(`"${file.name}": ${msg || "upload failed"}`);
			}
			done++;
			setUploadProgress(Math.round((done / total) * 100));
		}

		if (fileRef.current) fileRef.current.value = "";
		if (added.length > 0) update([...images, ...added]);
		setUploading(false);
	}

	function handlePickerSelect(item: MediaItem) {
		if (!item.storageKey) return;
		update([...images, {
			mediaId: item.storageKey,
			caption: item.caption ?? "",
			alt: item.alt ?? "",
		}]);
		setPickerOpen(false);
	}

	function remove(i: number) {
		update(images.filter((_, idx) => idx !== i));
	}

	function move(i: number, dir: -1 | 1) {
		const j = i + dir;
		if (j < 0 || j >= images.length) return;
		const next = [...images];
		[next[i], next[j]] = [next[j], next[i]];
		update(next);
	}

	function setField(i: number, field: "caption" | "alt", v: string) {
		update(images.map((img, idx) => idx === i ? { ...img, [field]: v } : img));
	}

	if (minimal) {
		return (
			<span style={{ fontSize: 13, color: "#6e6a5e" }}>
				{images.length} {images.length === 1 ? "photo" : "photos"}
			</span>
		);
	}

	return (
		<div style={fw.wrap}>
			{/* Upload / picker toolbar */}
			<div style={fw.toolbar}>
				<button
					type="button"
					disabled={uploading}
					onClick={() => fileRef.current?.click()}
					style={uploading ? { ...fw.addBtn, opacity: 0.6 } : fw.addBtn}
				>
					{uploading ? `Uploading… ${uploadProgress}%` : "+ Upload photos"}
				</button>
				<button
					type="button"
					disabled={uploading}
					onClick={() => setPickerOpen(true)}
					style={uploading ? { ...fw.libraryBtn, opacity: 0.6 } : fw.libraryBtn}
				>
					Choose from library
				</button>
				<input
					ref={fileRef}
					type="file"
					multiple
					accept="image/*"
					style={{ display: "none" }}
					onChange={(e) => handleFiles(e.target.files)}
				/>
				{images.length > 0 && (
					<span style={fw.count}>{images.length} {images.length === 1 ? "photo" : "photos"}</span>
				)}
			</div>

			{error && (
				<div style={fw.error}>
					{error}
					<button type="button" style={fw.dismissBtn} onClick={() => setError(null)}>×</button>
				</div>
			)}

			{images.length === 0 && !uploading && (
				<div style={fw.empty}>No photos added yet. Upload new photos or choose from the media library.</div>
			)}

			{images.length > 0 && (
				<div style={fw.grid}>
					{images.map((img, i) => (
						<div key={`${img.mediaId}-${i}`} style={fw.card}>
							<div style={fw.thumbWrap}>
								<img
									src={thumbUrl(img.mediaId)}
									alt={img.alt || ""}
									loading="lazy"
									decoding="async"
									style={fw.thumb}
								/>
								<button
									type="button"
									style={fw.removeBtn}
									onClick={() => remove(i)}
									title="Remove photo"
								>×</button>
							</div>
							<input
								type="text"
								value={img.caption}
								placeholder="Caption…"
								onChange={(e) => setField(i, "caption", e.target.value)}
								style={fw.input}
								aria-label={`Caption for photo ${i + 1}`}
							/>
							<input
								type="text"
								value={img.alt}
								placeholder="Alt text…"
								onChange={(e) => setField(i, "alt", e.target.value)}
								style={fw.input}
								aria-label={`Alt text for photo ${i + 1}`}
							/>
							<div style={fw.reorderRow}>
								<button type="button" style={fw.reorderBtn} onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
								<span style={fw.reorderLabel}>{i + 1}/{images.length}</span>
								<button type="button" style={fw.reorderBtn} onClick={() => move(i, 1)} disabled={i === images.length - 1}>↓</button>
							</div>
						</div>
					))}
				</div>
			)}

			<MediaPickerModal
				open={pickerOpen}
				onOpenChange={setPickerOpen}
				onSelect={handlePickerSelect}
				localOnly
				mimeTypeFilters={["image/"]}
				title="Choose from Library"
			/>
		</div>
	);
}

// ── Admin management page (fallback for bulk operations) ──────────────────────

function EntryList({ onSelect }: { onSelect: (collection: string, slug: string) => void }) {
	const [entries, setEntries] = useState<EntryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState<"all" | "posts" | "pages">("all");

	useEffect(() => {
		apiGet<{ entries: EntryItem[] }>("entries")
			.then((d) => setEntries(d?.entries ?? []))
			.catch(() => {})
			.finally(() => setLoading(false));
	}, []);

	if (loading) return <div style={s.center}>Loading…</div>;

	const visible = entries.filter(e => filter === "all" || e.collection === filter);

	return (
		<div style={s.page}>
			<h1 style={s.h1}>Photo Gallery Manager</h1>
			<p style={s.muted}>
				Galleries are managed directly in the post/page editor via the "Gallery Images" field.
				Use this page to see an overview of all photo galleries across your content.
			</p>
			<div style={s.filterRow}>
				{(["all", "posts", "pages"] as const).map(f => (
					<button key={f} style={filter === f ? { ...s.filterBtn, ...s.filterBtnActive } : s.filterBtn} onClick={() => setFilter(f)}>
						{f === "all" ? "All" : f === "posts" ? "Posts" : "Pages"}
					</button>
				))}
			</div>
			{visible.length === 0 ? (
				<div style={s.empty}>No {filter === "all" ? "content" : filter} found.</div>
			) : (
				<div>
					{visible.map(e => (
						<div key={`${e.collection}:${e.slug}`} style={s.listRow}>
							<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
								<span style={e.collection === "posts" ? s.badgePost : s.badgePage}>
									{e.collection === "posts" ? "POST" : "PAGE"}
								</span>
								<div>
									<div style={s.listTitle}>{e.title}</div>
									<div style={s.listMeta}>{e.imageCount > 0 ? `${e.imageCount} photo${e.imageCount !== 1 ? "s" : ""}` : "No photos"}</div>
								</div>
							</div>
							<a
								href={`/_emdash/admin/content/${e.collection}/${encodeURIComponent(e.slug)}`}
								style={s.btnSecondary}
							>
								Edit post →
							</a>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

export function GalleryImagesPage() {
	return <EntryList onSelect={() => {}} />;
}

// ── Required exports ──────────────────────────────────────────────────────────

export const pages = {
	"/": GalleryImagesPage,
};

export const fields = {
	"gallery-uploader": GalleryUploaderField,
};

// ── Field widget styles ───────────────────────────────────────────────────────

const fw: Record<string, React.CSSProperties> = {
	wrap: { fontFamily: "Inter, system-ui, sans-serif" },
	toolbar: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" },
	addBtn: { background: "#c8232c", color: "#fff", border: "none", padding: "8px 16px", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" },
	libraryBtn: { background: "transparent", color: "#0d0c0a", border: "1.5px solid #d6d1be", padding: "8px 16px", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" },
	count: { fontSize: 12, color: "#6e6a5e" },
	error: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff0f0", border: "1px solid #fca5a5", color: "#c8232c", padding: "8px 12px", fontSize: 12, marginBottom: 12 },
	dismissBtn: { background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#c8232c", padding: "0 2px" },
	empty: { padding: "20px 0", fontSize: 13, color: "#9ca3af", fontStyle: "italic" },
	grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 },
	card: { border: "1px solid #e5e7eb", background: "#fff", display: "flex", flexDirection: "column", gap: 4 },
	thumbWrap: { position: "relative", aspectRatio: "4/3", background: "#f0ede2", overflow: "hidden" },
	thumb: { width: "100%", height: "100%", objectFit: "cover", display: "block" },
	removeBtn: { position: "absolute", top: 4, right: 4, width: 22, height: 22, background: "rgba(13,12,10,0.7)", color: "#fff", border: "none", borderRadius: "50%", fontSize: 14, lineHeight: "1", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" },
	input: { border: "none", borderBottom: "1px solid #e5e7eb", padding: "4px 6px", fontSize: 11, fontFamily: "inherit", color: "#0d0c0a", outline: "none", width: "100%", boxSizing: "border-box" },
	reorderRow: { display: "flex", alignItems: "center", gap: 4, padding: "2px 6px 4px" },
	reorderBtn: { background: "#f0ede2", border: "1px solid #d6d1be", padding: "1px 8px", fontSize: 12, cursor: "pointer", color: "#0d0c0a" },
	reorderLabel: { flex: 1, textAlign: "center", fontSize: 10, color: "#9ca3af" },
};

// ── Admin page styles ─────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
	page: { maxWidth: 900, margin: "0 auto", padding: "28px 24px 80px", fontFamily: "Inter, system-ui, sans-serif" },
	h1: { fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 4px", color: "#0d0c0a" },
	muted: { fontSize: 13, color: "#6e6a5e", margin: "0 0 20px", lineHeight: 1.5 },
	center: { display: "flex", alignItems: "center", justifyContent: "center", padding: 64, fontSize: 14, color: "#6e6a5e" },
	empty: { padding: "40px 0", textAlign: "center", fontSize: 14, color: "#6e6a5e" },
	filterRow: { display: "flex", gap: 8, marginBottom: 20 },
	filterBtn: { background: "transparent", border: "1.5px solid #d6d1be", padding: "6px 14px", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", color: "#6e6a5e" },
	filterBtnActive: { background: "#0d0c0a", color: "#fbfaf6", borderColor: "#0d0c0a" },
	badgePost: { fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", background: "#c8232c", color: "#fff", padding: "2px 7px", flexShrink: 0 },
	badgePage: { fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", background: "#0d0c0a", color: "#fbfaf6", padding: "2px 7px", flexShrink: 0 },
	listRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #f0ede2", gap: 16 },
	listTitle: { fontSize: 14, fontWeight: 700, color: "#0d0c0a", marginBottom: 2 },
	listMeta: { fontSize: 12, color: "#6e6a5e" },
	btnSecondary: { color: "#6e6a5e", border: "1px solid #d6d1be", padding: "6px 12px", fontSize: 12, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap" },
};
