import { requireSupabase } from "./supabase-client.js";
import { LIFE_MAP_COLLECTIONS as FALLBACK_COLLECTIONS } from "../data/game-catalog.js";

const supabase = requireSupabase();
const collectionContainer = document.querySelector("#portrait-collection-groups");
const settingsDialog = document.querySelector("#portrait-settings-dialog");
const settingsForm = document.querySelector("#portrait-settings-form");
const selectedCollectionInput = document.querySelector("#portrait-selected-collection-id");
const settingsTitle = document.querySelector("#portrait-settings-title");
const peopleInput = document.querySelector("#portrait-setting-rounds");
const includeAllInput = document.querySelector("#portrait-setting-include-all");
const difficultyInput = document.querySelector("#portrait-setting-difficulty");
const birthYearMinInput = document.querySelector("#portrait-setting-birth-year-min");
const birthYearMaxInput = document.querySelector("#portrait-setting-birth-year-max");
const birthYearMinEntry = document.querySelector("#portrait-birth-year-min-entry");
const birthYearMaxEntry = document.querySelector("#portrait-birth-year-max-entry");
const birthYearDualRange = document.querySelector("#portrait-birth-year-dual-range");
const birthYearRangeTrack = birthYearDualRange?.querySelector(".birth-year-range-track");
const birthYearMinThumb = document.querySelector("#portrait-birth-year-min-thumb");
const birthYearMaxThumb = document.querySelector("#portrait-birth-year-max-thumb");
const settingsNote = document.querySelector("#portrait-settings-note");
const startSettingsButton = document.querySelector("#portrait-start-settings");
const closeSettingsButton = document.querySelector("#portrait-close-settings");
const cancelSettingsButton = document.querySelector("#portrait-cancel-settings");
const initialYearsInput = document.querySelector("#portrait-setting-years");
const initialOccupationInput = document.querySelector("#portrait-setting-occupation");
const initialPlacesInput = document.querySelector("#portrait-setting-places");

const groupOrder = ["Global", "North America", "South America", "Europe", "Africa", "Asia", "Oceania"];
const birthBoundsCache = new Map();
let activeBirthBounds = null;
let draggedBirthThumb = null;
let draggedBirthPointerId = null;

function formatHistoricalYear(value) {
  const year = Number(value);
  if (!Number.isFinite(year)) return "—";
  return year < 0 ? `${Math.abs(year)} BC` : String(year);
}

function parseHistoricalYear(rawValue) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/,/g, "").replace(/\s+/g, " ").toUpperCase();
  const bcMatch = normalized.match(/^([+-]?\d+)\s*(BC|BCE)$/);
  if (bcMatch) return -Math.abs(Number.parseInt(bcMatch[1], 10));
  const adPrefixMatch = normalized.match(/^(AD|CE)\s*([+-]?\d+)$/);
  if (adPrefixMatch) return Math.abs(Number.parseInt(adPrefixMatch[2], 10));
  const adSuffixMatch = normalized.match(/^([+-]?\d+)\s*(AD|CE)$/);
  if (adSuffixMatch) return Math.abs(Number.parseInt(adSuffixMatch[1], 10));
  if (/^[+-]?\d+$/.test(normalized)) return Number.parseInt(normalized, 10);
  return null;
}

function setBirthRangeLoading(isLoading) {
  birthYearMinInput.disabled = isLoading;
  birthYearMaxInput.disabled = isLoading;
  birthYearMinEntry.disabled = isLoading;
  birthYearMaxEntry.disabled = isLoading;
  birthYearMinThumb.tabIndex = isLoading ? -1 : 0;
  birthYearMaxThumb.tabIndex = isLoading ? -1 : 0;
  birthYearDualRange.classList.toggle("is-disabled", isLoading);
  startSettingsButton.disabled = isLoading;
  if (isLoading) {
    birthYearMinEntry.value = "Loading…";
    birthYearMaxEntry.value = "Loading…";
  }
}

function updateBirthRangeTrack(minValue, maxValue) {
  if (!activeBirthBounds || !birthYearRangeTrack) return;
  const span = Math.max(1, activeBirthBounds.max - activeBirthBounds.min);
  const minRatio = Math.max(0, Math.min(1, (minValue - activeBirthBounds.min) / span));
  const maxRatio = Math.max(0, Math.min(1, (maxValue - activeBirthBounds.min) / span));
  const trackWidth = Math.max(0, birthYearRangeTrack.clientWidth);
  const trackLeft = birthYearRangeTrack.offsetLeft;
  const startPx = minRatio * trackWidth;
  const widthPx = Math.max(0, (maxRatio - minRatio) * trackWidth);

  birthYearDualRange.style.setProperty("--range-start-px", `${startPx}px`);
  birthYearDualRange.style.setProperty("--range-width-px", `${widthPx}px`);
  birthYearMinThumb.style.left = `${trackLeft + startPx}px`;
  birthYearMaxThumb.style.left = `${trackLeft + maxRatio * trackWidth}px`;

  birthYearMinThumb.setAttribute("aria-valuemin", String(activeBirthBounds.min));
  birthYearMinThumb.setAttribute("aria-valuemax", String(maxValue));
  birthYearMinThumb.setAttribute("aria-valuenow", String(minValue));
  birthYearMinThumb.setAttribute("aria-valuetext", formatHistoricalYear(minValue));
  birthYearMaxThumb.setAttribute("aria-valuemin", String(minValue));
  birthYearMaxThumb.setAttribute("aria-valuemax", String(activeBirthBounds.max));
  birthYearMaxThumb.setAttribute("aria-valuenow", String(maxValue));
  birthYearMaxThumb.setAttribute("aria-valuetext", formatHistoricalYear(maxValue));
}

function updateBirthRange(changedInput = null, { preserveEntry = null } = {}) {
  if (!activeBirthBounds) return;
  let minValue = Number.parseInt(birthYearMinInput.value, 10);
  let maxValue = Number.parseInt(birthYearMaxInput.value, 10);

  if (minValue > maxValue) {
    if (changedInput === birthYearMinInput) {
      maxValue = minValue;
      birthYearMaxInput.value = String(maxValue);
    } else {
      minValue = maxValue;
      birthYearMinInput.value = String(minValue);
    }
  }

  if (preserveEntry !== birthYearMinEntry) birthYearMinEntry.value = formatHistoricalYear(minValue);
  if (preserveEntry !== birthYearMaxEntry) birthYearMaxEntry.value = formatHistoricalYear(maxValue);
  birthYearMinEntry.setAttribute("aria-invalid", "false");
  birthYearMaxEntry.setAttribute("aria-invalid", "false");
  updateBirthRangeTrack(minValue, maxValue);
  updateSettingsNote();
}

function applyBirthYearEntry(entry, slider, changedSlider, { finalize = false } = {}) {
  if (!activeBirthBounds) return;
  const parsed = parseHistoricalYear(entry.value);
  if (!Number.isFinite(parsed)) {
    entry.setAttribute("aria-invalid", "true");
    if (finalize) updateBirthRange();
    return;
  }

  entry.setAttribute("aria-invalid", "false");
  const clamped = Math.max(activeBirthBounds.min, Math.min(activeBirthBounds.max, parsed));
  slider.value = String(clamped);
  updateBirthRange(changedSlider, { preserveEntry: finalize ? null : entry });
  if (finalize) entry.value = formatHistoricalYear(Number.parseInt(slider.value, 10));
}

async function loadBirthYearBounds(collection) {
  const requestedSlug = collection.slug;
  setBirthRangeLoading(true);
  let bounds = birthBoundsCache.get(requestedSlug);
  if (!bounds) {
    const { data, error } = await supabase.rpc("get_portrait_birth_year_bounds", {
      p_collection_slug: requestedSlug
    });
    if (error) {
      console.error(error);
      settingsNote.textContent = "Birth-year filtering is unavailable. Run the V53 Portrait database migration first.";
      return;
    }
    bounds = { min: Number(data?.min_birth_year), max: Number(data?.max_birth_year) };
    if (!Number.isFinite(bounds.min) || !Number.isFinite(bounds.max)) {
      settingsNote.textContent = "This collection does not contain enough usable birth years.";
      return;
    }
    birthBoundsCache.set(requestedSlug, bounds);
  }

  if (selectedCollectionInput.value !== requestedSlug) return;
  activeBirthBounds = bounds;
  birthYearMinInput.min = String(bounds.min);
  birthYearMinInput.max = String(bounds.max);
  birthYearMaxInput.min = String(bounds.min);
  birthYearMaxInput.max = String(bounds.max);
  birthYearMinInput.value = String(bounds.min);
  birthYearMaxInput.value = String(bounds.max);
  setBirthRangeLoading(false);
  updateBirthRange();
}

function openGameSettings(collection) {
  selectedCollectionInput.value = collection.slug;
  settingsTitle.textContent = collection.title;
  peopleInput.value = String(Math.max(1, collection.default_rounds || 10));
  includeAllInput.checked = false;
  peopleInput.disabled = false;
  difficultyInput.value = "all";
  initialYearsInput.checked = false;
  initialOccupationInput.checked = false;
  initialPlacesInput.checked = false;
  activeBirthBounds = null;
  updateSettingsNote();
  settingsDialog.showModal();
  loadBirthYearBounds(collection).catch(error => {
    console.error(error);
    settingsNote.textContent = "The birth-year range could not be loaded.";
  });
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
  const count = document.createElement("span");
  count.textContent = collection.status === "available"
    ? `${collection.available_people || 0} portraits available`
    : "More content is being prepared";
  footer.append(count);

  if (collection.status === "available" && Number(collection.available_people) >= 1) {
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
    const section = document.createElement("section");
    section.className = "collection-section";
    const heading = document.createElement("div");
    heading.className = "collection-section-heading";
    heading.innerHTML = `<p class="eyebrow">Collection</p><h2>${groupName}</h2>`;
    const grid = document.createElement("div");
    grid.className = "collection-grid";
    grid.replaceChildren(...group.map(makeCollectionCard));
    section.append(heading, grid);
    sections.push(section);
  }
  collectionContainer.replaceChildren(...sections);
}

function peopleCount() {
  const value = Number.parseInt(peopleInput.value, 10);
  return Number.isFinite(value) ? Math.max(1, Math.min(100, value)) : 10;
}

function selectedDifficulty() {
  const value = Number.parseInt(difficultyInput.value, 10);
  return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
}

function selectedBirthRange() {
  if (!activeBirthBounds) return null;
  return {
    min: Number.parseInt(birthYearMinInput.value, 10),
    max: Number.parseInt(birthYearMaxInput.value, 10)
  };
}

function updateSettingsNote() {
  peopleInput.disabled = includeAllInput.checked;
  const countLabel = includeAllInput.checked
    ? "all matching portraits"
    : String(peopleInput.value).trim() === ""
      ? "enter number of rounds"
      : `${peopleCount()} rounds`;
  const difficulty = selectedDifficulty();
  const difficultyLabel = difficulty === null ? "all difficulties" : `difficulty ${difficulty}`;
  const range = selectedBirthRange();
  const rangeLabel = range
    ? `born ${formatHistoricalYear(range.min)}–${formatHistoricalYear(range.max)}`
    : "birth years loading";
  const clues = [
    initialYearsInput.checked ? "life years" : "",
    initialOccupationInput.checked ? "occupation" : "",
    initialPlacesInput.checked ? "places" : ""
  ].filter(Boolean);
  const clueLabel = clues.length ? clues.join(", ") : "portrait only";
  settingsNote.textContent = `Current settings: ${countLabel} · ${difficultyLabel} · ${rangeLabel} · ${clueLabel}.`;
}

function valueFromBirthRangePointer(clientX) {
  if (!activeBirthBounds || !birthYearRangeTrack) return null;
  const rect = birthYearRangeTrack.getBoundingClientRect();
  if (rect.width <= 0) return null;
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  const raw = activeBirthBounds.min + ratio * (activeBirthBounds.max - activeBirthBounds.min);
  return Math.round(raw);
}

function setBirthSliderValue(slider, value) {
  if (!activeBirthBounds) return;
  const other = slider === birthYearMinInput ? birthYearMaxInput : birthYearMinInput;
  let next = Math.max(activeBirthBounds.min, Math.min(activeBirthBounds.max, value));
  if (slider === birthYearMinInput) next = Math.min(next, Number.parseInt(other.value, 10));
  else next = Math.max(next, Number.parseInt(other.value, 10));
  slider.value = String(next);
  updateBirthRange(slider);
}

function chooseBirthThumb(event) {
  const requested = event.target.closest?.("[data-range-thumb]")?.dataset.rangeThumb;
  if (requested === "min") return birthYearMinInput;
  if (requested === "max") return birthYearMaxInput;
  const value = valueFromBirthRangePointer(event.clientX);
  if (value === null) return null;
  const minDistance = Math.abs(value - Number.parseInt(birthYearMinInput.value, 10));
  const maxDistance = Math.abs(value - Number.parseInt(birthYearMaxInput.value, 10));
  return minDistance <= maxDistance ? birthYearMinInput : birthYearMaxInput;
}

birthYearDualRange.addEventListener("pointerdown", event => {
  if (!activeBirthBounds || birthYearMinInput.disabled || birthYearMaxInput.disabled) return;
  const slider = chooseBirthThumb(event);
  const value = valueFromBirthRangePointer(event.clientX);
  if (!slider || value === null) return;
  event.preventDefault();
  draggedBirthThumb = slider;
  draggedBirthPointerId = event.pointerId;
  birthYearDualRange.setPointerCapture?.(event.pointerId);
  setBirthSliderValue(slider, value);
  (slider === birthYearMinInput ? birthYearMinThumb : birthYearMaxThumb).focus({ preventScroll: true });
});

birthYearDualRange.addEventListener("pointermove", event => {
  if (!draggedBirthThumb || event.pointerId !== draggedBirthPointerId) return;
  const value = valueFromBirthRangePointer(event.clientX);
  if (value === null) return;
  event.preventDefault();
  setBirthSliderValue(draggedBirthThumb, value);
});

function finishBirthThumbDrag(event) {
  if (event.pointerId !== draggedBirthPointerId) return;
  if (birthYearDualRange.hasPointerCapture?.(event.pointerId)) birthYearDualRange.releasePointerCapture(event.pointerId);
  draggedBirthThumb = null;
  draggedBirthPointerId = null;
}

birthYearDualRange.addEventListener("pointerup", finishBirthThumbDrag);
birthYearDualRange.addEventListener("pointercancel", finishBirthThumbDrag);

function handleBirthThumbKeyboard(event, slider) {
  if (!activeBirthBounds) return;
  const current = Number.parseInt(slider.value, 10);
  const pageStep = Math.max(10, Math.round((activeBirthBounds.max - activeBirthBounds.min) / 20));
  let next = current;
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current - 1;
  else if (event.key === "ArrowRight" || event.key === "ArrowUp") next = current + 1;
  else if (event.key === "PageDown") next = current - pageStep;
  else if (event.key === "PageUp") next = current + pageStep;
  else if (event.key === "Home") next = activeBirthBounds.min;
  else if (event.key === "End") next = activeBirthBounds.max;
  else return;
  event.preventDefault();
  setBirthSliderValue(slider, next);
}

birthYearMinThumb.addEventListener("keydown", event => handleBirthThumbKeyboard(event, birthYearMinInput));
birthYearMaxThumb.addEventListener("keydown", event => handleBirthThumbKeyboard(event, birthYearMaxInput));

settingsForm.addEventListener("submit", event => {
  event.preventDefault();
  const range = selectedBirthRange();
  if (!range) return;
  const params = new URLSearchParams({
    collection: selectedCollectionInput.value,
    rounds: String(peopleCount()),
    includeAll: includeAllInput.checked ? "1" : "0",
    difficulty: selectedDifficulty() === null ? "all" : String(selectedDifficulty()),
    birthFrom: String(range.min),
    birthTo: String(range.max),
    years: initialYearsInput.checked ? "1" : "0",
    occupation: initialOccupationInput.checked ? "1" : "0",
    places: initialPlacesInput.checked ? "1" : "0"
  });
  location.href = `portrait-play.html?${params}`;
});

peopleInput.addEventListener("input", updateSettingsNote);
peopleInput.addEventListener("blur", () => {
  if (!includeAllInput.checked && String(peopleInput.value).trim() !== "") {
    peopleInput.value = String(peopleCount());
  }
  updateSettingsNote();
});
includeAllInput.addEventListener("change", updateSettingsNote);
difficultyInput.addEventListener("change", updateSettingsNote);
initialYearsInput.addEventListener("change", updateSettingsNote);
initialOccupationInput.addEventListener("change", updateSettingsNote);
initialPlacesInput.addEventListener("change", updateSettingsNote);
birthYearMinEntry.addEventListener("input", () => applyBirthYearEntry(birthYearMinEntry, birthYearMinInput, birthYearMinInput));
birthYearMaxEntry.addEventListener("input", () => applyBirthYearEntry(birthYearMaxEntry, birthYearMaxInput, birthYearMaxInput));
birthYearMinEntry.addEventListener("change", () => applyBirthYearEntry(birthYearMinEntry, birthYearMinInput, birthYearMinInput, { finalize: true }));
birthYearMaxEntry.addEventListener("change", () => applyBirthYearEntry(birthYearMaxEntry, birthYearMaxInput, birthYearMaxInput, { finalize: true }));
birthYearMinEntry.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); birthYearMinEntry.blur(); } });
birthYearMaxEntry.addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); birthYearMaxEntry.blur(); } });

if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => {
    const range = selectedBirthRange();
    if (range) updateBirthRangeTrack(range.min, range.max);
  }).observe(birthYearDualRange);
} else {
  window.addEventListener("resize", () => {
    const range = selectedBirthRange();
    if (range) updateBirthRangeTrack(range.min, range.max);
  });
}

closeSettingsButton.addEventListener("click", closeGameSettings);
cancelSettingsButton.addEventListener("click", closeGameSettings);

const { data, error } = await supabase.rpc("list_portrait_collections");
if (error) {
  console.error(error);
  const fallback = FALLBACK_COLLECTIONS.map(collection => ({
    slug: collection.id,
    group_name: collection.group,
    title: collection.title,
    description: collection.description,
    status: collection.status,
    default_rounds: Math.max(1, collection.roundLimit || 10),
    available_people: 0
  }));
  renderCollections(fallback);
  const warning = document.createElement("p");
  warning.className = "data-warning";
  warning.textContent = `Portrait is not connected to the database yet: ${error.message}`;
  collectionContainer.prepend(warning);
} else {
  renderCollections(data || []);
}
