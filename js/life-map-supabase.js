import { requireSupabase } from "./supabase-client.js";
import { LIFE_MAP_COLLECTIONS as FALLBACK_COLLECTIONS } from "../data/game-catalog.js";

const supabase = requireSupabase();
const collectionContainer = document.querySelector("#collection-groups");
const settingsDialog = document.querySelector("#game-settings-dialog");
const settingsForm = document.querySelector("#game-settings-form");
const selectedCollectionInput = document.querySelector("#selected-collection-id");
const settingsTitle = document.querySelector("#game-settings-title");
const settingsDescription = document.querySelector("#game-settings-description");
const timedInput = document.querySelector("#setting-timed");
const showPlacesInput = document.querySelector("#setting-show-places");
const roundsInput = document.querySelector("#setting-rounds");
const difficultyInput = document.querySelector("#setting-difficulty");
const settingsNote = document.querySelector("#game-settings-note");
const closeSettingsButton = document.querySelector("#close-game-settings");
const cancelSettingsButton = document.querySelector("#cancel-game-settings");
const groupOrder = ["Global", "North America", "South America", "Europe", "Africa", "Asia", "Oceania"];

function openGameSettings(collection) {
  selectedCollectionInput.value = collection.slug;
  settingsTitle.textContent = collection.title;
  settingsDescription.textContent = collection.description;
  timedInput.checked = true;
  showPlacesInput.checked = false;
  roundsInput.value = String(collection.default_rounds || 5);
  difficultyInput.value = "all";
  updateSettingsNote();
  settingsDialog.showModal();
}
function closeGameSettings() { if (settingsDialog.open) settingsDialog.close(); }
function makeCollectionCard(collection) {
  const card = document.createElement("article");
  card.className = `collection-card collection-card--${collection.status}`;
  const status = document.createElement("span");
  status.className = `status-badge status-badge--${collection.status}`;
  status.textContent = collection.status === "available" ? "Available" : "Coming soon";
  const title = document.createElement("h3"); title.textContent = collection.title;
  const description = document.createElement("p"); description.textContent = collection.description;
  const footer = document.createElement("div"); footer.className = "collection-card-footer";
  const count = document.createElement("span");
  count.textContent = collection.status === "available"
    ? `${collection.available_people || 0} people available`
    : "More content is being prepared";
  footer.append(count);
  if (collection.status === "available" && Number(collection.available_people) > 0) {
    const button = document.createElement("button");
    button.className = "primary-button compact-button";
    button.type = "button";
    button.textContent = "Play";
    button.addEventListener("click", event => { event.stopPropagation(); openGameSettings(collection); });
    footer.append(button);
    card.classList.add("collection-card--clickable");
    card.addEventListener("click", () => openGameSettings(collection));
  }
  card.append(status, title, description, footer);
  return card;
}
function renderCollections(collections) {
  const groups = new Map();
  for (const collection of collections) {
    if (!groups.has(collection.group_name)) groups.set(collection.group_name, []);
    groups.get(collection.group_name).push(collection);
  }
  const sections = [];
  for (const groupName of groupOrder) {
    const group = groups.get(groupName);
    if (!group?.length) continue;
    const section = document.createElement("section"); section.className = "collection-section";
    const heading = document.createElement("div"); heading.className = "collection-section-heading";
    heading.innerHTML = `<p class="eyebrow">Collection</p><h2>${groupName}</h2>`;
    const grid = document.createElement("div"); grid.className = "collection-grid";
    grid.replaceChildren(...group.map(makeCollectionCard));
    section.append(heading, grid); sections.push(section);
  }
  collectionContainer.replaceChildren(...sections);
}
function roundCount() {
  const value = Number.parseInt(roundsInput.value, 10);
  return Number.isFinite(value) ? Math.max(1, Math.min(100, value)) : 5;
}
function selectedDifficulty() {
  const value = Number.parseInt(difficultyInput.value, 10);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}
function difficultyLabel() {
  const difficulty = selectedDifficulty();
  return difficulty === null
    ? "all difficulties"
    : `difficulty ${difficulty}`;
}
function updateSettingsNote() {
  const rounds = roundCount();
  roundsInput.value = String(rounds);
  settingsNote.textContent = timedInput.checked
    ? `${rounds} rounds · ${difficultyLabel()} · three-second preview · 20 seconds to answer · server-validated points.`
    : `${rounds} rounds · ${difficultyLabel()} · no timer · the result is shown as correct answers.`;
}
settingsForm.addEventListener("submit", event => {
  event.preventDefault();
  const params = new URLSearchParams({
    collection: selectedCollectionInput.value,
    timed: timedInput.checked ? "1" : "0",
    showPlaces: showPlacesInput.checked ? "1" : "0",
    rounds: String(roundCount()),
    difficulty: selectedDifficulty() === null ? "all" : String(selectedDifficulty())
  });
  location.href = `play.html?${params}`;
});
timedInput.addEventListener("change", updateSettingsNote);
roundsInput.addEventListener("input", updateSettingsNote);
difficultyInput.addEventListener("change", updateSettingsNote);
closeSettingsButton.addEventListener("click", closeGameSettings);
cancelSettingsButton.addEventListener("click", closeGameSettings);

const { data, error } = await supabase.rpc("list_life_map_collections");
if (error) {
  console.error(error);
  const fallback = FALLBACK_COLLECTIONS.map(c => ({
    slug: c.id, group_name: c.group, title: c.title, description: c.description,
    status: c.status, default_rounds: c.roundLimit, available_people: c.id === "world-history" ? 0 : 0
  }));
  renderCollections(fallback);
  const warning = document.createElement("p");
  warning.className = "data-warning";
  warning.textContent = `The collection database could not be loaded: ${error.message}`;
  collectionContainer.prepend(warning);
} else {
  renderCollections(data || []);
}
