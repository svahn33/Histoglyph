(function () {
"use strict";

/* data/seed-data.js */
const SEED_PLACES = [
  {
    "id": "place-ajaccio-fr",
    "name": "Ajaccio",
    "country": "France",
    "latitude": 41.9192,
    "longitude": 8.7386,
    "mapX": 49.36388,
    "mapY": 24.03353,
    "precision": "locality",
    "verificationStatus": "manually_verified",
    "source": "Seed data",
    "sourceId": "",
    "notes": ""
  },
  {
    "id": "place-longwood-sh",
    "name": "Longwood",
    "country": "Saint Helena",
    "latitude": -15.9507,
    "longitude": -5.6947,
    "mapX": 45.34719,
    "mapY": 59.88943,
    "precision": "locality",
    "verificationStatus": "manually_verified",
    "source": "Seed data",
    "sourceId": "",
    "notes": ""
  },
  {
    "id": "place-ulm-de",
    "name": "Ulm",
    "country": "Germany",
    "latitude": 48.4011,
    "longitude": 9.9876,
    "mapX": 49.69248,
    "mapY": 20.08733,
    "precision": "locality",
    "verificationStatus": "manually_verified",
    "source": "Seed data",
    "sourceId": "",
    "notes": ""
  },
  {
    "id": "place-princeton-us",
    "name": "Princeton",
    "country": "United States",
    "latitude": 40.3573,
    "longitude": -74.6672,
    "mapX": 28.04852,
    "mapY": 24.99098,
    "precision": "locality",
    "verificationStatus": "manually_verified",
    "source": "Seed data",
    "sourceId": "",
    "notes": ""
  },
  {
    "id": "place-vinci-it",
    "name": "Vinci",
    "country": "Italy",
    "latitude": 43.7874,
    "longitude": 10.926,
    "mapX": 49.91879,
    "mapY": 22.88832,
    "precision": "locality",
    "verificationStatus": "manually_verified",
    "source": "Seed data",
    "sourceId": "",
    "notes": ""
  },
  {
    "id": "place-amboise-fr",
    "name": "Amboise",
    "country": "France",
    "latitude": 47.413,
    "longitude": 0.9827,
    "mapX": 47.48296,
    "mapY": 20.68513,
    "precision": "locality",
    "verificationStatus": "manually_verified",
    "source": "Seed data",
    "sourceId": "",
    "notes": ""
  },
  {
    "id": "place-warsaw-pl",
    "name": "Warsaw",
    "country": "Poland",
    "latitude": 52.2297,
    "longitude": 21.0122,
    "mapX": 52.31372,
    "mapY": 17.79779,
    "precision": "locality",
    "verificationStatus": "manually_verified",
    "source": "Seed data",
    "sourceId": "",
    "notes": ""
  },
  {
    "id": "place-passy-fr",
    "name": "Passy",
    "country": "France",
    "latitude": 45.9237,
    "longitude": 6.6877,
    "mapX": 48.87087,
    "mapY": 21.58616,
    "precision": "locality",
    "verificationStatus": "manually_verified",
    "source": "Seed data",
    "sourceId": "",
    "notes": ""
  },
  {
    "id": "place-pella-gr",
    "name": "Pella, Macedon",
    "country": "Greece",
    "latitude": 40.7617,
    "longitude": 22.5266,
    "mapX": 52.87469,
    "mapY": 24.74308,
    "precision": "archaeological_site",
    "verificationStatus": "manually_verified",
    "source": "Seed data",
    "sourceId": "",
    "notes": ""
  },
  {
    "id": "place-babylon-iq",
    "name": "Babylon",
    "country": "Iraq",
    "latitude": 32.5364,
    "longitude": 44.4209,
    "mapX": 58.76471,
    "mapY": 29.82743,
    "precision": "archaeological_site",
    "verificationStatus": "manually_verified",
    "source": "Seed data",
    "sourceId": "",
    "notes": ""
  },
  {
    "id": "place-rosario-ar",
    "name": "Rosario",
    "country": "Argentina",
    "latitude": -32.9442,
    "longitude": -60.6505,
    "mapX": 31.02999,
    "mapY": 70.4254,
    "precision": "locality",
    "verificationStatus": "manually_verified",
    "source": "Seed data",
    "sourceId": "",
    "notes": ""
  },
  {
    "id": "place-la-higuera-bo",
    "name": "La Higuera",
    "country": "Bolivia",
    "latitude": -18.7918,
    "longitude": -64.2026,
    "mapX": 29.37451,
    "mapY": 61.65092,
    "precision": "locality",
    "verificationStatus": "manually_verified",
    "source": "Seed data",
    "sourceId": "",
    "notes": ""
  },
  {
    "id": "place-stockholm-se",
    "name": "Stockholm",
    "country": "Sweden",
    "latitude": 59.3293,
    "longitude": 18.0686,
    "mapX": 51.52184,
    "mapY": 13.65699,
    "precision": "locality",
    "verificationStatus": "manually_verified",
    "source": "Seed data",
    "sourceId": "",
    "notes": ""
  },
  {
    "id": "place-lutzen-de",
    "name": "Lützen",
    "country": "Germany",
    "latitude": 51.2567,
    "longitude": 12.1417,
    "mapX": 50.21293,
    "mapY": 18.37478,
    "precision": "locality",
    "verificationStatus": "manually_verified",
    "source": "Seed data",
    "sourceId": "",
    "notes": ""
  },
  {
    "id": "place-coyoacan-mx",
    "name": "Coyoacán",
    "country": "Mexico",
    "latitude": 19.3467,
    "longitude": -99.1617,
    "mapX": 19.84475,
    "mapY": 38.00505,
    "precision": "locality",
    "verificationStatus": "manually_verified",
    "source": "Seed data",
    "sourceId": "",
    "notes": ""
  }
];

const SEED_PERSONS = [
  {
    "id": "person-napoleon-bonaparte",
    "name": "Napoleon Bonaparte",
    "acceptedAnswers": [
      "napoleon",
      "napoleon bonaparte",
      "bonaparte"
    ],
    "period": "Revolutionary and Napoleonic Era",
    "birthYear": 1769,
    "deathYear": 1821,
    "birthPlaceId": "place-ajaccio-fr",
    "deathPlaceId": "place-longwood-sh",
    "difficulty": 1,
    "published": true
  },
  {
    "id": "person-albert-einstein",
    "name": "Albert Einstein",
    "acceptedAnswers": [
      "albert einstein",
      "einstein"
    ],
    "period": "20th Century",
    "birthYear": 1879,
    "deathYear": 1955,
    "birthPlaceId": "place-ulm-de",
    "deathPlaceId": "place-princeton-us",
    "difficulty": 1,
    "published": true
  },
  {
    "id": "person-leonardo-da-vinci",
    "name": "Leonardo da Vinci",
    "acceptedAnswers": [
      "leonardo da vinci",
      "leonardo",
      "da vinci"
    ],
    "period": "Renaissance",
    "birthYear": 1452,
    "deathYear": 1519,
    "birthPlaceId": "place-vinci-it",
    "deathPlaceId": "place-amboise-fr",
    "difficulty": 1,
    "published": true
  },
  {
    "id": "person-marie-curie",
    "name": "Marie Curie",
    "acceptedAnswers": [
      "marie curie",
      "curie",
      "maria sklodowska curie",
      "maria skłodowska curie"
    ],
    "period": "19th and 20th Centuries",
    "birthYear": 1867,
    "deathYear": 1934,
    "birthPlaceId": "place-warsaw-pl",
    "deathPlaceId": "place-passy-fr",
    "difficulty": 1,
    "published": true
  },
  {
    "id": "person-alexander-the-great",
    "name": "Alexander the Great",
    "acceptedAnswers": [
      "alexander the great",
      "alexander",
      "alexander iii",
      "alexander iii of macedon"
    ],
    "period": "Antiquity",
    "birthYear": -356,
    "deathYear": -323,
    "birthPlaceId": "place-pella-gr",
    "deathPlaceId": "place-babylon-iq",
    "difficulty": 1,
    "published": true
  },
  {
    "id": "person-che-guevara",
    "name": "Che Guevara",
    "acceptedAnswers": [
      "che guevara",
      "guevara",
      "ernesto che guevara"
    ],
    "period": "20th Century",
    "birthYear": 1928,
    "deathYear": 1967,
    "birthPlaceId": "place-rosario-ar",
    "deathPlaceId": "place-la-higuera-bo",
    "difficulty": 1,
    "published": true
  },
  {
    "id": "person-gustavus-adolphus",
    "name": "Gustavus Adolphus",
    "acceptedAnswers": [
      "gustavus adolphus",
      "gustav ii adolf",
      "gustav 2 adolf",
      "gustav adolf"
    ],
    "period": "Early Modern Period",
    "birthYear": 1594,
    "deathYear": 1632,
    "birthPlaceId": "place-stockholm-se",
    "deathPlaceId": "place-lutzen-de",
    "difficulty": 1,
    "published": true
  },
  {
    "id": "person-frida-kahlo",
    "name": "Frida Kahlo",
    "acceptedAnswers": [
      "frida kahlo",
      "kahlo"
    ],
    "period": "20th Century",
    "birthYear": 1907,
    "deathYear": 1954,
    "birthPlaceId": "place-coyoacan-mx",
    "deathPlaceId": "place-coyoacan-mx",
    "difficulty": 1,
    "published": true
  }
];


/* js/db.js */
const DB_NAME = "historical-person-map-game";
const DB_VERSION = 1;
const PLACES_STORE = "places";
const PERSONS_STORE = "persons";

let databasePromise;

function makeId(prefix) {
  const randomPart =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${randomPart}`;
}

function normalizeText(value) {
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
    country: String(place.country ?? "").trim(),
    latitude: Number(place.latitude),
    longitude: Number(place.longitude),
    mapX: Number.isFinite(Number(place.mapX)) ? Number(place.mapX) : null,
    mapY: Number.isFinite(Number(place.mapY)) ? Number(place.mapY) : null,
    precision: place.precision || "locality",
    verificationStatus:
      place.verificationStatus || "unverified",
    source: String(place.source ?? "").trim(),
    sourceId: String(place.sourceId ?? "").trim(),
    notes: String(place.notes ?? "").trim(),
    searchText: normalizeText(
      [
        place.name,
        place.country,
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
    tags: Array.isArray(person.tags)
      ? [...new Set(person.tags.map(value => normalizeText(value)).filter(Boolean))]
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
        ...(person.tags || []),
        person.period,
        person.id
      ].filter(Boolean).join(" ")
    ),
    createdAt: person.createdAt || now,
    updatedAt: now
  };
}

function openDatabase() {
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

async function countRecords(storeName) {
  const database = await openDatabase();
  const transaction = database.transaction(
    storeName,
    "readonly"
  );

  return requestToPromise(
    transaction.objectStore(storeName).count()
  );
}

async function getAllRecords(storeName) {
  const database = await openDatabase();
  const transaction = database.transaction(
    storeName,
    "readonly"
  );

  return requestToPromise(
    transaction.objectStore(storeName).getAll()
  );
}

async function getRecord(storeName, id) {
  const database = await openDatabase();
  const transaction = database.transaction(
    storeName,
    "readonly"
  );

  return requestToPromise(
    transaction.objectStore(storeName).get(id)
  );
}

async function putRecord(storeName, record) {
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

async function bulkPut(storeName, records) {
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

async function deleteRecord(storeName, id) {
  const database = await openDatabase();
  const transaction = database.transaction(
    storeName,
    "readwrite"
  );

  return requestToPromise(
    transaction.objectStore(storeName).delete(id)
  );
}

async function clearStore(storeName) {
  const database = await openDatabase();
  const transaction = database.transaction(
    storeName,
    "readwrite"
  );

  return requestToPromise(
    transaction.objectStore(storeName).clear()
  );
}

async function initializeDatabase() {
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

async function resetDatabase() {
  await clearStore(PERSONS_STORE);
  await clearStore(PLACES_STORE);
  await bulkPut(PLACES_STORE, SEED_PLACES);
  await bulkPut(PERSONS_STORE, SEED_PERSONS);
}


/* data/game-catalog.js */
const GAME_MODES = [
  {
    id: "life-map",
    title: "Life & Death Map",
    shortTitle: "Life & Death",
    description:
      "Identify a historical person from the years and the places where their life began and ended.",
    status: "available",
    href: "life-map.html",
    eyebrow: "Map challenge"
  },
  {
    id: "timeline",
    title: "Timeline",
    shortTitle: "Timeline",
    description:
      "Place events and people in the correct chronological order.",
    status: "coming-soon",
    eyebrow: "Coming later"
  },
  {
    id: "portrait",
    title: "Portrait",
    shortTitle: "Portrait",
    description:
      "Recognise historical figures from portraits, objects and visual details.",
    status: "coming-soon",
    eyebrow: "Coming later"
  }
];

const LIFE_MAP_COLLECTIONS = [
  {
    id: "world-history",
    group: "Global",
    title: "World History",
    description:
      "A broad selection of historical figures from different periods and parts of the world.",
    status: "available",
    roundLimit: 5,
    filter: { type: "all" }
  },
  {
    id: "american-presidents",
    group: "North America",
    title: "American Presidents",
    description:
      "Presidents of the United States, identified through their life dates and locations.",
    status: "coming-soon",
    roundLimit: 5,
    filter: { anyTags: ["american-president"] }
  },
  {
    id: "north-american-figures",
    group: "North America",
    title: "North American Figures",
    description:
      "Political leaders, artists, scientists and other figures connected to North America.",
    status: "coming-soon",
    roundLimit: 5,
    filter: { anyTags: ["north-america"] }
  },
  {
    id: "european-monarchs",
    group: "Europe",
    title: "European Monarchs",
    description:
      "Kings, queens and emperors from across European history.",
    status: "coming-soon",
    roundLimit: 5,
    filter: { anyTags: ["european-monarch"] }
  },
  {
    id: "renaissance",
    group: "Europe",
    title: "The Renaissance",
    description:
      "Artists, thinkers, rulers and innovators from the Renaissance.",
    status: "coming-soon",
    roundLimit: 5,
    filter: { anyTags: ["renaissance"] }
  },
  {
    id: "latin-american-figures",
    group: "South America",
    title: "Latin American Figures",
    description:
      "Historical figures connected to Latin America and the Caribbean.",
    status: "coming-soon",
    roundLimit: 5,
    filter: { anyTags: ["latin-america"] }
  },
  {
    id: "asian-rulers",
    group: "Asia",
    title: "Rulers of Asia",
    description:
      "Emperors, monarchs and political leaders from Asian history.",
    status: "coming-soon",
    roundLimit: 5,
    filter: { anyTags: ["asian-ruler"] }
  },
  {
    id: "african-history",
    group: "Africa",
    title: "African History",
    description:
      "Leaders, thinkers and cultural figures from across the African continent.",
    status: "coming-soon",
    roundLimit: 5,
    filter: { anyTags: ["africa"] }
  }
];

function getLifeMapCollection(collectionId) {
  return (
    LIFE_MAP_COLLECTIONS.find(
      collection => collection.id === collectionId && collection.status === "available"
    ) ?? LIFE_MAP_COLLECTIONS.find(collection => collection.id === "world-history")
  );
}

function personMatchesCollection(person, collection) {
  const filter = collection?.filter ?? { type: "all" };
  if (filter.type === "all") return true;

  const tags = new Set((person.tags ?? []).map(tag => String(tag).trim().toLowerCase()));

  if (Array.isArray(filter.personIds) && !filter.personIds.includes(person.id)) {
    return false;
  }

  if (Array.isArray(filter.periods) && !filter.periods.includes(person.period)) {
    return false;
  }

  if (
    Array.isArray(filter.anyTags) &&
    filter.anyTags.length > 0 &&
    !filter.anyTags.some(tag => tags.has(String(tag).toLowerCase()))
  ) {
    return false;
  }

  if (
    Array.isArray(filter.allTags) &&
    !filter.allTags.every(tag => tags.has(String(tag).toLowerCase()))
  ) {
    return false;
  }

  return true;
}


/* js/offline-world-map.js */
const ROBINSON_X_COEFFICIENTS = [
  [1.0, 2.2199e-17, -7.15515e-05, 3.1103e-06],
  [0.9986, -0.000482243, -2.4897e-05, -1.3309e-06],
  [0.9954, -0.00083103, -4.48605e-05, -9.86701e-07],
  [0.99, -0.00135364, -5.9661e-05, 3.6777e-06],
  [0.9822, -0.00167442, -4.49547e-06, -5.72411e-06],
  [0.973, -0.00214868, -9.03571e-05, 1.8736e-08],
  [0.96, -0.00305085, -9.00761e-05, 1.64917e-06],
  [0.9427, -0.00382792, -6.53386e-05, -2.6154e-06],
  [0.9216, -0.00467746, -0.00010457, 4.81243e-06],
  [0.8962, -0.00536223, -3.23831e-05, -5.43432e-06],
  [0.8679, -0.00609363, -0.000113898, 3.32484e-06],
  [0.835, -0.00698325, -6.40253e-05, 9.34959e-07],
  [0.7986, -0.00755338, -5.00009e-05, 9.35324e-07],
  [0.7597, -0.00798324, -3.5971e-05, -2.27626e-06],
  [0.7186, -0.00851367, -7.01149e-05, -8.6303e-06],
  [0.6732, -0.00986209, -0.000199569, 1.91974e-05],
  [0.6213, -0.010418, 8.83923e-05, 6.24051e-06],
  [0.5722, -0.00906601, 0.000182, 6.24051e-06]
];

const ROBINSON_Y_COEFFICIENTS = [
  [-5.20417e-18, 0.0124, 1.21431e-18, -8.45284e-11],
  [0.062, 0.0124, -1.26793e-09, 4.22642e-10],
  [0.124, 0.0124, 5.07171e-09, -1.60604e-09],
  [0.186, 0.0123999, -1.90189e-08, 6.00152e-09],
  [0.248, 0.0124002, 7.10039e-08, -2.24e-08],
  [0.31, 0.0123992, -2.64997e-07, 8.35986e-08],
  [0.372, 0.0124029, 9.88983e-07, -3.11994e-07],
  [0.434, 0.0123893, -3.69093e-06, -4.35621e-07],
  [0.4958, 0.0123198, -1.02252e-05, -3.45523e-07],
  [0.5571, 0.0121916, -1.54081e-05, -5.82288e-07],
  [0.6176, 0.0119938, -2.41424e-05, -5.25327e-07],
  [0.6769, 0.011713, -3.20223e-05, -5.16405e-07],
  [0.7346, 0.0113541, -3.97684e-05, -6.09052e-07],
  [0.7903, 0.0109107, -4.89042e-05, -1.04739e-06],
  [0.8435, 0.0103431, -6.4615e-05, -1.40374e-09],
  [0.8936, 0.00969686, -6.4636e-05, -8.547e-06],
  [0.9394, 0.00840947, -0.000192841, -4.2106e-06],
  [0.9761, 0.00616527, -0.000256, -4.2106e-06]
];

const ROBINSON_VIEWBOX_WIDTH = 1419.6;
const ROBINSON_VIEWBOX_HEIGHT = 719.98;

const REGION_BOXES = {
  world: { x: 0, y: 0, width: 100, height: 100, maxZoom: 1 },
  northAmerica: { x: 1.5, y: 4, width: 41, height: 52, maxZoom: 2.5 },
  southAmerica: { x: 26, y: 43, width: 27, height: 52, maxZoom: 2.7 },
  europe: { x: 42, y: 12, width: 20, height: 34, maxZoom: 4.1 },
  africa: { x: 41, y: 36, width: 26, height: 48, maxZoom: 2.9 },
  asia: { x: 55, y: 5, width: 44, height: 61, maxZoom: 2.25 },
  oceania: { x: 70, y: 54, width: 29, height: 42, maxZoom: 2.8 }
};

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normaliseLongitude(longitude) {
  let value = Number(longitude);
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

function evaluateRobinsonPolynomial(coefficients, z) {
  return coefficients[0] + z * (
    coefficients[1] + z * (coefficients[2] + z * coefficients[3])
  );
}

function getRobinsonFactors(absoluteLatitude) {
  const latitude = clamp(Number(absoluteLatitude), 0, 90);
  const interval = Math.min(17, Math.floor(latitude / 5));
  const intervalLatitude = latitude - interval * 5;

  return {
    x: evaluateRobinsonPolynomial(
      ROBINSON_X_COEFFICIENTS[interval],
      intervalLatitude
    ),
    y: evaluateRobinsonPolynomial(
      ROBINSON_Y_COEFFICIENTS[interval],
      intervalLatitude
    )
  };
}

function projectRobinson(latitude, longitude) {
  const lat = clamp(Number(latitude), -90, 90);
  const lon = normaliseLongitude(longitude);
  const factors = getRobinsonFactors(Math.abs(lat));
  const sign = lat === 0 ? 0 : Math.sign(lat);

  return {
    x: 50 + (lon / 180) * 50 * factors.x,
    y: 50 - sign * 50 * factors.y
  };
}

function invertRobinson(x, y) {
  const normalisedX = clamp(Number(x), 0, 100);
  const normalisedY = clamp(Number(y), 0, 100);
  const targetY = Math.abs((50 - normalisedY) / 50);
  let low = 0;
  let high = 90;

  for (let iteration = 0; iteration < 45; iteration += 1) {
    const middle = (low + high) / 2;
    if (getRobinsonFactors(middle).y < targetY) low = middle;
    else high = middle;
  }

  const absoluteLatitude = (low + high) / 2;
  const latitude = normalisedY < 50
    ? absoluteLatitude
    : normalisedY > 50
      ? -absoluteLatitude
      : 0;
  const xFactor = getRobinsonFactors(absoluteLatitude).x;
  const longitude = xFactor > 0
    ? clamp(((normalisedX - 50) / (50 * xFactor)) * 180, -180, 180)
    : 0;

  return { latitude, longitude };
}

function makeMarker(type) {
  if (type === 'admin') {
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'offline-map-marker offline-map-marker--admin';
    marker.setAttribute('aria-label', 'Editable place');
    return marker;
  }

  const marker = document.createElement('div');
  marker.className = `offline-map-marker offline-map-marker--${type}`;
  const ariaLabels = {
    birth: 'Birthplace',
    death: 'Place of death',
    combined: 'Birthplace and place of death'
  };
  marker.setAttribute('aria-label', ariaLabels[type] || 'Historical location');

  const dot = document.createElement('span');
  dot.className = 'offline-map-marker-dot';

  const label = document.createElement('span');
  label.className = 'offline-map-marker-label';

  const year = document.createElement('span');
  year.className = 'offline-map-marker-year';

  const place = document.createElement('span');
  place.className = 'offline-map-marker-place';
  place.hidden = true;

  label.append(year, place);
  marker.append(dot, label);
  return marker;
}

class DetailedWorldMap {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      editable: false,
      onLocationChange: null,
      ...options
    };

    this.scale = 1;
    this.centerX = 0.5;
    this.centerY = 0.5;
    this.minimumScale = 1;
    this.maximumScale = this.options.editable ? 10 : 7;
    this.markers = [];
    this.editableMarker = null;
    this.lastEditableLocation = null;
    this.pointerMode = null;
    this.pointerStart = null;
    this.didMove = false;
    this.activePointers = new Map();
    this.pinchStart = null;

    this.container.classList.add('offline-map');
    this.container.innerHTML = `
      <div class="offline-map-scene">
        <img class="offline-map-image" alt="Detailed vector world map with white land and grey ocean" draggable="false" decoding="sync">
        <div class="offline-map-marker-layer"></div>
      </div>
      <div class="offline-map-controls" aria-label="Map zoom controls">
        <button type="button" data-offline-zoom="in" aria-label="Zoom in">+</button>
        <button type="button" data-offline-zoom="out" aria-label="Zoom out">−</button>
        <button type="button" data-offline-zoom="reset" aria-label="Show the whole world">⌂</button>
      </div>
    `;

    this.scene = this.container.querySelector('.offline-map-scene');
    this.image = this.container.querySelector('.offline-map-image');
    this.markerLayer = this.container.querySelector('.offline-map-marker-layer');

    const mapAssetUrl = new URL('assets/detailed-world-map.svg', document.baseURI).href;
    this.ready = new Promise((resolve, reject) => {
      const handleLoad = () => {
        if (this.image.naturalWidth > 0) {
          this.container.classList.add('offline-map--ready');
          resolve();
        } else {
          reject(new Error('The local vector map loaded without dimensions.'));
        }
      };

      const handleError = () => {
        this.container.innerHTML = `
          <div class="map-load-error">
            <strong>The local map could not be loaded.</strong>
            <span>Keep the assets folder beside play.html and open the complete project folder.</span>
          </div>
        `;
        reject(new Error(`Could not load local map asset: ${mapAssetUrl}`));
      };

      this.image.addEventListener('load', handleLoad, { once: true });
      this.image.addEventListener('error', handleError, { once: true });
      this.image.src = mapAssetUrl;
    });

    this.setupInteractions();
    this.resizeObserver = new ResizeObserver(() => this.applyTransform());
    this.resizeObserver.observe(this.container);
    this.applyTransform();
  }

  setupInteractions() {
    this.container.querySelector('[data-offline-zoom="in"]').addEventListener('click', event => {
      event.stopPropagation();
      this.zoomAt(this.container.clientWidth / 2, this.container.clientHeight / 2, this.scale * 1.35);
    });

    this.container.querySelector('[data-offline-zoom="out"]').addEventListener('click', event => {
      event.stopPropagation();
      this.zoomAt(this.container.clientWidth / 2, this.container.clientHeight / 2, this.scale / 1.35);
    });

    this.container.querySelector('[data-offline-zoom="reset"]').addEventListener('click', event => {
      event.stopPropagation();
      this.zoomToRegion('world');
    });

    this.container.addEventListener('wheel', event => {
      event.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * 0.0013);
      this.zoomAt(event.clientX - rect.left, event.clientY - rect.top, this.scale * factor);
    }, { passive: false });

    this.container.addEventListener('pointerdown', event => {
      if (event.target.closest('.offline-map-controls') || event.target.closest('.offline-map-marker')) return;
      this.container.setPointerCapture(event.pointerId);
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.didMove = false;

      if (this.activePointers.size === 1) {
        this.pointerMode = 'pan';
        this.pointerStart = {
          x: event.clientX,
          y: event.clientY,
          centerX: this.centerX,
          centerY: this.centerY
        };
      } else if (this.activePointers.size === 2) {
        const points = [...this.activePointers.values()];
        this.pointerMode = 'pinch';
        this.pinchStart = {
          distance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
          scale: this.scale,
          centerX: this.centerX,
          centerY: this.centerY,
          midpoint: {
            x: (points[0].x + points[1].x) / 2,
            y: (points[0].y + points[1].y) / 2
          }
        };
      }
    });

    this.container.addEventListener('pointermove', event => {
      if (!this.activePointers.has(event.pointerId)) return;
      this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (this.pointerMode === 'pan' && this.activePointers.size === 1) {
        const dx = event.clientX - this.pointerStart.x;
        const dy = event.clientY - this.pointerStart.y;
        if (Math.hypot(dx, dy) > 3) this.didMove = true;
        this.centerX = this.pointerStart.centerX - dx / (this.container.clientWidth * this.scale);
        this.centerY = this.pointerStart.centerY - dy / (this.container.clientHeight * this.scale);
        this.applyTransform();
      } else if (this.pointerMode === 'pinch' && this.activePointers.size >= 2) {
        const points = [...this.activePointers.values()].slice(0, 2);
        const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        const rect = this.container.getBoundingClientRect();
        const midpoint = {
          x: (points[0].x + points[1].x) / 2 - rect.left,
          y: (points[0].y + points[1].y) / 2 - rect.top
        };
        this.didMove = true;
        const nextScale = this.pinchStart.scale * (distance / Math.max(1, this.pinchStart.distance));
        this.zoomAt(midpoint.x, midpoint.y, nextScale);
      }
    });

    const finishPointer = event => {
      const wasMoved = this.didMove;
      this.activePointers.delete(event.pointerId);
      if (this.container.hasPointerCapture(event.pointerId)) this.container.releasePointerCapture(event.pointerId);
      if (this.activePointers.size === 0) {
        this.pointerMode = null;
        this.pointerStart = null;
        this.pinchStart = null;

        if (this.options.editable && !wasMoved && !event.target.closest('.offline-map-controls')) {
          const location = this.clientPointToLocation(event.clientX, event.clientY);
          if (location) this.setEditableLocation(location.latitude, location.longitude, true);
        }
      }
    };

    this.container.addEventListener('pointerup', finishPointer);
    this.container.addEventListener('pointercancel', finishPointer);
  }

  getTransformPixels() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    let translateX = width / 2 - this.centerX * width * this.scale;
    let translateY = height / 2 - this.centerY * height * this.scale;

    translateX = clamp(translateX, width - width * this.scale, 0);
    translateY = clamp(translateY, height - height * this.scale, 0);

    this.centerX = (width / 2 - translateX) / (width * this.scale);
    this.centerY = (height / 2 - translateY) / (height * this.scale);

    return { width, height, translateX, translateY };
  }

  applyTransform() {
    const { translateX, translateY } = this.getTransformPixels();
    this.scene.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${this.scale})`;
    const inverseScale = 1 / this.scale;
    this.markerLayer.querySelectorAll('.offline-map-marker').forEach(marker => {
      marker.style.setProperty('--marker-inverse-scale', inverseScale);
    });
  }

  zoomAt(pointerX, pointerY, requestedScale) {
    const { width, height, translateX, translateY } = this.getTransformPixels();
    const sceneX = (pointerX - translateX) / (width * this.scale);
    const sceneY = (pointerY - translateY) / (height * this.scale);
    const nextScale = clamp(requestedScale, this.minimumScale, this.maximumScale);
    const nextTranslateX = pointerX - sceneX * width * nextScale;
    const nextTranslateY = pointerY - sceneY * height * nextScale;

    this.scale = nextScale;
    this.centerX = (width / 2 - nextTranslateX) / (width * nextScale);
    this.centerY = (height / 2 - nextTranslateY) / (height * nextScale);
    this.applyTransform();
  }

  clientPointToLocation(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    const { width, height, translateX, translateY } = this.getTransformPixels();
    const sceneX = (clientX - rect.left - translateX) / this.scale;
    const sceneY = (clientY - rect.top - translateY) / this.scale;
    const percentX = clamp(sceneX / width * 100, 0, 100);
    const percentY = clamp(sceneY / height * 100, 0, 100);
    return invertRobinson(percentX, percentY);
  }

  async resize() {
    await this.ready;
    this.applyTransform();
  }

  clearMarkers() {
    this.markers = [];
    this.markerLayer
      .querySelectorAll('.offline-map-marker--birth, .offline-map-marker--death, .offline-map-marker--combined')
      .forEach(marker => marker.remove());
  }

  async setGameLocations(locations) {
    await this.ready;
    this.clearMarkers();

    const valid = locations.filter(
      location =>
        Number.isFinite(Number(location.latitude)) &&
        Number.isFinite(Number(location.longitude))
    );

    const samePlace =
      valid.length === 2 &&
      Math.abs(Number(valid[0].latitude) - Number(valid[1].latitude)) < 0.00001 &&
      Math.abs(Number(valid[0].longitude) - Number(valid[1].longitude)) < 0.00001;

    const displayLocations = samePlace
      ? [
          {
            type: "combined",
            label: `${valid[0].label || "Birthplace"}; ${valid[1].label || "place of death"}`,
            year: [valid[0].year, valid[1].year].filter(Boolean).join("–"),
            placeName: valid[0].placeName || valid[1].placeName || "",
            latitude: Number(valid[0].latitude),
            longitude: Number(valid[0].longitude)
          }
        ]
      : valid;

    displayLocations.forEach(location => {
      const position = projectRobinson(location.latitude, location.longitude);
      const marker = makeMarker(location.type);
      marker.style.left = `${position.x}%`;
      marker.style.top = `${position.y}%`;
      marker.style.setProperty('--marker-inverse-scale', 1 / this.scale);
      marker.title = location.label || '';

      if (position.x > 76) {
        marker.classList.add('offline-map-marker--label-left');
      }

      const yearLabel = marker.querySelector('.offline-map-marker-year');
      if (yearLabel) yearLabel.textContent = location.year || '';

      const placeLabel = marker.querySelector('.offline-map-marker-place');
      if (placeLabel) {
        placeLabel.textContent = location.placeName || '';
        placeLabel.hidden = true;
      }

      this.markerLayer.append(marker);
      this.markers.push({ marker, location, position });
    });
  }

  setPlaceNamesVisible(visible) {
    this.markerLayer
      .querySelectorAll('.offline-map-marker-place')
      .forEach(label => {
        label.hidden = !visible || !label.textContent.trim();
      });
  }

  async fitToLocations(locations, animate = true) {
    await this.ready;
    const positions = locations
      .filter(location => Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)))
      .map(location => projectRobinson(location.latitude, location.longitude));

    if (positions.length === 0) {
      await this.zoomToRegion('world', animate);
      return;
    }

    const xs = positions.map(position => position.x);
    const ys = positions.map(position => position.y);
    let minX = Math.min(...xs);
    let maxX = Math.max(...xs);
    let minY = Math.min(...ys);
    let maxY = Math.max(...ys);

    const minimumWidth = positions.length === 1 ? 24 : 34;
    const minimumHeight = positions.length === 1 ? 24 : 34;
    const spanX = Math.max(minimumWidth, maxX - minX + 14);
    const spanY = Math.max(minimumHeight, maxY - minY + 18);
    const centerX = (minX + maxX) / 2 / 100;
    const centerY = (minY + maxY) / 2 / 100;
    const targetScale = clamp(Math.min(88 / spanX, 88 / spanY), 1, 4.25);

    this.setView(centerX, centerY, targetScale, animate);
  }

  setView(centerX, centerY, scale, animate = true) {
    if (animate) this.scene.classList.add('offline-map-scene--animate');
    else this.scene.classList.remove('offline-map-scene--animate');

    this.centerX = clamp(centerX, 0, 1);
    this.centerY = clamp(centerY, 0, 1);
    this.scale = clamp(scale, this.minimumScale, this.maximumScale);
    this.applyTransform();

    if (animate) {
      window.setTimeout(() => this.scene.classList.remove('offline-map-scene--animate'), 700);
    }
  }

  async zoomToRegion(regionName = 'world', animate = true) {
    await this.ready;
    const box = REGION_BOXES[regionName] || REGION_BOXES.world;
    const centerX = (box.x + box.width / 2) / 100;
    const centerY = (box.y + box.height / 2) / 100;
    const scale = regionName === 'world'
      ? 1
      : clamp(Math.min(88 / box.width, 88 / box.height), 1, box.maxZoom);
    this.setView(centerX, centerY, scale, animate);
  }

  async setEditableLocation(latitude, longitude, notify = false) {
    await this.ready;
    const lat = clamp(Number(latitude), -90, 90);
    const lon = normaliseLongitude(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    this.lastEditableLocation = { latitude: lat, longitude: lon };
    const position = projectRobinson(lat, lon);

    if (!this.editableMarker) {
      this.editableMarker = makeMarker('admin');
      this.editableMarker.style.setProperty('--marker-inverse-scale', 1 / this.scale);
      this.markerLayer.append(this.editableMarker);

      this.editableMarker.addEventListener('pointerdown', event => {
        event.preventDefault();
        event.stopPropagation();
        this.editableMarker.setPointerCapture(event.pointerId);
        this.editableMarker.dataset.dragging = 'true';
      });

      this.editableMarker.addEventListener('pointermove', event => {
        if (this.editableMarker.dataset.dragging !== 'true') return;
        const location = this.clientPointToLocation(event.clientX, event.clientY);
        if (!location) return;
        this.setEditableLocation(location.latitude, location.longitude, true);
      });

      const stopDrag = event => {
        if (this.editableMarker.dataset.dragging !== 'true') return;
        this.editableMarker.dataset.dragging = 'false';
        if (this.editableMarker.hasPointerCapture(event.pointerId)) this.editableMarker.releasePointerCapture(event.pointerId);
      };

      this.editableMarker.addEventListener('pointerup', stopDrag);
      this.editableMarker.addEventListener('pointercancel', stopDrag);
    }

    this.editableMarker.style.left = `${position.x}%`;
    this.editableMarker.style.top = `${position.y}%`;
    this.editableMarker.style.setProperty('--marker-inverse-scale', 1 / this.scale);

    if (notify && typeof this.options.onLocationChange === 'function') {
      this.options.onLocationChange(this.lastEditableLocation);
    }
  }

  async focusEditableLocation(animate = true) {
    await this.ready;
    if (!this.lastEditableLocation) return;
    const position = projectRobinson(this.lastEditableLocation.latitude, this.lastEditableLocation.longitude);
    this.setView(position.x / 100, position.y / 100, 4.5, animate);
  }
}


/* js/game.js */
const ROUND_DURATION_MS = 20_000;
const COUNTDOWN_SECONDS = 3;
const MAX_ROUND_POINTS = 1000;
const TIMER_UPDATE_INTERVAL_MS = 50;

const gameParameters = new URLSearchParams(window.location.search);
const collectionId = gameParameters.get("collection");
const timedMode = gameParameters.get("timed") !== "0";
const showPlacesInitially = gameParameters.get("showPlaces") === "1";
const activeCollection = getLifeMapCollection(collectionId);
const requestedRounds = Number.parseInt(gameParameters.get("rounds"), 10);
const ROUND_LIMIT = Number.isFinite(requestedRounds)
  ? Math.max(1, Math.min(100, requestedRounds))
  : (activeCollection.roundLimit ?? 5);

const roundNumberElement = document.querySelector("#round-number");
const roundTotalElement = document.querySelector("#round-total");
const scoreElement = document.querySelector("#score");
const scoreLabelElement = document.querySelector("#score-label");
const roundTimerElement = document.querySelector("#round-timer");
const timerHudItem = document.querySelector("#timer-hud-item");
const timingSettingSummary = document.querySelector("#timing-setting-summary");
const placeSettingSummary = document.querySelector("#place-setting-summary");
const roundSettingSummary = document.querySelector("#round-setting-summary");
const countdownOverlay = document.querySelector("#round-countdown");
const countdownValue = document.querySelector("#countdown-value");
const resultOverlay = document.querySelector("#round-result");
const resultStatusElement = document.querySelector("#result-status");
const resultPersonNameElement = document.querySelector("#result-person-name");
const resultPointsElement = document.querySelector("#result-points");
const resultUnitElement = document.querySelector("#result-unit");
const resultInstructionElement = document.querySelector("#result-instruction");
const guessForm = document.querySelector("#guess-form");
const guessInput = document.querySelector("#guess-input");
const guessButton = document.querySelector("#guess-button");
const feedbackElement = document.querySelector("#feedback");
const nextButton = document.querySelector("#next-button");
const revealButton = document.querySelector("#reveal-button");
const newGameButton = document.querySelector("#new-game-button");
const dataWarning = document.querySelector("#data-warning");
const collectionTitle = document.querySelector("#collection-title");
const collectionDescription = document.querySelector("#collection-description");
const collectionBreadcrumb = document.querySelector("#collection-breadcrumb");

let allPersons = [];
let placesById = new Map();
let availablePersons = [];
let usedPersonIds = new Set();
let currentPerson = null;
let currentBirthPlace = null;
let currentDeathPlace = null;
let currentRound = 1;
let score = 0;
let correctAnswers = 0;
let roundFinished = true;
let gameFinished = false;
let roundStartedAt = 0;
let timerIntervalId = null;
let roundSequence = 0;

const worldMap = new DetailedWorldMap(document.querySelector("#game-map"));

collectionTitle.textContent = activeCollection.title;
collectionDescription.textContent = activeCollection.description;
collectionBreadcrumb.textContent = activeCollection.title;
document.title = `${activeCollection.title} — Histoglyph`;
timerHudItem.hidden = !timedMode;
timingSettingSummary.textContent = timedMode
  ? "Timed · 20 seconds"
  : "Untimed · correct answers only";
placeSettingSummary.textContent = showPlacesInitially
  ? "Place names shown from the start"
  : "Place names hidden until the answer";
roundSettingSummary.textContent = `${ROUND_LIMIT} ${ROUND_LIMIT === 1 ? "round" : "rounds"}`;
scoreLabelElement.textContent = timedMode ? "Total score" : "Correct";
document.body.classList.toggle("untimed-game", !timedMode);

function formatYear(year) {
  return year < 0 ? `${Math.abs(year)} BC` : String(year);
}

function delay(milliseconds) {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

function getPlayablePersons() {
  return allPersons.filter(person => {
    if (!person.published || !personMatchesCollection(person, activeCollection)) {
      return false;
    }

    return Boolean(
      placesById.get(person.birthPlaceId) &&
      placesById.get(person.deathPlaceId)
    );
  });
}

function getNextPerson() {
  let unused = availablePersons.filter(person => !usedPersonIds.has(person.id));

  if (unused.length === 0) {
    usedPersonIds.clear();
    unused = [...availablePersons];
  }

  return unused[Math.floor(Math.random() * unused.length)];
}

function setFeedback(message, type = "neutral") {
  feedbackElement.textContent = message;
  feedbackElement.className = `feedback ${type}`;
}

function hidePlaceDetails() {
  worldMap.setPlaceNamesVisible(showPlacesInitially);
}

function revealPlaceDetails() {
  worldMap.setPlaceNamesVisible(true);
}

function calculateRoundPoints(elapsedMilliseconds) {
  const remainingFraction = Math.max(0, 1 - elapsedMilliseconds / ROUND_DURATION_MS);
  return Math.round(MAX_ROUND_POINTS * remainingFraction);
}

function updateTimerDisplay(elapsedMilliseconds) {
  if (!timedMode) return;
  const remainingMilliseconds = Math.max(0, ROUND_DURATION_MS - elapsedMilliseconds);
  roundTimerElement.textContent = (remainingMilliseconds / 1000).toFixed(1);
  document.body.classList.toggle(
    "round-time-low",
    remainingMilliseconds > 0 && remainingMilliseconds <= 5_000
  );
}

function resetTimerDisplay() {
  roundTimerElement.textContent = timedMode ? "20.0" : "∞";
  document.body.classList.remove("round-time-low");
}

function stopRoundTimer() {
  if (timerIntervalId !== null) {
    window.clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function setAnswerControlsEnabled(enabled) {
  guessInput.disabled = !enabled;
  guessButton.disabled = !enabled;
  revealButton.disabled = !enabled;
}

function enableCountdownTyping() {
  guessInput.disabled = false;
  guessButton.disabled = true;
  revealButton.disabled = true;
  guessInput.focus();
}

async function updateMap() {
  const locations = [
    {
      type: "birth",
      label: `Born ${formatYear(currentPerson.birthYear)} in ${currentBirthPlace.name}`,
      year: formatYear(currentPerson.birthYear),
      placeName: `${currentBirthPlace.name}, ${currentBirthPlace.country}`,
      latitude: Number(currentBirthPlace.latitude),
      longitude: Number(currentBirthPlace.longitude)
    },
    {
      type: "death",
      label: `Died ${formatYear(currentPerson.deathYear)} in ${currentDeathPlace.name}`,
      year: formatYear(currentPerson.deathYear),
      placeName: `${currentDeathPlace.name}, ${currentDeathPlace.country}`,
      latitude: Number(currentDeathPlace.latitude),
      longitude: Number(currentDeathPlace.longitude)
    }
  ];

  await worldMap.setGameLocations(locations);
  worldMap.setPlaceNamesVisible(showPlacesInitially);
  await worldMap.fitToLocations(locations);

  const unverified = [currentBirthPlace, currentDeathPlace].filter(
    place => place.verificationStatus !== "manually_verified"
  );
  dataWarning.hidden = unverified.length === 0;
}

function hideResultOverlay() {
  resultOverlay.hidden = true;
  resultOverlay.classList.remove(
    "round-result--correct",
    "round-result--incorrect",
    "round-result--neutral",
    "round-result--game-over"
  );
}

function showRoundResult({ status, statusClass, awardedPoints, correct }) {
  resultStatusElement.textContent = status;
  resultPersonNameElement.textContent = currentPerson.name;

  if (timedMode) {
    resultPointsElement.textContent = String(awardedPoints);
    resultUnitElement.textContent = "points";
  } else {
    resultPointsElement.textContent = correct ? "1" : "0";
    resultUnitElement.textContent = "correct this round";
  }

  const isFinalRound = currentRound >= ROUND_LIMIT;
  resultInstructionElement.textContent = isFinalRound
    ? "Press Enter to see your final result"
    : "Press Enter for the next round";

  resultOverlay.classList.add(`round-result--${statusClass}`);
  resultOverlay.hidden = false;
}

function showGameOver() {
  gameFinished = true;
  nextButton.disabled = true;
  resultStatusElement.textContent = "Game over";

  if (timedMode) {
    resultPersonNameElement.textContent = `${score} total points`;
    resultPointsElement.textContent = String(score);
    resultUnitElement.textContent = `points out of ${ROUND_LIMIT * MAX_ROUND_POINTS}`;
    setFeedback(
      `Game over. You scored ${score} out of ${ROUND_LIMIT * MAX_ROUND_POINTS} points.`,
      "neutral"
    );
  } else {
    resultPersonNameElement.textContent = `${correctAnswers} of ${ROUND_LIMIT} correct`;
    resultPointsElement.textContent = String(correctAnswers);
    resultUnitElement.textContent = `correct out of ${ROUND_LIMIT}`;
    setFeedback(
      `Game over. You answered ${correctAnswers} of ${ROUND_LIMIT} correctly.`,
      "neutral"
    );
  }

  resultInstructionElement.textContent = "Choose New game to play again";
  resultOverlay.classList.remove(
    "round-result--correct",
    "round-result--incorrect",
    "round-result--neutral"
  );
  resultOverlay.classList.add("round-result--game-over");
  resultOverlay.hidden = false;
}

function lockRound() {
  roundFinished = true;
  stopRoundTimer();
  setAnswerControlsEnabled(false);
  nextButton.disabled = false;
  revealPlaceDetails();
}

function prepareRound() {
  roundFinished = true;
  gameFinished = false;
  stopRoundTimer();
  setAnswerControlsEnabled(false);
  nextButton.disabled = true;
  hidePlaceDetails();
  hideResultOverlay();
  resetTimerDisplay();
}

async function runCountdown(sequence) {
  countdownOverlay.hidden = false;
  enableCountdownTyping();

  for (let value = COUNTDOWN_SECONDS; value >= 1; value -= 1) {
    if (sequence !== roundSequence) return false;
    countdownValue.textContent = String(value);
    countdownValue.classList.remove("countdown-pulse");
    void countdownValue.offsetWidth;
    countdownValue.classList.add("countdown-pulse");
    await delay(1000);
  }

  if (sequence !== roundSequence) return false;
  countdownOverlay.hidden = true;
  return true;
}

function finishRound({ status, statusClass, awardedPoints, correct = false }) {
  lockRound();

  if (correct) {
    correctAnswers += 1;
  }

  if (timedMode) {
    score += awardedPoints;
    scoreElement.textContent = String(score);
  } else {
    scoreElement.textContent = String(correctAnswers);
  }

  setFeedback("");
  showRoundResult({ status, statusClass, awardedPoints, correct });
}

function handleTimeExpired(sequence) {
  if (sequence !== roundSequence || roundFinished) return;
  updateTimerDisplay(ROUND_DURATION_MS);
  finishRound({ status: "Time is up", statusClass: "incorrect", awardedPoints: 0, correct: false });
}

function startActiveRound(sequence) {
  if (sequence !== roundSequence) return;

  roundFinished = false;
  roundStartedAt = performance.now();
  setAnswerControlsEnabled(true);
  guessInput.focus();

  if (!timedMode) {
    return;
  }

  updateTimerDisplay(0);

  timerIntervalId = window.setInterval(() => {
    if (sequence !== roundSequence || roundFinished) {
      stopRoundTimer();
      return;
    }

    const elapsed = performance.now() - roundStartedAt;
    if (elapsed >= ROUND_DURATION_MS) {
      handleTimeExpired(sequence);
      return;
    }
    updateTimerDisplay(elapsed);
  }, TIMER_UPDATE_INTERVAL_MS);
}

async function startRound() {
  const sequence = ++roundSequence;
  prepareRound();

  if (availablePersons.length === 0) {
    countdownOverlay.hidden = true;
    setFeedback("There are no playable people in this collection yet.", "incorrect");
    return;
  }

  currentPerson = getNextPerson();
  usedPersonIds.add(currentPerson.id);
  currentBirthPlace = placesById.get(currentPerson.birthPlaceId);
  currentDeathPlace = placesById.get(currentPerson.deathPlaceId);

  roundNumberElement.textContent = String(currentRound);
  roundTotalElement.textContent = String(ROUND_LIMIT);
  guessInput.value = "";
  setFeedback("");

  await updateMap();
  if (sequence !== roundSequence) return;

  const countdownCompleted = await runCountdown(sequence);
  if (!countdownCompleted) return;
  startActiveRound(sequence);
}

async function startNewGame() {
  roundSequence += 1;
  stopRoundTimer();
  countdownOverlay.hidden = true;
  hideResultOverlay();

  availablePersons = getPlayablePersons();
  usedPersonIds.clear();
  currentRound = 1;
  score = 0;
  correctAnswers = 0;
  scoreElement.textContent = "0";

  await startRound();
}

function isCorrectGuess(value) {
  const normalizedGuess = normalizeText(value);
  return [currentPerson.name, ...(currentPerson.acceptedAnswers || [])]
    .map(normalizeText)
    .includes(normalizedGuess);
}

function submitGuess() {
  if (!currentPerson || roundFinished) return;

  const elapsed = timedMode ? Math.min(ROUND_DURATION_MS, performance.now() - roundStartedAt) : 0;

  if (isCorrectGuess(guessInput.value)) {
    updateTimerDisplay(elapsed);
    finishRound({
      status: "Correct",
      statusClass: "correct",
      awardedPoints: timedMode ? calculateRoundPoints(elapsed) : 0,
      correct: true
    });
  } else {
    finishRound({ status: "Incorrect", statusClass: "incorrect", awardedPoints: 0, correct: false });
  }
}

guessForm.addEventListener("submit", event => {
  event.preventDefault();
  if (roundFinished && !countdownOverlay.hidden) return;
  submitGuess();
});

revealButton.addEventListener("click", () => {
  if (!currentPerson || roundFinished) return;
  finishRound({ status: "Answer revealed", statusClass: "neutral", awardedPoints: 0, correct: false });
});

async function advanceAfterRound() {
  if (!roundFinished || resultOverlay.hidden || gameFinished) return;

  if (currentRound >= ROUND_LIMIT) {
    showGameOver();
    return;
  }

  currentRound += 1;
  await startRound();
}

nextButton.addEventListener("click", advanceAfterRound);

document.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.repeat) return;
  if (roundFinished && !resultOverlay.hidden && !gameFinished) {
    event.preventDefault();
    advanceAfterRound();
  }
});

newGameButton.addEventListener("click", startNewGame);

async function boot() {
  try {
    await initializeDatabase();

    const [places, persons] = await Promise.all([
      getAllRecords(PLACES_STORE),
      getAllRecords(PERSONS_STORE)
    ]);

    placesById = new Map(places.map(place => [place.id, place]));
    allPersons = persons;
    await startNewGame();
  } catch (error) {
    console.error(error);
    countdownOverlay.hidden = true;
    hideResultOverlay();
    setFeedback(
      "The map or local database could not be opened. Run the project through Live Server.",
      "incorrect"
    );
  }
}

boot();


})();
