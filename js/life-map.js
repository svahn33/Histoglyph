import { LIFE_MAP_COLLECTIONS } from "../data/game-catalog.js";

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
