import { requireSupabase } from "./supabase-client.js";

const supabase = requireSupabase();
const PORTRAIT_BUCKET = "person-images";
const params = new URLSearchParams(location.search);

const collectionSlug = params.get("collection") || "world-history";
const requestedPeople = Math.max(2, Math.min(100, Number.parseInt(params.get("people") || "10", 10) || 10));
const includeAll = params.get("includeAll") === "1";
const difficultyValue = Number.parseInt(params.get("difficulty"), 10);
const difficulty = Number.isInteger(difficultyValue) && difficultyValue >= 1 && difficultyValue <= 5 ? difficultyValue : null;
const birthFromValue = Number.parseInt(params.get("birthFrom"), 10);
const birthToValue = Number.parseInt(params.get("birthTo"), 10);
const birthFrom = Number.isFinite(birthFromValue) ? birthFromValue : null;
const birthTo = Number.isFinite(birthToValue) ? birthToValue : null;

const collectionTitle = document.querySelector("#timeline-collection-title");
const collectionBreadcrumb = document.querySelector("#timeline-collection-breadcrumb");
const peopleSummary = document.querySelector("#timeline-people-setting-summary");
const difficultySummary = document.querySelector("#timeline-difficulty-setting-summary");
const birthYearSummary = document.querySelector("#timeline-birth-year-setting-summary");
const roundNumber = document.querySelector("#timeline-round-number");
const roundTotal = document.querySelector("#timeline-round-total");
const mistakesDisplay = document.querySelector("#timeline-mistakes");
const placedCount = document.querySelector("#timeline-placed-count");
const currentCard = document.querySelector("#timeline-current-card");
const currentImage = document.querySelector("#timeline-current-image");
const currentPlaceholder = document.querySelector("#timeline-current-placeholder");
const currentName = document.querySelector("#timeline-current-name");
const currentBirthplace = document.querySelector("#timeline-current-birthplace");
const currentCredit = document.querySelector("#timeline-current-credit");
const board = document.querySelector("#timeline-board");
const boardScroll = document.querySelector("#timeline-board-scroll");
const feedback = document.querySelector("#timeline-feedback");
const restartButton = document.querySelector("#timeline-restart-button");
const summaryModal = document.querySelector("#timeline-summary-modal");
const summaryCollection = document.querySelector("#timeline-summary-collection");
const summaryPlaced = document.querySelector("#timeline-summary-placed");
const summaryFirstTry = document.querySelector("#timeline-summary-first-try");
const summaryAccuracy = document.querySelector("#timeline-summary-accuracy");
const summaryMistakes = document.querySelector("#timeline-summary-mistakes");
const playAgainButton = document.querySelector("#timeline-play-again-button");

let sessionId = null;
let state = null;
let submitting = false;
let localMistakes = 0;

function formatHistoricalYear(value) {
  const year = Number(value);
  if (!Number.isFinite(year)) return "—";
  return year < 0 ? `${Math.abs(year)} BC` : String(year);
}

function formatBirthRange() {
  if (!Number.isFinite(birthFrom) || !Number.isFinite(birthTo)) return "All birth years";
  return `${formatHistoricalYear(birthFrom)}–${formatHistoricalYear(birthTo)}`;
}

function portraitCandidates(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];

  const candidates = [];
  const add = url => {
    const clean = String(url || "").trim();
    if (clean && !candidates.includes(clean)) candidates.push(clean);
  };

  // Some existing records may already contain a complete public URL.
  if (/^https?:\/\//i.test(raw)) {
    add(raw);
    return candidates;
  }

  let path = raw.replace(/^\/+/, "");
  if (path.startsWith(`${PORTRAIT_BUCKET}/`)) {
    path = path.slice(PORTRAIT_BUCKET.length + 1);
  }

  const { data: normalized } = supabase.storage.from(PORTRAIT_BUCKET).getPublicUrl(path);
  add(normalized?.publicUrl);

  // Keep a second candidate for older records that may already be bucket-relative.
  if (path !== raw.replace(/^\/+/, "")) {
    const { data: original } = supabase.storage.from(PORTRAIT_BUCKET).getPublicUrl(raw.replace(/^\/+/, ""));
    add(original?.publicUrl);
  }

  return candidates;
}

function initials(name) {
  return String(name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join("") || "?";
}

function setPortrait(img, placeholder, path, name) {
  const urls = portraitCandidates(path);
  let candidateIndex = 0;

  placeholder.textContent = initials(name);
  img.hidden = true;
  placeholder.hidden = false;
  img.alt = `${name} portrait`;
  img.removeAttribute("src");

  if (!urls.length) return;

  const tryNext = () => {
    if (candidateIndex >= urls.length) {
      img.hidden = true;
      placeholder.hidden = false;
      img.removeAttribute("src");
      return;
    }
    const url = urls[candidateIndex];
    candidateIndex += 1;
    img.src = url;
  };

  img.onload = () => {
    img.hidden = false;
    placeholder.hidden = true;
  };
  img.onerror = tryNext;
  tryNext();
}

function setCurrentCredit(card) {
  currentCredit.replaceChildren();
  const label = card?.image_credit || card?.image_license;
  if (!label) {
    currentCredit.hidden = true;
    return;
  }
  currentCredit.hidden = false;
  currentCredit.append("Image: ");
  if (card.image_source_url) {
    const link = document.createElement("a");
    link.href = card.image_source_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = label;
    currentCredit.append(link);
  } else {
    currentCredit.append(label);
  }
}

function renderCurrentCard(card) {
  if (!card) {
    currentCard.hidden = true;
    return;
  }
  currentCard.hidden = false;
  currentCard.classList.remove("is-wrong", "is-correct");
  currentCard.draggable = true;
  currentName.textContent = card.name;
  const placeName = card.birth_place?.name || "Unknown place";
  const country = card.birth_place?.country ? `, ${card.birth_place.country}` : "";
  currentBirthplace.textContent = `${placeName}${country}`;
  setPortrait(currentImage, currentPlaceholder, card.image_path, card.name);
  setCurrentCredit(card);
}

function makeMiniPersonCard(person) {
  const item = document.createElement("article");
  item.className = "timeline-placed-person";

  const portraitWrap = document.createElement("div");
  portraitWrap.className = "timeline-placed-person__portrait-wrap";
  const placeholder = document.createElement("div");
  placeholder.className = "timeline-placed-person__placeholder";
  placeholder.textContent = initials(person.name);
  const image = document.createElement("img");
  image.className = "timeline-placed-person__portrait";
  image.alt = `${person.name} portrait`;
  image.hidden = true;
  portraitWrap.append(placeholder, image);
  setPortrait(image, placeholder, person.image_path, person.name);

  const body = document.createElement("div");
  body.className = "timeline-placed-person__body";
  const name = document.createElement("strong");
  name.textContent = person.name;
  const year = document.createElement("span");
  year.textContent = formatHistoricalYear(person.birth_year);
  body.append(name, year);

  item.append(portraitWrap, body);
  return item;
}

function makeDropSlot(position, total) {
  const slot = document.createElement("button");
  slot.type = "button";
  slot.className = "timeline-drop-slot";
  slot.dataset.position = String(position);
  slot.disabled = submitting;
  const label = position === 0 ? "Place before" : position === total ? "Place after" : "Place here";
  slot.innerHTML = `<span aria-hidden="true">+</span><small>${label}</small>`;
  slot.addEventListener("click", () => submitPlacement(position));
  slot.addEventListener("dragover", event => {
    event.preventDefault();
    if (!submitting) slot.classList.add("is-drag-over");
  });
  slot.addEventListener("dragleave", () => slot.classList.remove("is-drag-over"));
  slot.addEventListener("drop", event => {
    event.preventDefault();
    slot.classList.remove("is-drag-over");
    submitPlacement(position);
  });
  return slot;
}

function renderBoard(timeline) {
  const fragment = document.createDocumentFragment();
  const total = timeline.length;
  for (let index = 0; index <= total; index += 1) {
    fragment.append(makeDropSlot(index, total));
    if (index < total) fragment.append(makeMiniPersonCard(timeline[index]));
  }
  board.replaceChildren(fragment);
  placedCount.textContent = String(total);
}

function renderState(nextState) {
  state = nextState;
  collectionTitle.textContent = state.collection_title;
  collectionBreadcrumb.textContent = state.collection_title;
  roundTotal.textContent = String(state.placement_rounds);
  roundNumber.textContent = String(Math.min(state.current_round, state.placement_rounds));
  renderCurrentCard(state.current_card);
  renderBoard(state.timeline || []);

  if (!state.completed) {
    window.requestAnimationFrame(() => {
      const currentWidth = boardScroll.clientWidth;
      if (boardScroll.scrollWidth > currentWidth) {
        boardScroll.scrollLeft = Math.max(0, (boardScroll.scrollWidth - currentWidth) / 2);
      }
    });
  }
}

async function fetchState() {
  const { data, error } = await supabase.rpc("get_timeline_state", { p_session_id: sessionId });
  if (error) throw error;
  renderState(data);
  if (data.completed) await showSummary();
}

async function startGame() {
  feedback.textContent = "";
  feedback.className = "timeline-feedback";
  localMistakes = 0;
  mistakesDisplay.textContent = "0";
  const { data, error } = await supabase.rpc("start_timeline_game", {
    p_collection_slug: collectionSlug,
    p_people_count: requestedPeople,
    p_difficulty: difficulty,
    p_birth_year_min: birthFrom,
    p_birth_year_max: birthTo,
    p_include_all: includeAll
  });
  if (error) throw error;
  sessionId = data.session_id;
  collectionTitle.textContent = data.collection_title;
  collectionBreadcrumb.textContent = data.collection_title;
  peopleSummary.textContent = includeAll ? `${data.people_count} people · all matching` : `${data.people_count} people`;
  difficultySummary.textContent = difficulty === null ? "All difficulties" : `Difficulty ${difficulty}`;
  birthYearSummary.textContent = formatBirthRange();
  roundTotal.textContent = String(data.placement_rounds);
  summaryModal.hidden = true;
  await fetchState();
}

function setSubmitting(value) {
  submitting = value;
  currentCard.classList.toggle("is-disabled", value);
  board.querySelectorAll(".timeline-drop-slot").forEach(slot => { slot.disabled = value; });
}

async function submitPlacement(position) {
  if (submitting || !sessionId || state?.completed) return;
  setSubmitting(true);
  feedback.textContent = "Checking placement…";
  feedback.className = "timeline-feedback";

  try {
    const { data, error } = await supabase.rpc("submit_timeline_placement", {
      p_session_id: sessionId,
      p_position_index: position
    });
    if (error) throw error;

    if (!data.correct) {
      localMistakes += 1;
      mistakesDisplay.textContent = String(localMistakes);
      feedback.textContent = "Not quite — try another position.";
      feedback.className = "timeline-feedback is-wrong";
      currentCard.classList.remove("is-wrong");
      void currentCard.offsetWidth;
      currentCard.classList.add("is-wrong");
      return;
    }

    currentCard.classList.remove("is-wrong");
    currentCard.classList.add("is-correct");
    feedback.textContent = `Correct — ${data.person_name} was born in ${formatHistoricalYear(data.birth_year)}.`;
    feedback.className = "timeline-feedback is-correct";

    await new Promise(resolve => setTimeout(resolve, 750));
    await fetchState();
  } catch (error) {
    console.error(error);
    feedback.textContent = error?.message || "The placement could not be checked.";
    feedback.className = "timeline-feedback is-wrong";
  } finally {
    setSubmitting(false);
  }
}

async function showSummary() {
  const { data, error } = await supabase.rpc("get_timeline_summary", { p_session_id: sessionId });
  if (error) {
    console.error(error);
    return;
  }
  summaryCollection.textContent = `${state.collection_title} · ${data.people_count} people`;
  summaryPlaced.textContent = String(data.people_count);
  summaryFirstTry.textContent = `${data.first_try_placements} / ${data.placement_rounds}`;
  summaryAccuracy.textContent = `${data.first_try_accuracy}%`;
  summaryMistakes.textContent = String(data.mistakes);
  mistakesDisplay.textContent = String(data.mistakes);
  summaryModal.hidden = false;
  playAgainButton.focus({ preventScroll: true });
}

currentCard.addEventListener("dragstart", event => {
  if (submitting || state?.completed) {
    event.preventDefault();
    return;
  }
  currentCard.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", "timeline-card");
});
currentCard.addEventListener("dragend", () => {
  currentCard.classList.remove("is-dragging");
  board.querySelectorAll(".timeline-drop-slot").forEach(slot => slot.classList.remove("is-drag-over"));
});

restartButton.addEventListener("click", () => location.reload());
playAgainButton.addEventListener("click", () => location.reload());

startGame().catch(error => {
  console.error(error);
  currentName.textContent = "Timeline could not start";
  currentBirthplace.textContent = error?.message || "Run the V50 Timeline database migration and try again.";
  currentCard.draggable = false;
  feedback.textContent = "Return to Timeline settings and try another collection or filter.";
  feedback.className = "timeline-feedback is-wrong";
});
