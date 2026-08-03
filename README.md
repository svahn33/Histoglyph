# Historical Person Map Game — Version 4

This version implements a scalable data workflow for thousands of historical
people.

## What has been added

- A separate **place registry**
- A separate **people registry**
- Browser database using **IndexedDB**
- A full `admin.html` data manager
- Search and reuse of existing places
- Manual map verification by clicking or dragging a marker
- Verification statuses and a review queue
- Duplicate-place warnings and reuse of matching places during import
- Automatic validation of latitude, longitude and map positions
- CSV import and export with round-trip-compatible templates
- JSON backup and restore
- PostgreSQL / Supabase schema in `database/schema.sql`
- The game reads stored place IDs rather than duplicating coordinates for every person

## The key principle

A person does not store their own map point.

Instead:

```text
Person
  ├── birth_place_id ──→ Places table
  └── death_place_id ──→ Places table
```

A place such as Stockholm is verified once. Every person linked to Stockholm
then uses the same coordinate and map position.

## Exact marker placement

Each place stores both geographic coordinates and an exact position on this
specific image:

```text
latitude / longitude = the real geographic coordinate
map_x / map_y         = exact percentage position on the PNG
```

When a new place is imported, the app creates an automatic Robinson-projection
suggestion. Open the place in the data manager and then click or drag the blue
marker to the exact position. Change the status to `manually_verified` and save.

The game always prefers the saved `map_x` and `map_y`, which means it does not
depend on a projection formula after the place has been verified.

## Start the project

1. Extract the ZIP file.
2. Open the folder in Visual Studio Code.
3. Install the **Live Server** extension.
4. Right-click `index.html`.
5. Select **Open with Live Server**.

Do not open the files only through `file://`, because ES modules and IndexedDB
work more reliably through a local development server.

## Pages

- `index.html` — the game
- `admin.html` — places, people, verification and imports

## Recommended workflow for thousands of records

1. Import unique places using `templates/places-template.csv`.
2. Review places whose status is `automatically_matched`.
3. Drag or click the marker to confirm the exact map position.
4. Mark the place as `manually_verified`.
5. Import people using `templates/persons-template.csv`.
6. Link each person to existing birth and death place IDs.
7. Publish only people whose places have been reviewed.

## Project structure

```text
historical-person-map-game-v4/
├── index.html
├── admin.html
├── styles.css
├── admin.css
├── README.md
├── assets/
│   └── world-map.png
├── data/
│   └── seed-data.js
├── js/
│   ├── admin.js
│   ├── db.js
│   ├── game.js
│   └── map.js
├── templates/
│   ├── places-template.csv
│   └── persons-template.csv
└── database/
    └── schema.sql
```

## Current database

The prototype uses IndexedDB inside the browser. This is suitable for testing
several thousand records locally, but it is not a shared online database.

For a published site with multiple administrators or users, create PostgreSQL
tables using `database/schema.sql`, for example in Supabase, and replace the
IndexedDB functions in `js/db.js` with API calls.

## External place search

This static prototype does not automatically query GeoNames, Nominatim or
another geocoding service. Those services require API rules, rate limiting,
credentials or a backend proxy.

The implemented workflow still makes large imports practical:

- import latitude and longitude from your source
- receive an automatic map suggestion
- verify each unique place once
- reuse that place for unlimited people

## Map image

Image dimensions: 1920 × 970 pixels.

## Large local datasets

The place and person browsers display at most 300 matching records at once.
Use the search field to locate a specific record. This prevents the admin page
from creating thousands of buttons in the DOM when the database becomes large.
