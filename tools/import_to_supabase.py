#!/usr/bin/env python3
"""Bulk-import Histoglyph CSV files through Supabase RPC.

Environment variables:
  SUPABASE_URL=https://PROJECT.supabase.co
  SUPABASE_SECRET_KEY=sb_secret_...

The secret key is used only by this local script and must never be committed or
placed in browser JavaScript.
"""
from __future__ import annotations
import argparse, csv, json, os, sys, urllib.request, urllib.error
from pathlib import Path


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def chunks(rows, size=200):
    for start in range(0, len(rows), size):
        yield rows[start:start+size]


def rpc(url: str, key: str, function: str, payload: dict):
    request = urllib.request.Request(
        f"{url.rstrip('/')}/rest/v1/rpc/{function}",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else None
    except urllib.error.HTTPError as exc:
        details = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {exc.code}: {details}") from exc


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--places", type=Path, required=True)
    parser.add_argument("--persons", type=Path, required=True)
    parser.add_argument("--batch-size", type=int, default=200)
    args = parser.parse_args()

    url = os.environ.get("SUPABASE_URL", "").strip()
    key = os.environ.get("SUPABASE_SECRET_KEY", "").strip()
    if not url or not key:
        print("Set SUPABASE_URL and SUPABASE_SECRET_KEY first.", file=sys.stderr)
        return 2

    places = read_csv(args.places)
    persons = read_csv(args.persons)
    print(f"Importing {len(places)} places…")
    done = 0
    for part in chunks(places, args.batch_size):
        done += int(rpc(url, key, "admin_import_places", {"p_rows": part}) or 0)
        print(f"  {done}/{len(places)}")

    print(f"Importing {len(persons)} people…")
    done = 0
    for part in chunks(persons, args.batch_size):
        done += int(rpc(url, key, "admin_import_people", {"p_rows": part}) or 0)
        print(f"  {done}/{len(persons)}")

    print("Import complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
