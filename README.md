# Histoglyph V21 — Person portraits

This version adds portrait support without changing the working map projection.

## Existing Supabase project: required one-time setup

1. In Supabase, open **Storage** and create a bucket named exactly `person-images`.
2. Make the bucket **Public**.
3. Recommended bucket restrictions:
   - Allowed MIME types: `image/webp`, `image/jpeg`, `image/png`
   - Maximum file size: 20 MB
4. Open **SQL Editor** and run:
   - `database/008_v21_person_portraits.sql`
5. Publish the changed frontend files.

Do not rerun the full setup SQL on an existing production project unless you deliberately want to reapply the complete installation.

## How portraits work

- The admin page accepts JPEG, PNG and WebP source images.
- The browser resizes large images to max 1000 px on the longest side.
- The upload is converted to WebP at approximately 84% quality.
- Storage paths use the person's UUID and a random UUID filename, not the person's name.
- `get_life_map_round` does not return image information.
- The portrait path and attribution are only returned by the completed-round result RPC.
- The game then obtains the public Storage URL and displays the portrait beside the answer.

## New person fields

- `image_path`
- `image_credit`
- `image_source_url`
- `image_license`

## Files changed from V20

- `admin.html`
- `admin.css`
- `play.html`
- `styles.css`
- `js/admin-supabase.js`
- `js/game-supabase.js`
- `database/001_schema.sql`
- `database/002_security.sql`
- `database/003_functions.sql`
- `database/schema.sql`
- `database/histoglyph_supabase_setup.sql`
- `templates/persons-template.csv`

New migration:
- `database/008_v21_person_portraits.sql`

## Important

Keep your existing real `supabase-config.js` when copying files into the live Git repository.
