
# Product Requirements Document: FontLine

## 1. Executive Summary
FontLine is a web-based utility that allows users to convert photos of hand-drawn alphabets into functional, downloadable `.ttf` font files. The app emphasizes the preservation of the user's unique handwriting style while providing granular control over the vertical alignment and sizing of individual glyphs.

## 2. Target Audience
* **Graphic Designers** looking for bespoke typography.
* **Artists** wanting to digitize their signature or handwriting.
* **UX/UI Professionals** creating custom icons or stylized branding elements.

---

## 3. Functional Requirements

### 3.1 Image Upload & Processing
* **Upload Support:** Accept high-resolution JPG, PNG, and HEIC files.
* **Segmentation Engine:** Automatically detect individual characters in a grid or line format.
* **Preprocessing:** Provide basic filters (Contrast, Thresholding, Sharpening/Blurring) to ensure the "faithful reproduction" is clean before vectorization.
* **Vectorization:** Convert raster segments into SVG paths using a tracer (e.g., Potrace-based logic) to maintain the raw texture of the drawing.

### 3.2 The Glyph Editor (Post-Processing)
* **Global Layout Control:**
    * **Vertical Offset:** Adjust the Y-axis position of a glyph relative to the global baseline.
    * **Scaling:** Rescale individual characters to ensure visual weight is consistent (e.g., making a "small" lowercase 'o' match the 'e').
* **Live Preview String:** A real-time text area where users can type custom sentences (including "The quick brown fox" and Norwegian characters like "Blåbærsyltetøy") to see how adjustments affect the "rhythm" of the font.

### 3.3 Manual Creation Tool (The "Missing Glyph" Canvas)
* **Vector Brush:** A pressure-sensitive or fixed-width brush tool to draw missing characters (e.g., if the user forgot the `å`).
* **Eraser/Path Edit:** Basic nodes-and-handles editing for manual correction.
* **Ghosting:** Option to show a similar character (e.g., showing 'a' as a faint background) to help draw the 'å' or 'æ'.

### 3.4 Character Set Support
* **Standard Latin:** A-Z, a-z.
* **Norwegian Specifics:** æ, ø, å (Uppercase and Lowercase).
* **Punctuation:** `! ? . , : ; - _ ( ) " ' @ # &`.

---

## 4. Technical Specifications

### 4.1 Frontend Stack
* **Framework:** React or Vue.js (leveraging your UI/UX expertise).
* **Canvas Library:** `Fabric.js` or `Paper.js` for vector manipulation and manual drawing.
* **Font Generation:** `opentype.js` for converting SVG paths into `.ttf` tables and handling metadata.

### 4.2 Data Flow Table

| Feature | Input | Process | Output |
| :--- | :--- | :--- | :--- |
| **OCR/Segment** | Raster Image | Contour Detection | Individual SVG Blobs |
| **Alignment** | Slider Value | Y-Coordinate Offset | Shifted Glyph Metadata |
| **Export** | Glyph Map | `opentype.js` Table Compiling | Downloadable `.ttf` |

---

## 5. UI/UX Design Goals
* **Minimalist Workspace:** A dark-mode optimized interface that focuses on the glyphs.
* **The "Filmstrip" View:** A bottom-docked gallery of all detected letters for quick navigation.
* **Drag-and-Drop Baseline:** Instead of just sliders, allow users to click and drag letters on a virtual "lined paper" to set their height.

---

## 6. Success Metrics
* **System Latency:** Image processing to vector conversion should take < 5 seconds.
* **Compatibility:** Generated `.ttf` files must be installable on both Windows and macOS and usable in standard design software (Adobe, Figma).



## 7. Open Fontline Persistence (No RLS)

### 1. Feature Overview
This feature handles the storage of font metadata and binary files using a "Public-First" approach. By disabling RLS, the app prioritizes speed and ease of sharing, allowing any client to write to and read from the `fontline` schema and the Supabase storage bucket.

### 2. User Stories
* **As a user**, I want to save my font adjustments instantly without needing to manage a complex login session.
* **As a user**, I want to share a URL of my custom-positioned font with others immediately after export.
* **As a developer**, I want to perform direct `upserts` to the database from the frontend with zero configuration hurdles.

---

### 3. Functional Requirements

#### 3.1 Unrestricted Metadata Storage
* **Open Schema:** The `fonts` and `glyph_configs` tables must have RLS disabled, allowing any `anon` key to perform CRUD operations.
* **Fontline Schema Logic:** * Store vertical offsets as integers.
    * Store scaling factors as floats.
    * Store "Faithful" SVG paths as text strings.
* **The "Auto-Save" Trigger:** Every time a user finishes dragging a letter on the vertical axis (onMouseUp), the app performs a direct `upsert` to the `glyph_configs` table.

#### 3.2 Public Asset Bucket (`font-assets`)
* **Bucket Policy:** Set to **Public**. All uploaded `.ttf` files are accessible via a direct URL without authentication tokens.
* **Naming Convention:** Since there is no RLS/User isolation, the app should generate a unique `font_id` (UUID) to prevent users from accidentally overwriting each other’s files.
* **Direct Pathing:** `https://[project-id].supabase.co/storage/v1/object/public/font-assets/[font_id].ttf`.

---

### 4. Technical Schema (No RLS)

| Object | Requirement | Configuration |
| :--- | :--- | :--- |
| **`fonts` Table** | ID, Name, Global Settings | **RLS Disabled.** All permissions granted to `anon`. |
| **`glyph_configs` Table** | Char, Offset, Scale, SVG Path | **RLS Disabled.** All permissions granted to `anon`. |
| **`font-assets` Bucket** | `.ttf` Storage | **Public Access.** Read/Write enabled for anonymous users. |

---

### 5. Implementation Workflow

1.  **Initialization:** When a user starts a new project, a new row is created in `fonts`. The app stores this `font_id` in `localStorage`.
2.  **The Fontline Update:**
    * User adjusts vertical positioning for "æ".
    * Frontend sends: `supabase.from('glyph_configs').upsert({ font_id: id, char_code: 'æ', vertical_offset: 12 })`.
3.  **The Compilation & Export:**
    * Frontend gathers all `glyph_configs` rows for that `font_id`.
    * `opentype.js` builds the font.
    * The `.ttf` blob is sent to the `font-assets` bucket using the `font_id` as the filename.

---

### 6. Critical Constraints & Risks
* **Data Collision:** Without RLS, anyone with the `anon` key could technically delete or modify rows. To mitigate this, the UI must strictly use unique UUIDs for every new font session.
* **Storage Growth:** Since there are no user quotas, the bucket will grow linearly with every export. A periodic cleanup script (Cron) may be required to delete fonts older than 30 days.
* **Faithful Reproduction:** The `svg_path` must be stored as high-precision path data to ensure the "Faithful" look is maintained across different browser sessions.

---

### 7. UI Requirements
* **Direct Link Generator:** A "Copy Font URL" button that provides the public Supabase storage link for use in CSS.
* **Local Session Recovery:** If the user refreshes, the app checks `localStorage` for the last used `font_id` and pulls the "fontline" data back from the table.

