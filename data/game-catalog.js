export const GAME_MODES = [
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

export const LIFE_MAP_COLLECTIONS = [
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
      "Deceased presidents of the United States, identified through their life dates and locations.",
    status: "available",
    roundLimit: 10,
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

export function getLifeMapCollection(collectionId) {
  return (
    LIFE_MAP_COLLECTIONS.find(
      collection => collection.id === collectionId && collection.status === "available"
    ) ?? LIFE_MAP_COLLECTIONS.find(collection => collection.id === "world-history")
  );
}

export function personMatchesCollection(person, collection) {
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
