import { SEED_PLACES, SEED_PERSONS } from "../data/seed-data.js";

export const DB_NAME = "historical-person-map-game";
export const DB_VERSION = 1;
export const PLACES_STORE = "places";
export const PERSONS_STORE = "persons";

let databasePromise;

export function makeId(prefix) {
  const randomPart =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${randomPart}`;
}

export function normalizeText(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("en")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ");
}

function preparePlace(place) {
  const now = new Date().toISOString();

  return {
    id: place.id || makeId("place"),
    name: String(place.name ?? "").trim(),
    historicalName: String(place.historicalName ?? "").trim(),
    countryCode: String(place.countryCode ?? "").trim().toUpperCase(),
    country: String(place.country ?? "").trim(),
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    mapX: Number(place.mapX),
    mapY: Number(place.mapY),
    precision: place.precision || "locality",
    verificationStatus:
      place.verificationStatus || "unverified",
    source: String(place.source ?? "").trim(),
    sourceId: String(place.sourceId ?? "").trim(),
    notes: String(place.notes ?? "").trim(),
    searchText: normalizeText(
      [
        place.name,
        place.historicalName,
        place.country,
        place.countryCode,
        place.id
      ].filter(Boolean).join(" ")
    ),
    sourceKey: normalizeText(
      `${place.source ?? ""}:${place.sourceId ?? ""}`
    ),
    createdAt: place.createdAt || now,
    updatedAt: now
  };
}

function preparePerson(person) {
  const now = new Date().toISOString();

  return {
    id: person.id || makeId("person"),
    name: String(person.name ?? "").trim(),
    acceptedAnswers: Array.isArray(person.acceptedAnswers)
      ? person.acceptedAnswers.map(value => String(value).trim()).filter(Boolean)
      : [],
    period: String(person.period ?? "").trim(),
    birthYear: Number(person.birthYear),
    deathYear: Number(person.deathYear),
    birthPlaceId: String(person.birthPlaceId ?? "").trim(),
    deathPlaceId: String(person.deathPlaceId ?? "").trim(),
    difficulty: Number(person.difficulty || 1),
    published: Boolean(person.published),
    searchText: normalizeText(
      [
        person.name,
        ...(person.acceptedAnswers || []),
        person.period,
        person.id
      ].filter(Boolean).join(" ")
    ),
    createdAt: person.createdAt || now,
    updatedAt: now
  };
}

export function openDatabase() {
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.addEventListener("upgradeneeded", () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(PLACES_STORE)) {
        const places = database.createObjectStore(
          PLACES_STORE,
          { keyPath: "id" }
        );

        places.createIndex("searchText", "searchText");
        places.createIndex(
          "verificationStatus",
          "verificationStatus"
        );
        places.createIndex("sourceKey", "sourceKey");
      }

      if (!database.objectStoreNames.contains(PERSONS_STORE)) {
        const persons = database.createObjectStore(
          PERSONS_STORE,
          { keyPath: "id" }
        );

        persons.createIndex("searchText", "searchText");
        persons.createIndex("period", "period");
        persons.createIndex("published", "published");
      }
    });

    request.addEventListener("success", () => {
      resolve(request.result);
    });

    request.addEventListener("error", () => {
      reject(request.error);
    });
  });

  return databasePromise;
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => {
      resolve(request.result);
    });

    request.addEventListener("error", () => {
      reject(request.error);
    });
  });
}

export async function countRecords(storeName) {
  const database = await openDatabase();
  const transaction = database.transaction(
    storeName,
    "readonly"
  );

  return requestToPromise(
    transaction.objectStore(storeName).count()
  );
}

export async function getAllRecords(storeName) {
  const database = await openDatabase();
  const transaction = database.transaction(
    storeName,
    "readonly"
  );

  return requestToPromise(
    transaction.objectStore(storeName).getAll()
  );
}

export async function getRecord(storeName, id) {
  const database = await openDatabase();
  const transaction = database.transaction(
    storeName,
    "readonly"
  );

  return requestToPromise(
    transaction.objectStore(storeName).get(id)
  );
}

export async function putRecord(storeName, record) {
  const database = await openDatabase();
  const transaction = database.transaction(
    storeName,
    "readwrite"
  );

  const prepared =
    storeName === PLACES_STORE
      ? preparePlace(record)
      : preparePerson(record);

  await requestToPromise(
    transaction.objectStore(storeName).put(prepared)
  );

  return prepared;
}

export async function bulkPut(storeName, records) {
  const database = await openDatabase();
  const transaction = database.transaction(
    storeName,
    "readwrite"
  );
  const store = transaction.objectStore(storeName);

  for (const record of records) {
    const prepared =
      storeName === PLACES_STORE
        ? preparePlace(record)
        : preparePerson(record);

    store.put(prepared);
  }

  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("error", () => {
      reject(transaction.error);
    });
    transaction.addEventListener("abort", () => {
      reject(transaction.error);
    });
  });
}

export async function deleteRecord(storeName, id) {
  const database = await openDatabase();
  const transaction = database.transaction(
    storeName,
    "readwrite"
  );

  return requestToPromise(
    transaction.objectStore(storeName).delete(id)
  );
}

export async function clearStore(storeName) {
  const database = await openDatabase();
  const transaction = database.transaction(
    storeName,
    "readwrite"
  );

  return requestToPromise(
    transaction.objectStore(storeName).clear()
  );
}

export async function initializeDatabase() {
  await openDatabase();

  const [placeCount, personCount] = await Promise.all([
    countRecords(PLACES_STORE),
    countRecords(PERSONS_STORE)
  ]);

  if (placeCount === 0) {
    await bulkPut(PLACES_STORE, SEED_PLACES);
  }

  if (personCount === 0) {
    await bulkPut(PERSONS_STORE, SEED_PERSONS);
  }
}

export async function resetDatabase() {
  await clearStore(PERSONS_STORE);
  await clearStore(PLACES_STORE);
  await bulkPut(PLACES_STORE, SEED_PLACES);
  await bulkPut(PERSONS_STORE, SEED_PERSONS);
}
