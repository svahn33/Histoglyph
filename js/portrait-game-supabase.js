import { requireSupabase } from "./supabase-client.js";

const supabase = requireSupabase();
const PORTRAIT_BUCKET = "person-images";
const params = new URLSearchParams(location.search);

const collectionSlug = params.get("collection") || "world-history";
const requestedRounds = Math.max(1, Math.min(100, Number.parseInt(params.get("rounds") || "10", 10) || 10));
const includeAll = params.get("includeAll") === "1";
const difficultyValue = Number.parseInt(params.get("difficulty"), 10);
const difficulty = Number.isInteger(difficultyValue) && difficultyValue >= 1 && difficultyValue <= 5 ? difficultyValue : null;
const birthFromValue = Number.parseInt(params.get("birthFrom"), 10);
const birthToValue = Number.parseInt(params.get("birthTo"), 10);
const birthFrom = Number.isFinite(birthFromValue) ? birthFromValue : null;
const birthTo = Number.isFinite(birthToValue) ? birthToValue : null;
const initialYears = params.get("years") === "1";
const initialOccupation = params.get("occupation") === "1";
const initialPlaces = params.get("places") === "1";

const el = id => document.getElementById(id);
const collectionTitle = el("portrait-collection-title");
const collectionBreadcrumb = el("portrait-collection-breadcrumb");
const roundSettingSummary = el("portrait-round-setting-summary");
const difficultySettingSummary = el("portrait-difficulty-setting-summary");
const birthYearSettingSummary = el("portrait-birth-year-setting-summary");
const clueSettingSummary = el("portrait-clue-setting-summary");
const roundNumber = el("portrait-round-number");
const roundTotal = el("portrait-round-total");
const correctCount = el("portrait-correct-count");
const hintsCount = el("portrait-hints-count");
const portraitImage = el("portrait-image");
const portraitPlaceholder = el("portrait-image-placeholder");
const guessForm = el("portrait-guess-form");
const guessInput = el("portrait-guess-input");
const guessButton = el("portrait-guess-button");
const revealAnswerButton = el("portrait-reveal-answer");
const nextButton = el("portrait-next-button");
const feedback = el("portrait-feedback");
const guessPanel = el("portrait-guess-panel");
const resultPanel = el("portrait-round-result");
const resultStatus = el("portrait-result-status");
const resultName = el("portrait-result-name");
const resultOccupation = el("portrait-result-occupation");
const resultYears = el("portrait-result-years");
const resultBirthplace = el("portrait-result-birthplace");
const resultDeathplace = el("portrait-result-deathplace");
const resultCredit = el("portrait-result-credit");
const restartButton = el("portrait-restart-button");
const summaryModal = el("portrait-summary-modal");
const summaryCollection = el("portrait-summary-collection");
const summaryCorrectMain = el("portrait-summary-correct-main");
const summaryAccuracy = el("portrait-summary-accuracy");
const summaryHints = el("portrait-summary-hints");
const summaryAttempts = el("portrait-summary-attempts");
const playAgainButton = el("portrait-play-again-button");
const clueItems = new Map(
  [...document.querySelectorAll(".portrait-clue-item")].map(item => [item.dataset.clue, item])
);

let sessionId = null;
let currentRound = 1;
let actualRoundCount = requestedRounds;
let correctAnswers = 0;
let hintsUsed = 0;
let roundComplete = false;
let submitting = false;
let currentClues = new Set();

function formatHistoricalYear(value) {
  const year = Number(value);
  if (!Number.isFinite(year)) return "—";
  return year < 0 ? `${Math.abs(year)} BC` : String(year);
}

function formatBirthRange() {
  if (!Number.isFinite(birthFrom) || !Number.isFinite(birthTo)) return "All birth years";
  return `${formatHistoricalYear(birthFrom)}–${formatHistoricalYear(birthTo)}`;
}

function formatOccupationTag(value) {
  return String(value || "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function fullPlace(name, country) {
  return [name, country].filter(Boolean).join(", ") || "—";
}

function selectedClueLabel() {
  const clues = [
    initialYears ? "Life years" : "",
    initialOccupation ? "Occupation" : "",
    initialPlaces ? "Places" : ""
  ].filter(Boolean);
  return clues.length ? clues.join(" · ") : "Portrait only";
}

function portraitCandidates(value) {
  const raw = String(value || "").trim();
  if (!raw) return [];
  const candidates = [];
  const add = url => {
    const clean = String(url || "").trim();
    if (clean && !candidates.includes(clean)) candidates.push(clean);
  };
  if (/^https?:\/\//i.test(raw)) {
    add(raw);
    return candidates;
  }
  let path = raw.replace(/^\/+/, "");
  if (path.startsWith(`${PORTRAIT_BUCKET}/`)) path = path.slice(PORTRAIT_BUCKET.length + 1);
  const { data: normalized } = supabase.storage.from(PORTRAIT_BUCKET).getPublicUrl(path);
  add(normalized?.publicUrl);
  if (path !== raw.replace(/^\/+/, "")) {
    const { data: original } = supabase.storage.from(PORTRAIT_BUCKET).getPublicUrl(raw.replace(/^\/+/, ""));
    add(original?.publicUrl);
  }
  return candidates;
}

function setPortrait(path) {
  const urls = portraitCandidates(path);
  let index = 0;
  portraitImage.hidden = true;
  portraitPlaceholder.hidden = false;
  portraitImage.removeAttribute("src");
  portraitImage.alt = "Historical portrait";

  const tryNext = () => {
    if (index >= urls.length) {
      portraitImage.hidden = true;
      portraitPlaceholder.hidden = false;
      portraitImage.removeAttribute("src");
      return;
    }
    portraitImage.src = urls[index++];
  };
  portraitImage.onload = () => {
    portraitImage.hidden = false;
    portraitPlaceholder.hidden = true;
  };
  portraitImage.onerror = tryNext;
  tryNext();
}

function setFeedback(message, type = "neutral") {
  const copy = String(message || "").trim();
  feedback.className = `portrait-feedback-box ${type}`;
  feedback.replaceChildren();

  const strong = document.createElement("strong");
  const detail = document.createElement("span");

  if (!copy) {
    strong.textContent = "Make your guess";
    detail.textContent = "Enter a name below. A surname is enough.";
  } else if (type === "incorrect") {
    strong.textContent = "Not quite";
    detail.textContent = copy.replace(/^Not quite\s*[—-]?\s*/i, "") || "Try another name or reveal a clue.";
  } else if (type === "correct") {
    strong.textContent = "Correct";
    detail.textContent = copy;
  } else {
    strong.textContent = copy;
    detail.textContent = "";
  }

  feedback.append(strong);
  if (detail.textContent) feedback.append(detail);
}

function setControls(enabled) {
  guessInput.disabled = !enabled;
  guessButton.disabled = !enabled;
  revealAnswerButton.disabled = !enabled;
  document.querySelectorAll("[data-reveal-clue]").forEach(button => {
    const type = button.dataset.revealClue;
    button.disabled = !enabled || currentClues.has(type) || button.dataset.unavailable === "1";
  });
}

function resetClueItems() {
  currentClues = new Set();
  for (const [type, item] of clueItems) {
    item.classList.remove("is-visible", "is-unavailable");
    const value = item.querySelector(".portrait-clue-value");
    const button = item.querySelector("[data-reveal-clue]");
    value.textContent = "Hidden";
    button.textContent = "Reveal";
    button.dataset.unavailable = "0";
    button.disabled = false;
  }
}

function displayClue(type, clue, { initial = false } = {}) {
  const item = clueItems.get(type);
  if (!item) return;
  const value = item.querySelector(".portrait-clue-value");
  const button = item.querySelector("[data-reveal-clue]");
  let text = "—";

  if (type === "years") {
    text = `${formatHistoricalYear(clue?.birth_year)}–${formatHistoricalYear(clue?.death_year)}`;
  } else if (type === "occupation") {
    const occupations = Array.isArray(clue) ? clue.map(formatOccupationTag).filter(Boolean) : [];
    if (!occupations.length) {
      item.classList.add("is-unavailable");
      value.textContent = "No occupation listed";
      button.textContent = "Unavailable";
      button.dataset.unavailable = "1";
      button.disabled = true;
      return;
    }
    text = occupations.slice(0, 3).join(" · ");
  } else if (type === "places") {
    text = `${fullPlace(clue?.birth_place_name, clue?.birth_country)} → ${fullPlace(clue?.death_place_name, clue?.death_country)}`;
  }

  currentClues.add(type);
  item.classList.add("is-visible");
  value.textContent = text;
  button.textContent = initial ? "Shown" : "Revealed";
  button.disabled = true;
}

function renderInitialClues(initialClues) {
  if (initialClues?.years) displayClue("years", initialClues.years, { initial: true });
  if (initialClues?.occupation) displayClue("occupation", initialClues.occupation, { initial: true });
  if (initialClues?.places) displayClue("places", initialClues.places, { initial: true });
}

function clearResult() {
  resultPanel.hidden = true;
  guessPanel.hidden = false;
  resultPanel.classList.remove("is-correct", "is-revealed");
  resultCredit.hidden = true;
  resultCredit.replaceChildren();
}

function renderResult(result) {
  const correct = result.outcome === "correct";
  resultStatus.textContent = correct ? "Correct" : "Answer";
  resultPanel.classList.toggle("is-correct", correct);
  resultPanel.classList.toggle("is-revealed", !correct);
  resultName.textContent = result.person_name || "Historical person";
  const occupations = Array.isArray(result.occupations)
    ? result.occupations.map(formatOccupationTag).filter(Boolean).slice(0, 3)
    : [];
  resultOccupation.textContent = occupations.join(" · ");
  resultOccupation.hidden = occupations.length === 0;
  resultYears.textContent = `${formatHistoricalYear(result.birth_year)}–${formatHistoricalYear(result.death_year)}`;
  resultBirthplace.textContent = fullPlace(result.birth_place_name, result.birth_country);
  resultDeathplace.textContent = fullPlace(result.death_place_name, result.death_country);

  const creditText = [result.image_credit, result.image_license].filter(Boolean).join(" · ");
  if (creditText) {
    resultCredit.hidden = false;
    resultCredit.append("Image: ");
    if (/^https?:\/\//i.test(String(result.image_source_url || ""))) {
      const link = document.createElement("a");
      link.href = result.image_source_url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = creditText;
      resultCredit.append(link);
    } else {
      resultCredit.append(creditText);
    }
  }
  guessPanel.hidden = true;
  resultPanel.hidden = false;
}

async function revealHint(type) {
  if (roundComplete || submitting || currentClues.has(type)) return;
  submitting = true;
  setControls(false);
  const { data, error } = await supabase.rpc("get_portrait_hint", {
    p_session_id: sessionId,
    p_round_number: currentRound,
    p_hint_type: type
  });
  submitting = false;
  if (error) {
    setControls(true);
    return handleError(error);
  }
  if (!data?.available) {
    const item = clueItems.get(type);
    if (item) {
      item.classList.add("is-unavailable");
      item.querySelector(".portrait-clue-value").textContent = "No information listed";
      const button = item.querySelector("[data-reveal-clue]");
      button.textContent = "Unavailable";
      button.dataset.unavailable = "1";
    }
    setControls(true);
    return;
  }
  displayClue(type, data.clue);
  if (data.counted) {
    hintsUsed += 1;
    hintsCount.textContent = String(hintsUsed);
  }
  setControls(true);
}

async function loadRound() {
  roundComplete = false;
  submitting = false;
  resetClueItems();
  clearResult();
  setFeedback("");
  guessInput.value = "";
  nextButton.disabled = true;
  nextButton.textContent = currentRound >= actualRoundCount ? "See results" : "Next portrait";
  roundNumber.textContent = String(currentRound);
  roundTotal.textContent = String(actualRoundCount);

  const { data, error } = await supabase.rpc("get_portrait_round", {
    p_session_id: sessionId,
    p_round_number: currentRound
  });
  if (error) return handleError(error);
  setPortrait(data.image_path);
  renderInitialClues(data.initial_clues || {});
  if (Array.isArray(data.revealed_hints)) {
    for (const type of data.revealed_hints) currentClues.add(type);
  }
  setControls(true);
  guessInput.focus();
}

async function submitGuess(event) {
  event?.preventDefault();
  if (roundComplete || submitting) return;
  const guess = guessInput.value.trim();
  if (!guess) return;
  submitting = true;
  setControls(false);
  const { data, error } = await supabase.rpc("submit_portrait_guess", {
    p_session_id: sessionId,
    p_round_number: currentRound,
    p_guess: guess
  });
  submitting = false;
  if (error) {
    setControls(true);
    return handleError(error);
  }
  if (!data.correct) {
    setFeedback("Try another name or reveal a clue.", "incorrect");
    setControls(true);
    guessInput.select();
    return;
  }
  correctAnswers += 1;
  correctCount.textContent = String(correctAnswers);
  finishRound(data);
}

async function revealAnswer() {
  if (roundComplete || submitting) return;
  submitting = true;
  setControls(false);
  const { data, error } = await supabase.rpc("reveal_portrait_answer", {
    p_session_id: sessionId,
    p_round_number: currentRound
  });
  submitting = false;
  if (error) {
    setControls(true);
    return handleError(error);
  }
  finishRound(data);
}

function finishRound(result) {
  roundComplete = true;
  setControls(false);
  setFeedback("");
  renderResult(result);
  nextButton.disabled = false;
  nextButton.textContent = currentRound >= actualRoundCount ? "See results" : "Next portrait";
  nextButton.focus({ preventScroll: true });
}

async function nextRound() {
  if (!roundComplete) return;
  if (currentRound >= actualRoundCount) return showSummary();
  currentRound += 1;
  await loadRound();
}

async function showSummary() {
  const { data, error } = await supabase.rpc("get_portrait_summary", { p_session_id: sessionId });
  if (error) return handleError(error);
  summaryCollection.textContent = `${collectionTitle.textContent} · ${data.round_count} rounds`;
  summaryCorrectMain.textContent = `${data.correct_answers} / ${data.round_count}`;
  summaryAccuracy.textContent = `${data.accuracy}%`;
  summaryHints.textContent = String(data.hints_used || 0);
  summaryAttempts.textContent = String(data.total_attempts || 0);
  summaryModal.hidden = false;
  playAgainButton.focus({ preventScroll: true });
}

async function startGame() {
  summaryModal.hidden = true;
  correctAnswers = 0;
  hintsUsed = 0;
  currentRound = 1;
  correctCount.textContent = "0";
  hintsCount.textContent = "0";
  clearResult();
  setFeedback("Loading portraits…");
  setControls(false);
  nextButton.disabled = true;

  const { data, error } = await supabase.rpc("start_portrait_game", {
    p_collection_slug: collectionSlug,
    p_round_count: requestedRounds,
    p_difficulty: difficulty,
    p_birth_year_min: birthFrom,
    p_birth_year_max: birthTo,
    p_include_all: includeAll,
    p_initial_years: initialYears,
    p_initial_occupation: initialOccupation,
    p_initial_places: initialPlaces
  });
  if (error) return handleError(error);

  sessionId = data.session_id;
  actualRoundCount = Number(data.round_count || requestedRounds);
  collectionTitle.textContent = data.collection_title || "Portrait";
  collectionBreadcrumb.textContent = data.collection_title || "Collection";
  roundSettingSummary.textContent = includeAll ? `${actualRoundCount} rounds · Include all` : `${actualRoundCount} rounds`;
  difficultySettingSummary.textContent = difficulty === null ? "All difficulties" : `Difficulty ${difficulty}`;
  birthYearSettingSummary.textContent = formatBirthRange();
  clueSettingSummary.textContent = selectedClueLabel();
  await loadRound();
}

function handleError(error) {
  console.error(error);
  const message = error?.message || "Something went wrong.";
  setFeedback(message, "incorrect");
  setControls(false);
}

guessForm.addEventListener("submit", submitGuess);
revealAnswerButton.addEventListener("click", revealAnswer);
nextButton.addEventListener("click", nextRound);
restartButton.addEventListener("click", startGame);
playAgainButton.addEventListener("click", startGame);
document.querySelectorAll("[data-reveal-clue]").forEach(button => {
  button.addEventListener("click", () => revealHint(button.dataset.revealClue));
});

document.addEventListener("keydown", event => {
  if (event.key === "Enter" && roundComplete && !summaryModal.hidden) return;
  if (event.key === "Enter" && roundComplete && !nextButton.disabled && document.activeElement !== guessInput) {
    event.preventDefault();
    nextRound();
  }
});

await startGame();
