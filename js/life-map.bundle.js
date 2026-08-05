(function () {
"use strict";

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


/* js/life-map.js */
const collectionContainer = document.querySelector("#collection-groups");
const settingsDialog = document.querySelector("#game-settings-dialog");
const settingsForm = document.querySelector("#game-settings-form");
const selectedCollectionInput = document.querySelector("#selected-collection-id");
const settingsTitle = document.querySelector("#game-settings-title");
const settingsDescription = document.querySelector("#game-settings-description");
const timedInput = document.querySelector("#setting-timed");
const showPlacesInput = document.querySelector("#setting-show-places");
const roundsInput = document.querySelector("#setting-rounds");
const settingsNote = document.querySelector("#game-settings-note");
const closeSettingsButton = document.querySelector("#close-game-settings");
const cancelSettingsButton = document.querySelector("#cancel-game-settings");
const groupOrder = ["Global", "North America", "South America", "Europe", "Africa", "Asia", "Oceania"];

function openGameSettings(collection) {
  selectedCollectionInput.value = collection.id;
  settingsTitle.textContent = collection.title;
  settingsDescription.textContent = collection.description;
  timedInput.checked = true;
  showPlacesInput.checked = false;
  roundsInput.value = String(collection.roundLimit ?? 5);
  updateSettingsNote();
  settingsDialog.showModal();
  timedInput.focus();
}

function closeGameSettings() {
  if (settingsDialog.open) settingsDialog.close();
}

function makeCollectionCard(collection) {
  const card = document.createElement("article");
  card.className = `collection-card collection-card--${collection.status}`;

  const status = document.createElement("span");
  status.className = `status-badge status-badge--${collection.status}`;
  status.textContent = collection.status === "available" ? "Available" : "Coming soon";

  const title = document.createElement("h3");
  title.textContent = collection.title;

  const description = document.createElement("p");
  description.textContent = collection.description;

  const footer = document.createElement("div");
  footer.className = "collection-card-footer";

  const rounds = document.createElement("span");
  rounds.textContent = "Choose number of rounds";
  footer.append(rounds);

  if (collection.status === "available") {
    const button = document.createElement("button");
    button.className = "primary-button compact-button";
    button.type = "button";
    button.textContent = "Play";
    button.addEventListener("click", event => {
      event.stopPropagation();
      openGameSettings(collection);
    });
    footer.append(button);
    card.classList.add("collection-card--clickable");
    card.addEventListener("click", () => openGameSettings(collection));
  }

  card.append(status, title, description, footer);
  return card;
}

const groups = new Map();
for (const collection of LIFE_MAP_COLLECTIONS) {
  if (!groups.has(collection.group)) groups.set(collection.group, []);
  groups.get(collection.group).push(collection);
}

const sections = [];
for (const groupName of groupOrder) {
  const collections = groups.get(groupName);
  if (!collections?.length) continue;

  const section = document.createElement("section");
  section.className = "collection-section";

  const heading = document.createElement("div");
  heading.className = "collection-section-heading";
  heading.innerHTML = `<p class="eyebrow">Collection</p><h2>${groupName}</h2>`;

  const grid = document.createElement("div");
  grid.className = "collection-grid";
  grid.replaceChildren(...collections.map(makeCollectionCard));

  section.append(heading, grid);
  sections.push(section);
}

collectionContainer.replaceChildren(...sections);

function getSelectedRoundCount() {
  const parsed = Number.parseInt(roundsInput.value, 10);
  if (!Number.isFinite(parsed)) return 5;
  return Math.max(1, Math.min(100, parsed));
}

function updateSettingsNote() {
  const rounds = getSelectedRoundCount();
  roundsInput.value = String(rounds);
  settingsNote.textContent = timedInput.checked
    ? `${rounds} rounds · three-second preview · 20 seconds to answer · decreasing points.`
    : `${rounds} rounds · no answer timer · the result is shown as correct answers instead of points.`;
}

timedInput.addEventListener("change", updateSettingsNote);
roundsInput.addEventListener("input", updateSettingsNote);
roundsInput.addEventListener("blur", updateSettingsNote);

settingsForm.addEventListener("submit", event => {
  event.preventDefault();
  const collectionId = selectedCollectionInput.value;
  if (!collectionId) return;

  const params = new URLSearchParams({
    collection: collectionId,
    timed: timedInput.checked ? "1" : "0",
    showPlaces: showPlacesInput.checked ? "1" : "0",
    rounds: String(getSelectedRoundCount())
  });

  window.location.href = `play.html?${params.toString()}`;
});

closeSettingsButton.addEventListener("click", closeGameSettings);
cancelSettingsButton.addEventListener("click", closeGameSettings);
settingsDialog.addEventListener("click", event => {
  const rectangle = settingsDialog.getBoundingClientRect();
  const clickedBackdrop =
    event.clientX < rectangle.left ||
    event.clientX > rectangle.right ||
    event.clientY < rectangle.top ||
    event.clientY > rectangle.bottom;
  if (clickedBackdrop) closeGameSettings();
});


})();
