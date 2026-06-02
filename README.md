# ebt-plugin-gallery-images

A photo gallery field plugin for [Emdash CMS](https://emdashcms.com). Adds a `gallery-uploader` field widget to the content editor that lets editors upload multiple photos, reorder them, and add captions and alt text — all stored as a JSON array on the content entry.

## What it does

- Adds a **Gallery Images** field widget to the Emdash admin content editor
- Editors can **upload new photos** directly from their computer (uploaded to your R2 media library)
- Editors can **choose existing photos** from the Emdash media library (multi-select)
- Drag-to-reorder, per-photo captions, and alt text
- Includes a **Photo Gallery Manager** admin page showing image counts across all posts and pages

## Installation

```sh
pnpm add ebt-plugin-gallery-images
```

```ts
// astro.config.mjs
import { defineConfig } from "astro/config";
import emdash from "emdash";
import { galleryImagesPlugin } from "ebt-plugin-gallery-images";

export default defineConfig({
  integrations: [
    emdash({
      plugins: [galleryImagesPlugin()],
    }),
  ],
});
```

## Adding the field to a collection

In your seed file or Content Type Builder, add a `json` field and set the widget to `gallery-uploader`:

```json
{
  "name": "images",
  "label": "Gallery Images",
  "type": "json",
  "options": {
    "widget": "gallery-uploader"
  }
}
```

## Data format

The field stores a JSON array of objects:

```ts
interface GalleryImage {
  mediaId: string;   // R2 storage key
  caption: string;
  alt: string;
}
```

## Rendering on the frontend

```astro
---
const images = entry.data.images ?? [];
---

{images.map((img) => (
  <figure>
    <img
      src={`/cdn-cgi/image/width=1200,format=webp/_emdash/api/media/file/${img.mediaId}`}
      alt={img.alt}
    />
    {img.caption && <figcaption>{img.caption}</figcaption>}
  </figure>
))}
```

## Requirements

- Emdash `^0.16.0`
- Cloudflare R2 media storage (the plugin uploads via `POST /_emdash/api/media` — presigned URL upload is not used)

## License

MIT
