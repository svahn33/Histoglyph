
import {
  PERSONS_STORE,
  PLACES_STORE,
  bulkPut,
  clearStore,
  deleteRecord,
  getAllRecords,
  initializeDatabase,
  makeId,
  normalizeText,
  putRecord,
  resetDatabase
} from "./db.js";
import { DetailedWorldMap } from "./offline-world-map.js";

const state = {
  places: [],
  persons: [],
  selectedPlaceId: null,
  selectedPersonId: null,
  suppressMapUpdate: false
};

const elements = Object.fromEntries([...document.querySelectorAll("[id]")].map(element => [element.id, element]));

const adminMap = new DetailedWorldMap(document.querySelector("#admin-map"), {
  editable: true,
  onLocationChange({ latitude, longitude }) {
    if (state.suppressMapUpdate) return;
    elements["place-latitude"].value = latitude.toFixed(6);
    elements["place-longitude"].value = longitude.toFixed(6);
    validatePlaceForm();
  }
});

function setActiveTab(tabName) {
  document.querySelectorAll(".tab-button").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach(panel => {
    panel.hidden = panel.id !== `tab-${tabName}`;
  });
}

function downloadText(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatPlace(place) {
  return `${place.name}, ${place.country}`;
}

function createRecordButton({ title, subtitle, status, active, onClick }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `record-item${active ? " active" : ""}`;

  const strong = document.createElement("strong");
  strong.textContent = title;

  const span = document.createElement("span");
  if (status) {
    const dot = document.createElement("i");
    dot.className = `status-dot status-${status}`;
    span.append(dot);
  }
  span.append(document.createTextNode(subtitle));
  button.append(strong, span);
  button.addEventListener("click", onClick);
  return button;
}

async function reloadData() {
  const [places, persons] = await Promise.all([
    getAllRecords(PLACES_STORE),
    getAllRecords(PERSONS_STORE)
  ]);

  state.places = places.sort((a, b) => a.name.localeCompare(b.name, "en"));
  state.persons = persons.sort((a, b) => a.name.localeCompare(b.name, "en"));

  refreshMetrics();
  renderPlaceList();
  renderPersonList();
}

function refreshMetrics() {
  elements["metric-places"].textContent = state.places.length;
  elements["metric-verified"].textContent = state.places.filter(place => place.verificationStatus === "manually_verified").length;
  elements["metric-review"].textContent = state.places.filter(place => place.verificationStatus !== "manually_verified").length;
  elements["metric-persons"].textContent = state.persons.length;
}

function renderPlaceList() {
  const query = normalizeText(elements["place-search"].value);
  const status = elements["place-status-filter"].value;
  const matches = state.places.filter(place => {
    const searchText = normalizeText([place.name, place.country, place.id].filter(Boolean).join(" "));
    const matchesText = !query || searchText.includes(query);
    const matchesStatus = status === "all" || place.verificationStatus === status;
    return matchesText && matchesStatus;
  });

  const fragment = document.createDocumentFragment();
  const visibleMatches = matches.slice(0, 300);
  visibleMatches.forEach(place => {
    fragment.append(createRecordButton({
      title: place.name,
      subtitle: `${place.country} · ${place.verificationStatus.replaceAll("_", " ")}`,
      status: place.verificationStatus,
      active: place.id === state.selectedPlaceId,
      onClick: () => loadPlaceIntoForm(place.id)
    }));
  });

  if (matches.length > visibleMatches.length) {
    const note = document.createElement("p");
    note.className = "record-limit-note";
    note.textContent = `Showing the first ${visibleMatches.length} of ${matches.length} places. Refine the search to see a specific record.`;
    fragment.append(note);
  }

  elements["place-list"].replaceChildren(fragment);
}

function renderPersonList() {
  const query = normalizeText(elements["person-search"].value);
  const places = new Map(state.places.map(place => [place.id, place]));
  const matches = state.persons.filter(person => {
    const searchText = normalizeText([person.name, ...(person.acceptedAnswers || []), ...(person.tags || []), person.period, person.id].filter(Boolean).join(" "));
    return !query || searchText.includes(query);
  });

  const fragment = document.createDocumentFragment();
  const visibleMatches = matches.slice(0, 300);
  visibleMatches.forEach(person => {
    const birthPlace = places.get(person.birthPlaceId);
    const deathPlace = places.get(person.deathPlaceId);
    fragment.append(createRecordButton({
      title: person.name,
      subtitle: `${birthPlace?.name || "Missing place"} → ${deathPlace?.name || "Missing place"}`,
      active: person.id === state.selectedPersonId,
      onClick: () => loadPersonIntoForm(person.id)
    }));
  });

  if (matches.length > visibleMatches.length) {
    const note = document.createElement("p");
    note.className = "record-limit-note";
    note.textContent = `Showing the first ${visibleMatches.length} of ${matches.length} people. Refine the search to see a specific record.`;
    fragment.append(note);
  }

  elements["person-list"].replaceChildren(fragment);
}

function placeDraftFromForm() {
  return {
    id: elements["place-id"].value || undefined,
    name: elements["place-name"].value,
    country: elements["place-country"].value,
    latitude: elements["place-latitude"].value,
    longitude: elements["place-longitude"].value,
    precision: elements["place-precision"].value,
    verificationStatus: elements["place-verification-status"].value,
    source: elements["place-source"].value,
    sourceId: elements["place-source-id"].value,
    notes: elements["place-notes"].value
  };
}

function clearPlaceForm() {
  state.selectedPlaceId = null;
  elements["place-form"].reset();
  elements["place-id"].value = "";
  elements["place-editor-title"].textContent = "New place";
  elements["place-id-badge"].textContent = "Unsaved";
  elements["place-verification-status"].value = "unverified";
  elements["place-precision"].value = "locality";
  elements["delete-place-button"].disabled = true;
  state.suppressMapUpdate = true;
  adminMap.setEditableLocation(20, 0, false);
  adminMap.zoomToRegion("world", false);
  state.suppressMapUpdate = false;
  validatePlaceForm();
  renderPlaceList();
}

function loadPlaceIntoForm(placeId) {
  const place = state.places.find(item => item.id === placeId);
  if (!place) return;

  state.selectedPlaceId = place.id;
  elements["place-id"].value = place.id;
  elements["place-name"].value = place.name || "";
  elements["place-country"].value = place.country || "";
  elements["place-latitude"].value = place.latitude ?? "";
  elements["place-longitude"].value = place.longitude ?? "";
  elements["place-precision"].value = place.precision || "locality";
  elements["place-verification-status"].value = place.verificationStatus || "unverified";
  elements["place-source"].value = place.source || "";
  elements["place-source-id"].value = place.sourceId || "";
  elements["place-notes"].value = place.notes || "";
  elements["place-editor-title"].textContent = formatPlace(place);
  elements["place-id-badge"].textContent = place.id;
  elements["delete-place-button"].disabled = false;

  state.suppressMapUpdate = true;
  adminMap.setEditableLocation(Number(place.latitude), Number(place.longitude), false);
  adminMap.focusEditableLocation(false);
  state.suppressMapUpdate = false;

  validatePlaceForm();
  renderPlaceList();
}

function validatePlaceDraft(draft) {
  const errors = [];
  const warnings = [];
  const latitude = Number(draft.latitude);
  const longitude = Number(draft.longitude);

  if (!draft.name.trim()) errors.push("A place name is required.");
  if (!draft.country.trim()) errors.push("A country or territory is required.");
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.push("Latitude must be between -90 and 90.");
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.push("Longitude must be between -180 and 180.");

  const duplicate = state.places.find(place =>
    place.id !== draft.id &&
    normalizeText(place.name) === normalizeText(draft.name) &&
    normalizeText(place.country) === normalizeText(draft.country)
  );

  if (duplicate) warnings.push(`A matching place already exists: ${duplicate.id}. Reuse it instead of creating a duplicate.`);
  if (draft.verificationStatus !== "manually_verified") warnings.push("This place remains in the review queue until it is manually verified.");
  if (!draft.source.trim()) warnings.push("Add a source so the coordinate can be checked later.");

  return { errors, warnings };
}

function renderValidation(target, { errors = [], warnings = [], success = "" }) {
  const fragment = document.createDocumentFragment();

  if (errors.length > 0) {
    const heading = document.createElement("strong");
    heading.className = "validation-error";
    heading.textContent = "Cannot save:";
    fragment.append(heading);
    const list = document.createElement("ul");
    list.className = "validation-error";
    errors.forEach(error => {
      const item = document.createElement("li");
      item.textContent = error;
      list.append(item);
    });
    fragment.append(list);
  }

  if (warnings.length > 0) {
    const heading = document.createElement("strong");
    heading.className = "validation-warning";
    heading.textContent = "Review:";
    fragment.append(heading);
    const list = document.createElement("ul");
    list.className = "validation-warning";
    warnings.forEach(warning => {
      const item = document.createElement("li");
      item.textContent = warning;
      list.append(item);
    });
    fragment.append(list);
  }

  if (success) {
    const paragraph = document.createElement("p");
    paragraph.className = "validation-success";
    paragraph.textContent = success;
    fragment.append(paragraph);
  }

  target.replaceChildren(fragment);
}

function validatePlaceForm() {
  const result = validatePlaceDraft(placeDraftFromForm());
  renderValidation(elements["place-validation"], result);
  return result;
}

async function savePlace(event) {
  event.preventDefault();
  const draft = placeDraftFromForm();
  const validation = validatePlaceDraft(draft);
  if (validation.errors.length > 0) {
    renderValidation(elements["place-validation"], validation);
    return;
  }
  const saved = await putRecord(PLACES_STORE, draft);
  state.selectedPlaceId = saved.id;
  await reloadData();
  loadPlaceIntoForm(saved.id);
  renderValidation(elements["place-validation"], { warnings: validation.warnings, success: "Place saved." });
}

async function removeSelectedPlace() {
  if (!state.selectedPlaceId) return;
  const linkedPeople = state.persons.filter(person => person.birthPlaceId === state.selectedPlaceId || person.deathPlaceId === state.selectedPlaceId);
  if (linkedPeople.length > 0) {
    renderValidation(elements["place-validation"], { errors: [`This place is used by ${linkedPeople.length} person record(s). Update those people before deleting it.`] });
    return;
  }
  if (!confirm("Delete this place?")) return;
  await deleteRecord(PLACES_STORE, state.selectedPlaceId);
  clearPlaceForm();
  await reloadData();
}

function selectNextPlaceToReview() {
  const place = state.places.find(item => item.verificationStatus !== "manually_verified");
  if (place) {
    loadPlaceIntoForm(place.id);
  } else {
    renderValidation(elements["place-validation"], { success: "Every place is manually verified." });
  }
}

function personDraftFromForm() {
  return {
    id: elements["person-id"].value || undefined,
    name: elements["person-name"].value,
    period: elements["person-period"].value,
    birthYear: elements["person-birth-year"].value,
    deathYear: elements["person-death-year"].value,
    birthPlaceId: elements["birth-place-id"].value,
    deathPlaceId: elements["death-place-id"].value,
    difficulty: elements["person-difficulty"].value,
    published: elements["person-published"].checked,
    acceptedAnswers: elements["person-accepted-answers"].value
      .split(/\r?\n/)
      .map(value => value.trim())
      .filter(Boolean),
    tags: elements["person-tags"].value
      .split(/\r?\n|,/)
      .map(value => normalizeText(value))
      .filter(Boolean)
  };
}

function clearPersonForm() {
  state.selectedPersonId = null;
  elements["person-form"].reset();
  elements["person-id"].value = "";
  elements["birth-place-id"].value = "";
  elements["death-place-id"].value = "";
  elements["birth-place-selected"].textContent = "No place selected";
  elements["death-place-selected"].textContent = "No place selected";
  elements["person-editor-title"].textContent = "New person";
  elements["person-id-badge"].textContent = "Unsaved";
  elements["person-difficulty"].value = "1";
  elements["delete-person-button"].disabled = true;
  renderValidation(elements["person-validation"], {});
  renderPersonList();
}

function setPickerSelection(prefix, placeId) {
  const place = state.places.find(item => item.id === placeId);
  elements[`${prefix}-place-id`].value = place?.id || "";
  elements[`${prefix}-place-selected`].textContent = place ? `${place.name}, ${place.country} · ${place.verificationStatus.replaceAll("_", " ")}` : "No place selected";
  elements[`${prefix}-place-search`].value = "";
  elements[`${prefix}-place-suggestions`].replaceChildren();
}

function loadPersonIntoForm(personId) {
  const person = state.persons.find(item => item.id === personId);
  if (!person) return;
  state.selectedPersonId = person.id;
  elements["person-id"].value = person.id;
  elements["person-name"].value = person.name;
  elements["person-period"].value = person.period;
  elements["person-birth-year"].value = person.birthYear;
  elements["person-death-year"].value = person.deathYear;
  elements["person-difficulty"].value = person.difficulty || 1;
  elements["person-published"].checked = Boolean(person.published);
  elements["person-accepted-answers"].value = (person.acceptedAnswers || []).join("\n");
  elements["person-tags"].value = (person.tags || []).join("\n");
  setPickerSelection("birth", person.birthPlaceId);
  setPickerSelection("death", person.deathPlaceId);
  elements["person-editor-title"].textContent = person.name;
  elements["person-id-badge"].textContent = person.id;
  elements["delete-person-button"].disabled = false;
  validatePersonForm();
  renderPersonList();
}

function validatePersonDraft(draft) {
  const errors = [];
  const warnings = [];
  if (!draft.name.trim()) errors.push("A full name is required.");
  if (!draft.period.trim()) errors.push("A historical period is required.");
  if (!Number.isFinite(Number(draft.birthYear))) errors.push("A valid birth year is required.");
  if (!Number.isFinite(Number(draft.deathYear))) errors.push("A valid death year is required.");

  const birthPlace = state.places.find(place => place.id === draft.birthPlaceId);
  const deathPlace = state.places.find(place => place.id === draft.deathPlaceId);
  if (!birthPlace) errors.push("Select a birthplace from the place registry.");
  if (!deathPlace) errors.push("Select a place of death from the place registry.");

  [birthPlace, deathPlace].filter(Boolean).forEach(place => {
    if (place.verificationStatus !== "manually_verified") warnings.push(`${place.name} has not been manually verified.`);
  });
  if (!draft.published) warnings.push("This person will not appear in the game until Published is enabled.");
  if (draft.acceptedAnswers.length === 0) warnings.push("Add at least one shorter accepted answer, such as a surname.");
  return { errors, warnings };
}

function validatePersonForm() {
  const result = validatePersonDraft(personDraftFromForm());
  renderValidation(elements["person-validation"], result);
  return result;
}

async function savePerson(event) {
  event.preventDefault();
  const draft = personDraftFromForm();
  const validation = validatePersonDraft(draft);
  if (validation.errors.length > 0) {
    renderValidation(elements["person-validation"], validation);
    return;
  }
  const saved = await putRecord(PERSONS_STORE, draft);
  state.selectedPersonId = saved.id;
  await reloadData();
  loadPersonIntoForm(saved.id);
  renderValidation(elements["person-validation"], { warnings: validation.warnings, success: "Person saved." });
}

async function removeSelectedPerson() {
  if (!state.selectedPersonId) return;
  if (!confirm("Delete this person?")) return;
  await deleteRecord(PERSONS_STORE, state.selectedPersonId);
  clearPersonForm();
  await reloadData();
}

function setupPlacePicker(prefix) {
  const input = elements[`${prefix}-place-search`];
  const suggestionList = elements[`${prefix}-place-suggestions`];
  input.addEventListener("input", () => {
    const query = normalizeText(input.value);
    if (!query) {
      suggestionList.replaceChildren();
      return;
    }
    const matches = state.places.filter(place =>
      normalizeText([place.name, place.country, place.id].filter(Boolean).join(" ")).includes(query)
    ).slice(0, 10);
    const fragment = document.createDocumentFragment();
    matches.forEach(place => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "suggestion-button";
      button.textContent = `${place.name}, ${place.country} · ${place.verificationStatus.replaceAll("_", " ")}`;
      button.addEventListener("click", () => {
        setPickerSelection(prefix, place.id);
        validatePersonForm();
      });
      fragment.append(button);
    });
    suggestionList.replaceChildren(fragment);
  });
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function recordsToCsv(records, columns) {
  const lines = [columns.map(csvEscape).join(",")];
  records.forEach(record => {
    lines.push(columns.map(column => {
      const value = record[column];
      if (Array.isArray(value)) return csvEscape(value.join("|"));
      return csvEscape(value);
    }).join(","));
  });
  return lines.join("\n");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  row.push(field);
  if (row.some(value => value.length > 0)) rows.push(row);
  if (rows.length === 0) return [];

  const headers = rows[0].map(header => header.trim());
  return rows.slice(1).map(values => Object.fromEntries(
    headers.map((header, index) => [header, values[index] ?? ""])
  ));
}

async function readFile(file) {
  if (!file) throw new Error("Choose a file first.");
  return file.text();
}

function setTransferStatus({ errors = [], warnings = [], success = "" }) {
  renderValidation(elements["transfer-status"], { errors, warnings, success });
}

async function exportJson() {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    places: state.places,
    persons: state.persons
  };
  downloadText("historical-map-database.json", JSON.stringify(backup, null, 2), "application/json");
}

async function importPlacesCsv() {
  try {
    const text = await readFile(elements["import-places-file"].files[0]);
    const rows = parseCsv(text);
    const records = [];
    const errors = [];
    rows.forEach((row, index) => {
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);
      if (!row.name || !row.country || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        errors.push(`Row ${index + 2}: name, country, latitude and longitude are required.`);
        return;
      }
      records.push({
        id: row.id || makeId("place"),
        name: row.name,
        country: row.country,
        latitude,
        longitude,
        precision: row.precision || "locality",
        verificationStatus: row.verification_status || row.verificationStatus || "automatically_matched",
        source: row.source || "",
        sourceId: row.source_id || row.sourceId || "",
        notes: row.notes || ""
      });
    });
    if (errors.length > 0) {
      setTransferStatus({ errors });
      return;
    }
    await bulkPut(PLACES_STORE, records);
    await reloadData();
    setTransferStatus({ success: `${records.length} place record(s) imported.` });
  } catch (error) {
    setTransferStatus({ errors: [error.message] });
  }
}

async function importPersonsCsv() {
  try {
    const text = await readFile(elements["import-persons-file"].files[0]);
    const rows = parseCsv(text);
    const placeIds = new Set(state.places.map(place => place.id));
    const records = [];
    const errors = [];

    rows.forEach((row, index) => {
      const birthPlaceId = row.birth_place_id || row.birthPlaceId;
      const deathPlaceId = row.death_place_id || row.deathPlaceId;
      if (!row.name || !placeIds.has(birthPlaceId) || !placeIds.has(deathPlaceId)) {
        errors.push(`Row ${index + 2}: name and valid birth/death place IDs are required.`);
        return;
      }
      records.push({
        id: row.id || makeId("person"),
        name: row.name,
        acceptedAnswers: (row.accepted_answers || row.acceptedAnswers || "").split("|").map(value => value.trim()).filter(Boolean),
        tags: (row.tags || "").split("|").map(value => normalizeText(value)).filter(Boolean),
        period: row.period || "",
        birthYear: Number(row.birth_year ?? row.birthYear),
        deathYear: Number(row.death_year ?? row.deathYear),
        birthPlaceId,
        deathPlaceId,
        difficulty: Number(row.difficulty || 1),
        published: ["true", "1", "yes"].includes(String(row.published).trim().toLowerCase())
      });
    });
    if (errors.length > 0) {
      setTransferStatus({ errors });
      return;
    }
    await bulkPut(PERSONS_STORE, records);
    await reloadData();
    setTransferStatus({ success: `${records.length} person record(s) imported.` });
  } catch (error) {
    setTransferStatus({ errors: [error.message] });
  }
}

async function importJsonBackup() {
  try {
    const text = await readFile(elements["import-json-file"].files[0]);
    const backup = JSON.parse(text);
    if (!Array.isArray(backup.places) || !Array.isArray(backup.persons)) {
      throw new Error("The JSON file is not a valid database backup.");
    }
    if (!confirm("Replace the current browser database with this backup?")) return;
    await clearStore(PERSONS_STORE);
    await clearStore(PLACES_STORE);
    await bulkPut(PLACES_STORE, backup.places);
    await bulkPut(PERSONS_STORE, backup.persons);
    await reloadData();
    clearPlaceForm();
    clearPersonForm();
    setTransferStatus({ success: "JSON backup restored." });
  } catch (error) {
    setTransferStatus({ errors: [error.message] });
  }
}

function setupEvents() {
  document.querySelectorAll(".tab-button").forEach(button => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  elements["place-search"].addEventListener("input", renderPlaceList);
  elements["place-status-filter"].addEventListener("change", renderPlaceList);
  elements["person-search"].addEventListener("input", renderPersonList);
  elements["new-place-button"].addEventListener("click", clearPlaceForm);
  elements["next-review-button"].addEventListener("click", selectNextPlaceToReview);
  elements["place-form"].addEventListener("submit", savePlace);
  elements["delete-place-button"].addEventListener("click", removeSelectedPlace);
  elements["new-person-button"].addEventListener("click", clearPersonForm);
  elements["person-form"].addEventListener("submit", savePerson);
  elements["delete-person-button"].addEventListener("click", removeSelectedPerson);

  ["place-name", "place-country", "place-latitude", "place-longitude", "place-source", "place-verification-status"].forEach(id => {
    elements[id].addEventListener("input", async () => {
      const latitude = Number(elements["place-latitude"].value);
      const longitude = Number(elements["place-longitude"].value);
      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        state.suppressMapUpdate = true;
        adminMap.setEditableLocation(latitude, longitude, false);
        state.suppressMapUpdate = false;
      }
      validatePlaceForm();
    });
  });

  ["person-name", "person-period", "person-birth-year", "person-death-year", "person-accepted-answers", "person-tags", "person-published"].forEach(id => {
    elements[id].addEventListener("input", validatePersonForm);
  });

  elements["export-json-button"].addEventListener("click", exportJson);
  elements["export-places-csv-button"].addEventListener("click", () => {
    const exportRecords = state.places.map(place => ({
      id: place.id,
      name: place.name,
      country: place.country,
      latitude: place.latitude,
      longitude: place.longitude,
      precision: place.precision,
      verification_status: place.verificationStatus,
      source: place.source,
      source_id: place.sourceId,
      notes: place.notes
    }));
    downloadText("places.csv", recordsToCsv(exportRecords, ["id", "name", "country", "latitude", "longitude", "precision", "verification_status", "source", "source_id", "notes"]), "text/csv");
  });
  elements["export-persons-csv-button"].addEventListener("click", () => {
    const exportRecords = state.persons.map(person => ({
      id: person.id,
      name: person.name,
      accepted_answers: person.acceptedAnswers,
      tags: person.tags,
      period: person.period,
      birth_year: person.birthYear,
      death_year: person.deathYear,
      birth_place_id: person.birthPlaceId,
      death_place_id: person.deathPlaceId,
      difficulty: person.difficulty,
      published: person.published
    }));
    downloadText("persons.csv", recordsToCsv(exportRecords, ["id", "name", "accepted_answers", "tags", "period", "birth_year", "death_year", "birth_place_id", "death_place_id", "difficulty", "published"]), "text/csv");
  });
  elements["import-places-button"].addEventListener("click", importPlacesCsv);
  elements["import-persons-button"].addEventListener("click", importPersonsCsv);
  elements["import-json-button"].addEventListener("click", importJsonBackup);
  elements["reset-database-button"].addEventListener("click", async () => {
    if (!confirm("Reset all local data to the original demo records?")) return;
    await resetDatabase();
    await reloadData();
    clearPlaceForm();
    clearPersonForm();
    setTransferStatus({ success: "The demo database was restored." });
  });

  setupPlacePicker("birth");
  setupPlacePicker("death");

  document.querySelectorAll("[data-admin-region]").forEach(button => {
    button.addEventListener("click", async () => {
      document.querySelectorAll("[data-admin-region]").forEach(item => item.classList.remove("active"));
      button.classList.add("active");
      await adminMap.zoomToRegion(button.dataset.adminRegion);
    });
  });
}

async function boot() {
  try {
    await initializeDatabase();
    setupEvents();
    await reloadData();
    clearPlaceForm();
    clearPersonForm();
  } catch (error) {
    console.error(error);
    setTransferStatus({ errors: ["The local database could not be opened. Run the project through Live Server."] });
  }
}

boot();
