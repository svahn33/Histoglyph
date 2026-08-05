# Histoglyph V17 — Supabase migration

This version keeps the corrected local Robinson-projection map from V16 and moves the shared game data to Supabase/PostgreSQL.

## What is included

- Central tables for places, people, accepted answers, tags and collections
- Row Level Security
- Supabase Auth login for the Data manager
- Server-side pagination and search in the Data manager
- Public game RPC functions that do not expose the person name before the round is completed
- Server-validated answers, time and points
- CSV import in the Data manager
- A local Python bulk importer for thousands of rows
- Demo migration for the people already present in V16

## Setup — quickest route

1. Open **Supabase → SQL Editor**.
2. Run `database/histoglyph_supabase_setup.sql`.
3. In **Authentication → Users**, create your administrator with email and password.
4. Edit `database/006_promote_admin.sql`, replace the example email, and run it.
5. Open **Project Settings → API** and copy:
   - Project URL
   - Publishable key
6. Paste them into `supabase-config.js`.
7. Run the site through Live Server and open `setup-check.html`.
8. Sign in at `admin.html`.

## Never expose the secret key

The browser only uses the publishable key. Do not put `sb_secret_...` or a legacy `service_role` key in `supabase-config.js`, GitHub or Cloudflare Pages.

## Large import

For 5,000 people, use the local importer:

```bash
export SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
export SUPABASE_SECRET_KEY="sb_secret_..."
python3 tools/import_to_supabase.py   --places starter-data/histoglyph-20-people-places.csv   --persons starter-data/histoglyph-20-historical-persons.csv
```

The secret key remains an environment variable on your computer. Remove it from the terminal session afterward.

## Current limitation

The game database and answers are protected behind RPC functions, but this is still a test-stage architecture. Before a high-traffic launch, add rate limiting and abuse protection in front of the public RPC calls.
