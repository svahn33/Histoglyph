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

import {
  calculateApproximateMapPosition,
  distanceBetweenMapPositions,
  positionMarker
} from "./map.js";

const state = {
  places: [],
  persons: [],
  selectedPlaceId: null,
  selectedPersonId: null,
  editablePosition: { x: 50, y: 50 }
};

const elements = Object.fromEntries(
  [...document.querySelectorAll("[id]")]
    .map(element => [element.id, element])
);

function setActiveTab(tabName) {
  for (const button of document.querySelectorAll(".tab-button")) {
    button.classList.toggle(
      "active",
      button.dataset.tab === tabName
    );
  }

  for (const panel of document.querySelectorAll(".tab-panel")) {
    panel.hidden =
      panel.id !== `tab-${tabName}`;
  }
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

function createRecordButton({
  title,
  subtitle,
  status,
  active,
  onClick
}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className =
    `record-item${active ? " active" : ""}`;

  const strong = document.createElement("strong");
  strong.textContent = title;

  const span = document.createElement("span");

  if (status) {
    const dot = document.createElement("i");
    dot.className =
      `status-dot status-${status}`;
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

  state.places = places.sort(
    (a, b) =>
      a.name.localeCompare(b.name, "en")
  );

  state.persons = persons.sort(
    (a, b) =>
      a.name.localeCompare(b.name, "en")
  );

  refreshMetrics();
  renderPlaceList();
  renderPersonList();
}

function refreshMetrics() {
  elements["metric-places"].textContent =
    state.places.length;

  elements["metric-verified"].textContent =
    state.places.filter(
      place =>
        place.verificationStatus ===
        "manually_verified"
    ).length;

  elements["metric-review"].textContent =
    state.places.filter(
      place =>
        place.verificationStatus !==
        "manually_verified"
    ).length;

  elements["metric-persons"].textContent =
    state.persons.length;
}

function renderPlaceList() {
  const query = normalizeText(
    elements["place-search"].value
  );

  const status =
    elements["place-status-filter"].value;

  const matches = state.places.filter(place => {
    const matchesText =
      !query ||
      place.searchText.includes(query);

    const matchesStatus =
      status === "all" ||
      place.verificationStatus === status;

    return matchesText && matchesStatus;
  });

  const fragment = document.createDocumentFragment();
  const visibleMatches = matches.slice(0, 300);

  for (const place of visibleMatches) {
    fragment.append(
      createRecordButton({
        title: place.name,
        subtitle:
          `${place.country} · ${place.verificationStatus.replaceAll("_", " ")}`,
        status: place.verificationStatus,
        active:
          place.id === state.selectedPlaceId,
        onClick: () => loadPlaceIntoForm(place.id)
      })
    );
  }

  if (matches.length > visibleMatches.length) {
    const note = document.createElement("p");
    note.className = "record-limit-note";
    note.textContent =
      `Showing the first ${visibleMatches.length} of ${matches.length} places. Refine the search to see a specific record.`;
    fragment.append(note);
  }

  elements["place-list"].replaceChildren(fragment);
}

function renderPersonList() {
  const query = normalizeText(
    elements["person-search"].value
  );

  const matches = state.persons.filter(
    person =>
      !query ||
      person.searchText.includes(query)
  );

  const places = new Map(
    state.places.map(place => [place.id, place])
  );

  const fragment = document.createDocumentFragment();
  const visibleMatches = matches.slice(0, 300);

  for (const person of visibleMatches) {
    const birthPlace =
      places.get(person.birthPlaceId);
    const deathPlace =
      places.get(person.deathPlaceId);

    fragment.append(
      createRecordButton({
        title: person.name,
        subtitle:
          `${birthPlace?.name || "Missing place"} → ${deathPlace?.name || "Missing place"}`,
        active:
          person.id === state.selectedPersonId,
        onClick: () =>
          loadPersonIntoForm(person.id)
      })
    );
  }

  if (matches.length > visibleMatches.length) {
    const note = document.createElement("p");
    note.className = "record-limit-note";
    note.textContent =
      `Showing the first ${visibleMatches.length} of ${matches.length} people. Refine the search to see a specific record.`;
    fragment.append(note);
  }

  elements["person-list"].replaceChildren(fragment);
}

function placeDraftFromForm() {
  return {
    id: elements["place-id"].value || undefined,
    name: elements["place-name"].value,
    historicalName:
      elements["place-historical-name"].value,
    country: elements["place-country"].value,
    countryCode:
      elements["place-country-code"].value,
    latitude:
      elements["place-latitude"].value,
    longitude:
      elements["place-longitude"].value,
    precision:
      elements["place-precision"].value,
    verificationStatus:
      elements["place-verification-status"].value,
    source: elements["place-source"].value,
    sourceId:
      elements["place-source-id"].value,
    notes: elements["place-notes"].value,
    mapX: elements["place-map-x"].value,
    mapY: elements["place-map-y"].value
  };
}

function updateCalculatedMarker() {
  const latitude = Number(
    elements["place-latitude"].value
  );
  const longitude = Number(
    elements["place-longitude"].value
  );

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude)
  ) {
    return;
  }

  const position =
    calculateApproximateMapPosition(
      latitude,
      longitude
    );

  positionMarker(
    elements["calculated-marker"],
    position
  );
}

function setEditablePosition(position) {
  const nextX = Number(position.x);
  const nextY = Number(position.y);

  if (
    !Number.isFinite(nextX) ||
    !Number.isFinite(nextY)
  ) {
    return;
  }

  state.editablePosition = {
    x: Math.max(0, Math.min(100, nextX)),
    y: Math.max(0, Math.min(100, nextY))
  };

  elements["place-map-x"].value =
    state.editablePosition.x.toFixed(5);

  elements["place-map-y"].value =
    state.editablePosition.y.toFixed(5);

  positionMarker(
    elements["editable-marker"],
    state.editablePosition
  );
}

function useCalculatedPosition() {
  const position =
    calculateApproximateMapPosition(
      Number(elements["place-latitude"].value),
      Number(elements["place-longitude"].value)
    );

  setEditablePosition(position);
  validatePlaceForm();
}

function clearPlaceForm() {
  state.selectedPlaceId = null;

  elements["place-form"].reset();
  elements["place-id"].value = "";
  elements["place-editor-title"].textContent =
    "New place";
  elements["place-id-badge"].textContent =
    "Unsaved";
  elements["place-verification-status"].value =
    "unverified";
  elements["place-precision"].value =
    "locality";
  elements["delete-place-button"].disabled = true;

  setEditablePosition({ x: 50, y: 50 });
  updateCalculatedMarker();
  validatePlaceForm();
  renderPlaceList();
}

function loadPlaceIntoForm(placeId) {
  const place = state.places.find(
    item => item.id === placeId
  );

  if (!place) {
    return;
  }

  state.selectedPlaceId = place.id;

  elements["place-id"].value = place.id;
  elements["place-name"].value = place.name;
  elements["place-historical-name"].value =
    place.historicalName || "";
  elements["place-country"].value =
    place.country || "";
  elements["place-country-code"].value =
    place.countryCode || "";
  elements["place-latitude"].value =
    place.latitude;
  elements["place-longitude"].value =
    place.longitude;
  elements["place-precision"].value =
    place.precision || "locality";
  elements["place-verification-status"].value =
    place.verificationStatus || "unverified";
  elements["place-source"].value =
    place.source || "";
  elements["place-source-id"].value =
    place.sourceId || "";
  elements["place-notes"].value =
    place.notes || "";

  setEditablePosition({
    x: Number(place.mapX),
    y: Number(place.mapY)
  });

  updateCalculatedMarker();

  elements["place-editor-title"].textContent =
    formatPlace(place);
  elements["place-id-badge"].textContent =
    place.id;
  elements["delete-place-button"].disabled =
    false;

  validatePlaceForm();
  renderPlaceList();
}

function validatePlaceDraft(draft) {
  const errors = [];
  const warnings = [];

  const latitude = Number(draft.latitude);
  const longitude = Number(draft.longitude);
  const mapX = Number(draft.mapX);
  const mapY = Number(draft.mapY);

  if (!draft.name.trim()) {
    errors.push("A place name is required.");
  }

  if (!draft.country.trim()) {
    errors.push("A country or territory is required.");
  }

  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {
    errors.push(
      "Latitude must be between -90 and 90."
    );
  }

  if (
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {
    errors.push(
      "Longitude must be between -180 and 180."
    );
  }

  if (
    !Number.isFinite(mapX) ||
    mapX < 0 ||
    mapX > 100 ||
    !Number.isFinite(mapY) ||
    mapY < 0 ||
    mapY > 100
  ) {
    errors.push(
      "The saved map position must be between 0 and 100 percent."
    );
  }

  const normalizedName = normalizeText(draft.name);
  const normalizedCountry =
    normalizeText(draft.country);

  const duplicate = state.places.find(
    place =>
      place.id !== draft.id &&
      normalizeText(place.name) === normalizedName &&
      normalizeText(place.country) === normalizedCountry
  );

  if (duplicate) {
    warnings.push(
      `A matching place already exists: ${duplicate.id}. Reuse it instead of creating a duplicate.`
    );
  }

  if (
    draft.verificationStatus !==
    "manually_verified"
  ) {
    warnings.push(
      "This place remains in the review queue until it is manually verified."
    );
  }

  if (!draft.source.trim()) {
    warnings.push(
      "Add a source so the coordinate can be checked later."
    );
  }

  if (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    Number.isFinite(mapX) &&
    Number.isFinite(mapY)
  ) {
    const calculated =
      calculateApproximateMapPosition(
        latitude,
        longitude
      );

    const distance =
      distanceBetweenMapPositions(
        calculated,
        { x: mapX, y: mapY }
      );

    if (distance > 8) {
      warnings.push(
        "The saved marker is far from the automatic coordinate suggestion. Check that the map was not clicked accidentally."
      );
    }
  }

  return { errors, warnings };
}

function renderValidation(
  target,
  { errors = [], warnings = [], success = "" }
) {
  const fragment = document.createDocumentFragment();

  if (errors.length > 0) {
    const heading = document.createElement("strong");
    heading.className = "validation-error";
    heading.textContent = "Cannot save:";
    fragment.append(heading);

    const list = document.createElement("ul");
    list.className = "validation-error";

    for (const error of errors) {
      const item = document.createElement("li");
      item.textContent = error;
      list.append(item);
    }

    fragment.append(list);
  }

  if (warnings.length > 0) {
    const heading = document.createElement("strong");
    heading.className = "validation-warning";
    heading.textContent = "Review:";
    fragment.append(heading);

    const list = document.createElement("ul");
    list.className = "validation-warning";

    for (const warning of warnings) {
      const item = document.createElement("li");
      item.textContent = warning;
      list.append(item);
    }

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
  const result = validatePlaceDraft(
    placeDraftFromForm()
  );

  renderValidation(
    elements["place-validation"],
    result
  );

  return result;
}

async function savePlace(event) {
  event.preventDefault();

  const draft = placeDraftFromForm();
  const validation = validatePlaceDraft(draft);

  if (validation.errors.length > 0) {
    renderValidation(
      elements["place-validation"],
      validation
    );
    return;
  }

  const saved = await putRecord(
    PLACES_STORE,
    draft
  );

  state.selectedPlaceId = saved.id;
  await reloadData();
  loadPlaceIntoForm(saved.id);

  renderValidation(
    elements["place-validation"],
    {
      warnings: validation.warnings,
      success:
        "Place saved. Every person linked to this place will now use this map position."
    }
  );
}

async function removeSelectedPlace() {
  if (!state.selectedPlaceId) {
    return;
  }

  const linkedPeople = state.persons.filter(
    person =>
      person.birthPlaceId ===
        state.selectedPlaceId ||
      person.deathPlaceId ===
        state.selectedPlaceId
  );

  if (linkedPeople.length > 0) {
    renderValidation(
      elements["place-validation"],
      {
        errors: [
          `This place is used by ${linkedPeople.length} person record(s). Update those people before deleting it.`
        ]
      }
    );
    return;
  }

  if (!confirm("Delete this place?")) {
    return;
  }

  await deleteRecord(
    PLACES_STORE,
    state.selectedPlaceId
  );

  clearPlaceForm();
  await reloadData();
}

function selectNextPlaceToReview() {
  const place = state.places.find(
    item =>
      item.verificationStatus !==
      "manually_verified"
  );

  if (place) {
    loadPlaceIntoForm(place.id);
  } else {
    renderValidation(
      elements["place-validation"],
      {
        success:
          "Every place is manually verified."
      }
    );
  }
}

function eventToMapPosition(event) {
  const rectangle =
    elements["editor-map"].getBoundingClientRect();

  return {
    x:
      (event.clientX - rectangle.left) /
      rectangle.width *
      100,
    y:
      (event.clientY - rectangle.top) /
      rectangle.height *
      100
  };
}

function setupMapEditor() {
  let dragging = false;

  elements["editor-map"].addEventListener(
    "pointerdown",
    event => {
      dragging = true;
      elements["editor-map"].setPointerCapture(
        event.pointerId
      );
      setEditablePosition(
        eventToMapPosition(event)
      );
      validatePlaceForm();
    }
  );

  elements["editor-map"].addEventListener(
    "pointermove",
    event => {
      if (!dragging) {
        return;
      }

      setEditablePosition(
        eventToMapPosition(event)
      );
    }
  );

  const endDrag = event => {
    if (!dragging) {
      return;
    }

    dragging = false;

    if (
      elements["editor-map"].hasPointerCapture(
        event.pointerId
      )
    ) {
      elements["editor-map"].releasePointerCapture(
        event.pointerId
      );
    }

    validatePlaceForm();
  };

  elements["editor-map"].addEventListener(
    "pointerup",
    endDrag
  );
  elements["editor-map"].addEventListener(
    "pointercancel",
    endDrag
  );
}

function personDraftFromForm() {
  return {
    id: elements["person-id"].value || undefined,
    name: elements["person-name"].value,
    period: elements["person-period"].value,
    birthYear:
      elements["person-birth-year"].value,
    deathYear:
      elements["person-death-year"].value,
    birthPlaceId:
      elements["birth-place-id"].value,
    deathPlaceId:
      elements["death-place-id"].value,
    difficulty:
      elements["person-difficulty"].value,
    published:
      elements["person-published"].checked,
    acceptedAnswers:
      elements["person-accepted-answers"].value
        .split(/\r?\n/)
        .map(value => value.trim())
        .filter(Boolean)
  };
}

function clearPersonForm() {
  state.selectedPersonId = null;
  elements["person-form"].reset();
  elements["person-id"].value = "";
  elements["birth-place-id"].value = "";
  elements["death-place-id"].value = "";
  elements["birth-place-selected"].textContent =
    "No place selected";
  elements["death-place-selected"].textContent =
    "No place selected";
  elements["person-editor-title"].textContent =
    "New person";
  elements["person-id-badge"].textContent =
    "Unsaved";
  elements["person-difficulty"].value = "1";
  elements["delete-person-button"].disabled =
    true;
  renderValidation(
    elements["person-validation"],
    {}
  );
  renderPersonList();
}

function setPickerSelection(prefix, placeId) {
  const place = state.places.find(
    item => item.id === placeId
  );

  elements[`${prefix}-place-id`].value =
    place?.id || "";

  elements[`${prefix}-place-selected`].textContent =
    place
      ? `${place.name}, ${place.country} · ${place.verificationStatus.replaceAll("_", " ")}`
      : "No place selected";

  elements[`${prefix}-place-search`].value = "";
  elements[`${prefix}-place-suggestions`]
    .replaceChildren();
}

function loadPersonIntoForm(personId) {
  const person = state.persons.find(
    item => item.id === personId
  );

  if (!person) {
    return;
  }

  state.selectedPersonId = person.id;

  elements["person-id"].value = person.id;
  elements["person-name"].value =
    person.name;
  elements["person-period"].value =
    person.period;
  elements["person-birth-year"].value =
    person.birthYear;
  elements["person-death-year"].value =
    person.deathYear;
  elements["person-difficulty"].value =
    person.difficulty || 1;
  elements["person-published"].checked =
    Boolean(person.published);
  elements["person-accepted-answers"].value =
    (person.acceptedAnswers || []).join("\n");

  setPickerSelection(
    "birth",
    person.birthPlaceId
  );
  setPickerSelection(
    "death",
    person.deathPlaceId
  );

  elements["person-editor-title"].textContent =
    person.name;
  elements["person-id-badge"].textContent =
    person.id;
  elements["delete-person-button"].disabled =
    false;

  validatePersonForm();
  renderPersonList();
}

function validatePersonDraft(draft) {
  const errors = [];
  const warnings = [];

  if (!draft.name.trim()) {
    errors.push("A full name is required.");
  }

  if (!draft.period.trim()) {
    errors.push(
      "A historical period is required."
    );
  }

  if (!Number.isFinite(Number(draft.birthYear))) {
    errors.push("A valid birth year is required.");
  }

  if (!Number.isFinite(Number(draft.deathYear))) {
    errors.push("A valid death year is required.");
  }

  const birthPlace = state.places.find(
    place => place.id === draft.birthPlaceId
  );

  const deathPlace = state.places.find(
    place => place.id === draft.deathPlaceId
  );

  if (!birthPlace) {
    errors.push(
      "Select a birthplace from the place registry."
    );
  }

  if (!deathPlace) {
    errors.push(
      "Select a place of death from the place registry."
    );
  }

  for (const place of [birthPlace, deathPlace].filter(Boolean)) {
    if (
      place.verificationStatus !==
      "manually_verified"
    ) {
      warnings.push(
        `${place.name} has not been manually verified.`
      );
    }
  }

  if (!draft.published) {
    warnings.push(
      "This person will not appear in the game until Published is enabled."
    );
  }

  if (draft.acceptedAnswers.length === 0) {
    warnings.push(
      "Add at least one shorter accepted answer, such as a surname."
    );
  }

  return { errors, warnings };
}

function validatePersonForm() {
  const result = validatePersonDraft(
    personDraftFromForm()
  );

  renderValidation(
    elements["person-validation"],
    result
  );

  return result;
}

async function savePerson(event) {
  event.preventDefault();

  const draft = personDraftFromForm();
  const validation =
    validatePersonDraft(draft);

  if (validation.errors.length > 0) {
    renderValidation(
      elements["person-validation"],
      validation
    );
    return;
  }

  const saved = await putRecord(
    PERSONS_STORE,
    draft
  );

  state.selectedPersonId = saved.id;
  await reloadData();
  loadPersonIntoForm(saved.id);

  renderValidation(
    elements["person-validation"],
    {
      warnings: validation.warnings,
      success: "Person saved."
    }
  );
}

async function removeSelectedPerson() {
  if (!state.selectedPersonId) {
    return;
  }

  if (!confirm("Delete this person?")) {
    return;
  }

  await deleteRecord(
    PERSONS_STORE,
    state.selectedPersonId
  );

  clearPersonForm();
  await reloadData();
}

function setupPlacePicker(prefix) {
  const input =
    elements[`${prefix}-place-search`];
  const suggestionList =
    elements[`${prefix}-place-suggestions`];

  input.addEventListener("input", () => {
    const query = normalizeText(input.value);

    if (!query) {
      suggestionList.replaceChildren();
      return;
    }

    const matches = state.places
      .filter(place =>
        place.searchText.includes(query)
      )
      .slice(0, 10);

    const fragment =
      document.createDocumentFragment();

    for (const place of matches) {
      const button =
        document.createElement("button");

      button.type = "button";
      button.className = "suggestion-button";
      button.textContent =
        `${place.name}, ${place.country} · ${place.verificationStatus.replaceAll("_", " ")}`;

      button.addEventListener("click", () => {
        setPickerSelection(prefix, place.id);
        validatePersonForm();
      });

      fragment.append(button);
    }

    suggestionList.replaceChildren(fragment);
  });
}

function csvEscape(value) {
  const text = String(value ?? "");

  if (
    text.includes(",") ||
    text.includes('"') ||
    text.includes("\n")
  ) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function recordsToCsv(records, columns) {
  const lines = [
    columns.map(column => csvEscape(column)).join(",")
  ];

  for (const record of records) {
    lines.push(
      columns
        .map(column => {
          const value = record[column];

          if (Array.isArray(value)) {
            return csvEscape(value.join("|"));
          }

          return csvEscape(value);
        })
        .join(",")
    );
  }

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
      if (
        character === '"' &&
        text[index + 1] === '"'
      ) {
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

  if (row.some(value => value.length > 0)) {
    rows.push(row);
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(header =>
    header.trim()
  );

  return rows.slice(1).map(values =>
    Object.fromEntries(
      headers.map((header, index) => [
        header,
        values[index] ?? ""
      ])
    )
  );
}

async function readFile(file) {
  if (!file) {
    throw new Error("Choose a file first.");
  }

  return file.text();
}

function setTransferStatus({
  errors = [],
  warnings = [],
  success = ""
}) {
  renderValidation(
    elements["transfer-status"],
    { errors, warnings, success }
  );
}

async function exportJson() {
  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    places: state.places,
    persons: state.persons
  };

  downloadText(
    "historical-map-database.json",
    JSON.stringify(backup, null, 2),
    "application/json"
  );
}

async function importPlacesCsv() {
  try {
    const text = await readFile(
      elements["import-places-file"].files[0]
    );

    const rows = parseCsv(text);
    const records = [];
    const errors = [];

    const existingPlaceIds = new Map(
      state.places.map(place => [
        `${normalizeText(place.name)}|${normalizeText(place.country)}`,
        place.id
      ])
    );

    rows.forEach((row, index) => {
      const latitude = Number(row.latitude);
      const longitude = Number(row.longitude);

      if (
        !row.name ||
        !row.country ||
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
      ) {
        errors.push(
          `Row ${index + 2}: name, country, latitude and longitude are required.`
        );
        return;
      }

      const calculated =
        calculateApproximateMapPosition(
          latitude,
          longitude
        );

      const existingId = existingPlaceIds.get(
        `${normalizeText(row.name)}|${normalizeText(row.country)}`
      );

      records.push({
        id: row.id || existingId || makeId("place"),
        name: row.name,
        historicalName:
          row.historical_name ||
          row.historicalName ||
          "",
        countryCode:
          row.country_code ||
          row.countryCode ||
          "",
        country: row.country,
        latitude,
        longitude,
        mapX:
          (row.map_x ?? row.mapX ?? "") === ""
            ? calculated.x
            : Number(row.map_x ?? row.mapX),
        mapY:
          (row.map_y ?? row.mapY ?? "") === ""
            ? calculated.y
            : Number(row.map_y ?? row.mapY),
        precision:
          row.precision || "locality",
        verificationStatus:
          row.verification_status ||
          row.verificationStatus ||
          "automatically_matched",
        source: row.source || "",
        sourceId:
          row.source_id ||
          row.sourceId ||
          "",
        notes: row.notes || ""
      });
    });

    if (errors.length > 0) {
      setTransferStatus({ errors });
      return;
    }

    await bulkPut(PLACES_STORE, records);
    await reloadData();

    setTransferStatus({
      success:
        `${records.length} place record(s) imported. Review automatically matched places on the map before publishing linked people.`
    });
  } catch (error) {
    setTransferStatus({
      errors: [error.message]
    });
  }
}

async function importPersonsCsv() {
  try {
    const text = await readFile(
      elements["import-persons-file"].files[0]
    );

    const rows = parseCsv(text);
    const placeIds = new Set(
      state.places.map(place => place.id)
    );
    const records = [];
    const errors = [];

    rows.forEach((row, index) => {
      const birthPlaceId =
        row.birth_place_id ||
        row.birthPlaceId;

      const deathPlaceId =
        row.death_place_id ||
        row.deathPlaceId;

      if (
        !row.name ||
        !placeIds.has(birthPlaceId) ||
        !placeIds.has(deathPlaceId)
      ) {
        errors.push(
          `Row ${index + 2}: name and valid birth/death place IDs are required.`
        );
        return;
      }

      records.push({
        id: row.id || makeId("person"),
        name: row.name,
        acceptedAnswers:
          (
            row.accepted_answers ||
            row.acceptedAnswers ||
            ""
          )
            .split("|")
            .map(value => value.trim())
            .filter(Boolean),
        period: row.period || "",
        birthYear: Number(
          row.birth_year ?? row.birthYear
        ),
        deathYear: Number(
          row.death_year ?? row.deathYear
        ),
        birthPlaceId:
          row.birth_place_id ||
          row.birthPlaceId,
        deathPlaceId:
          row.death_place_id ||
          row.deathPlaceId,
        difficulty:
          Number(row.difficulty || 1),
        published:
          ["true", "1", "yes"].includes(
            String(row.published)
              .trim()
              .toLowerCase()
          )
      });
    });

    if (errors.length > 0) {
      setTransferStatus({ errors });
      return;
    }

    await bulkPut(PERSONS_STORE, records);
    await reloadData();

    setTransferStatus({
      success:
        `${records.length} person record(s) imported.`
    });
  } catch (error) {
    setTransferStatus({
      errors: [error.message]
    });
  }
}

async function importJsonBackup() {
  try {
    const text = await readFile(
      elements["import-json-file"].files[0]
    );

    const backup = JSON.parse(text);

    if (
      !Array.isArray(backup.places) ||
      !Array.isArray(backup.persons)
    ) {
      throw new Error(
        "The JSON file is not a valid database backup."
      );
    }

    if (
      !confirm(
        "Replace the current browser database with this backup?"
      )
    ) {
      return;
    }

    await clearStore(PERSONS_STORE);
    await clearStore(PLACES_STORE);
    await bulkPut(
      PLACES_STORE,
      backup.places
    );
    await bulkPut(
      PERSONS_STORE,
      backup.persons
    );
    await reloadData();
    clearPlaceForm();
    clearPersonForm();

    setTransferStatus({
      success: "JSON backup restored."
    });
  } catch (error) {
    setTransferStatus({
      errors: [error.message]
    });
  }
}

function setupEvents() {
  document
    .querySelectorAll(".tab-button")
    .forEach(button => {
      button.addEventListener("click", () => {
        setActiveTab(button.dataset.tab);
      });
    });

  elements["place-search"].addEventListener(
    "input",
    renderPlaceList
  );

  elements["place-status-filter"].addEventListener(
    "change",
    renderPlaceList
  );

  elements["person-search"].addEventListener(
    "input",
    renderPersonList
  );

  elements["new-place-button"].addEventListener(
    "click",
    clearPlaceForm
  );

  elements["next-review-button"].addEventListener(
    "click",
    selectNextPlaceToReview
  );

  elements["place-form"].addEventListener(
    "submit",
    savePlace
  );

  elements["delete-place-button"].addEventListener(
    "click",
    removeSelectedPlace
  );

  elements["new-person-button"].addEventListener(
    "click",
    clearPersonForm
  );

  elements["person-form"].addEventListener(
    "submit",
    savePerson
  );

  elements["delete-person-button"].addEventListener(
    "click",
    removeSelectedPerson
  );

  elements["use-calculated-position-button"]
    .addEventListener(
      "click",
      useCalculatedPosition
    );

  for (const id of [
    "place-name",
    "place-country",
    "place-latitude",
    "place-longitude",
    "place-map-x",
    "place-map-y",
    "place-source",
    "place-verification-status"
  ]) {
    elements[id].addEventListener(
      "input",
      () => {
        if (
          id === "place-latitude" ||
          id === "place-longitude"
        ) {
          updateCalculatedMarker();
        }

        if (
          id === "place-map-x" ||
          id === "place-map-y"
        ) {
          setEditablePosition({
            x: Number(
              elements["place-map-x"].value
            ),
            y: Number(
              elements["place-map-y"].value
            )
          });
        }

        validatePlaceForm();
      }
    );
  }

  for (const id of [
    "person-name",
    "person-period",
    "person-birth-year",
    "person-death-year",
    "person-accepted-answers",
    "person-published"
  ]) {
    elements[id].addEventListener(
      "input",
      validatePersonForm
    );
  }

  elements["export-json-button"].addEventListener(
    "click",
    exportJson
  );

  elements["export-places-csv-button"]
    .addEventListener("click", () => {
      const exportRecords = state.places.map(place => ({
        id: place.id,
        name: place.name,
        historical_name: place.historicalName,
        country_code: place.countryCode,
        country: place.country,
        latitude: place.latitude,
        longitude: place.longitude,
        map_x: place.mapX,
        map_y: place.mapY,
        precision: place.precision,
        verification_status:
          place.verificationStatus,
        source: place.source,
        source_id: place.sourceId,
        notes: place.notes
      }));

      downloadText(
        "places.csv",
        recordsToCsv(
          exportRecords,
          [
            "id",
            "name",
            "historical_name",
            "country_code",
            "country",
            "latitude",
            "longitude",
            "map_x",
            "map_y",
            "precision",
            "verification_status",
            "source",
            "source_id",
            "notes"
          ]
        ),
        "text/csv"
      );
    });

  elements["export-persons-csv-button"]
    .addEventListener("click", () => {
      const exportRecords = state.persons.map(person => ({
        id: person.id,
        name: person.name,
        accepted_answers:
          person.acceptedAnswers,
        period: person.period,
        birth_year: person.birthYear,
        death_year: person.deathYear,
        birth_place_id:
          person.birthPlaceId,
        death_place_id:
          person.deathPlaceId,
        difficulty: person.difficulty,
        published: person.published
      }));

      downloadText(
        "persons.csv",
        recordsToCsv(
          exportRecords,
          [
            "id",
            "name",
            "accepted_answers",
            "period",
            "birth_year",
            "death_year",
            "birth_place_id",
            "death_place_id",
            "difficulty",
            "published"
          ]
        ),
        "text/csv"
      );
    });

  elements["import-places-button"]
    .addEventListener(
      "click",
      importPlacesCsv
    );

  elements["import-persons-button"]
    .addEventListener(
      "click",
      importPersonsCsv
    );

  elements["import-json-button"]
    .addEventListener(
      "click",
      importJsonBackup
    );

  elements["reset-database-button"]
    .addEventListener("click", async () => {
      if (
        !confirm(
          "Reset all local data to the original demo records?"
        )
      ) {
        return;
      }

      await resetDatabase();
      await reloadData();
      clearPlaceForm();
      clearPersonForm();

      setTransferStatus({
        success:
          "The demo database was restored."
      });
    });

  setupPlacePicker("birth");
  setupPlacePicker("death");
  setupMapEditor();
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

    setTransferStatus({
      errors: [
        "The local database could not be opened. Run the project through Live Server."
      ]
    });
  }
}

boot();
