# Histoglyph V22 — changed files

For an existing live Histoglyph V21 installation:

1. Run `database/009_v22_short_answers_retry_filters.sql` once in Supabase SQL Editor.
2. Deploy `play.html`, `styles.css`, `js/game-supabase.js`, `admin.html`, `admin.css`, and `js/admin-supabase.js`.
3. Keep your existing `supabase-config.js`.

`database/003_functions.sql` and `database/histoglyph_supabase_setup.sql` are included so the repository's setup files stay synchronized for future fresh installations. They do not need to be run on the already-live database if migration 009 has been run.

No map/projection file is changed in V22.
