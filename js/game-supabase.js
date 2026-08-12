import { requireSupabase } from "./supabase-client.js";
import { DetailedWorldMap } from "./offline-world-map.js";

const COUNTDOWN_SECONDS = 3;
const TIMER_UPDATE_INTERVAL_MS = 50;
const DEFAULT_DURATION_MS = 20_000;
const MAX_ROUND_POINTS = 1000;
const PORTRAIT_BUCKET = "person-images";

const parameters = new URLSearchParams(window.location.search);
const collectionSlug = parameters.get("collection") || "world-history";
const timedMode = parameters.get("timed") !== "0";
const showPlacesInitially = parameters.get("showPlaces") === "1";
const requestedRounds = Math.max(1, Math.min(100, Number.parseInt(parameters.get("rounds"), 10) || 5));
const requestedDifficultyValue = Number.parseInt(parameters.get("difficulty"), 10);
const difficultyFilter = Number.isInteger(requestedDifficultyValue) && requestedDifficultyValue >= 1 && requestedDifficultyValue <= 5
  ? requestedDifficultyValue
  : null;

const el = id => document.querySelector(`#${id}`);
const roundNumberElement = el("round-number");
const roundTotalElement = el("round-total");
const scoreElement = el("score");
const scoreLabelElement = el("score-label");
const roundTimerElement = el("round-timer");
const timerHudItem = el("timer-hud-item");
const timingSettingSummary = el("timing-setting-summary");
const placeSettingSummary = el("place-setting-summary");
const roundSettingSummary = el("round-setting-summary");
const difficultySettingSummary = el("difficulty-setting-summary");
const countdownOverlay = el("round-countdown");
const countdownValue = el("countdown-value");
const resultOverlay = el("round-result");
const resultStatusElement = el("result-status");
const resultPersonNameElement = el("result-person-name");
const resultOccupationsElement = el("result-occupations");
const resultMetricElement = el("result-metric");
const resultPointsElement = el("result-points");
const resultUnitElement = el("result-unit");
const resultInstructionElement = el("result-instruction");
const resultPortrait = el("result-portrait");
const resultPortraitImage = el("result-portrait-image");
const resultPortraitCredit = el("result-portrait-credit");
const resultPortraitCreditRow = el("result-portrait-credit-row");
const guessForm = el("guess-form");
const guessInput = el("guess-input");
const guessButton = el("guess-button");
const feedbackElement = el("feedback");
const nextButton = el("next-button");
const revealButton = el("reveal-button");
const newGameButton = el("new-game-button");
const dataWarning = el("data-warning");
const collectionTitle = el("collection-title");
const collectionDescription = el("collection-description");
const collectionBreadcrumb = el("collection-breadcrumb");

const supabase = requireSupabase();
const worldMap = new DetailedWorldMap(el("game-map"));

let sessionId = null;
let roundCount = requestedRounds;
let currentRound = 1;
let currentClue = null;
let score = 0;
let correctAnswers = 0;
let roundFinished = true;
let gameFinished = false;
let roundStartedAt = 0;
let durationMs = DEFAULT_DURATION_MS;
let timerIntervalId = null;
let roundSequence = 0;

function formatYear(year) {
  return Number(year) < 0 ? `${Math.abs(Number(year))} BC` : String(year);
}
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function setFeedback(message, type = "neutral") {
  feedbackElement.textContent = message;
  feedbackElement.className = `feedback ${type}`;
}
function stopTimer() {
  if (timerIntervalId !== null) clearInterval(timerIntervalId);
  timerIntervalId = null;
}
function setControls(enabled) {
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
function updateTimer(elapsed) {
  if (!timedMode) return;
  const remaining = Math.max(0, durationMs - elapsed);
  roundTimerElement.textContent = (remaining / 1000).toFixed(1);
  document.body.classList.toggle("round-time-low", remaining > 0 && remaining <= 5000);
}
function clearResultPortrait() {
  resultPortrait.hidden = true;
  resultPortraitImage.removeAttribute("src");
  resultPortraitImage.alt = "";
  resultPortraitCredit.textContent = "";
  resultPortraitCredit.removeAttribute("href");
  resultPortraitCreditRow.hidden = true;
  resultOverlay.classList.remove("round-result--has-portrait");
}
function hideResult() {
  resultOverlay.hidden = true;
  resultOccupationsElement.textContent = "";
  resultOccupationsElement.hidden = true;
  resultOverlay.classList.remove("round-result--correct","round-result--incorrect","round-result--neutral","round-result--game-over","round-result--has-portrait");
  clearResultPortrait();
}
function safeHttpUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
}
function showResultPortrait(result) {
  clearResultPortrait();
  if (!result?.image_path) return;
  const { data } = supabase.storage.from(PORTRAIT_BUCKET).getPublicUrl(result.image_path);
  if (!data?.publicUrl) return;
  resultPortraitImage.src = data.publicUrl;
  resultPortraitImage.alt = `Portrait of ${result.person_name}`;
  const creditParts = [result.image_credit, result.image_license].filter(Boolean);
  resultPortraitCredit.textContent = creditParts.join(" · ") || "Image source";
  const sourceUrl = safeHttpUrl(result.image_source_url);
  if (sourceUrl) resultPortraitCredit.href = sourceUrl;
  resultPortrait.hidden = false;
  resultPortraitCreditRow.hidden = false;
  resultOverlay.classList.add("round-result--has-portrait");
  resultPortraitImage.onerror = () => clearResultPortrait();
}

function formatOccupationTag(value) {
  return String(value || "")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, character => character.toUpperCase());
}

function showResultOccupations(result) {
  const occupations = Array.isArray(result?.occupations)
    ? result.occupations.map(formatOccupationTag).filter(Boolean)
    : [];

  resultOccupationsElement.textContent = occupations.slice(0, 3).join(" · ");
  resultOccupationsElement.hidden = occupations.length === 0;
}

function fullPlaceName(name, country) {
  return [name, country].filter(Boolean).join(", ");
}
async function renderClue(clue, revealNames = false, result = null) {
  const birthName = result?.birth_place_name ?? clue.birth_place.name;
  const birthCountry = result?.birth_country ?? clue.birth_place.country;
  const deathName = result?.death_place_name ?? clue.death_place.name;
  const deathCountry = result?.death_country ?? clue.death_place.country;
  const locations = [
    {
      type: "birth",
      label: `Born ${formatYear(clue.birth_year)}`,
      year: formatYear(clue.birth_year),
      placeName: fullPlaceName(birthName, birthCountry),
      latitude: Number(clue.birth_place.latitude),
      longitude: Number(clue.birth_place.longitude)
    },
    {
      type: "death",
      label: `Died ${formatYear(clue.death_year)}`,
      year: formatYear(clue.death_year),
      placeName: fullPlaceName(deathName, deathCountry),
      latitude: Number(clue.death_place.latitude),
      longitude: Number(clue.death_place.longitude)
    }
  ];
  await worldMap.setGameLocations(locations);
  worldMap.setPlaceNamesVisible(revealNames || showPlacesInitially);
  await worldMap.fitToLocations(locations);
  dataWarning.hidden = [clue.birth_place, clue.death_place].every(place => place.verification_status === "manually_verified");
}
function prepareRound() {
  roundFinished = true;
  gameFinished = false;
  stopTimer();
  setControls(false);
  nextButton.disabled = true;
  hideResult();
  roundTimerElement.textContent = timedMode ? "20.0" : "∞";
  document.body.classList.remove("round-time-low");
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
function statusFromOutcome(outcome) {
  return {
    correct: ["Correct", "correct"],
    incorrect: ["Incorrect", "incorrect"],
    timeout: ["Time is up", "incorrect"],
    revealed: ["Answer", "neutral"]
  }[outcome] || ["Round complete", "neutral"];
}
function showRoundResult(result) {
  const [status, statusClass] = statusFromOutcome(result.outcome);
  resultStatusElement.textContent = status;
  resultPersonNameElement.textContent = result.person_name;
  showResultOccupations(result);
  if (timedMode) {
    resultMetricElement.hidden = false;
    resultPointsElement.textContent = String(result.points || 0);
    resultUnitElement.textContent = "points";
  } else {
    // The status badge already says Correct/Answer/Time is up. A per-round
    // "1 correct this round" metric is redundant in untimed mode.
    resultMetricElement.hidden = true;
  }
  resultInstructionElement.textContent = currentRound >= roundCount
    ? "Press Enter to see your final result"
    : "Press Enter for the next round";
  resultOverlay.classList.add(`round-result--${statusClass}`);
  showResultPortrait(result);
  resultOverlay.hidden = false;
}
async function finishRound(result) {
  roundFinished = true;
  stopTimer();
  setControls(false);
  nextButton.disabled = false;
  if (result.correct) correctAnswers += 1;
  if (timedMode) {
    score += Number(result.points || 0);
    scoreElement.textContent = String(score);
  } else {
    scoreElement.textContent = String(correctAnswers);
  }
  await renderClue(currentClue, true, result);
  setFeedback("");
  showRoundResult(result);
}
async function expireRound(sequence) {
  if (roundFinished || sequence !== roundSequence) return;
  updateTimer(durationMs);
  const { data, error } = await supabase.rpc("reveal_life_map_answer", {
    p_session_id: sessionId,
    p_round_number: currentRound,
    p_reason: "timeout"
  });
  if (error) return handleError(error);
  await finishRound(data);
}
async function startActiveRound(sequence) {
  const { data, error } = await supabase.rpc("begin_life_map_round", {
    p_session_id: sessionId,
    p_round_number: currentRound
  });
  if (error) return handleError(error);
  if (sequence !== roundSequence) return;
  durationMs = Number(data.duration_ms || DEFAULT_DURATION_MS);
  roundStartedAt = performance.now();
  roundFinished = false;
  setControls(true);
  guessInput.focus();
  if (!timedMode) return;
  updateTimer(0);
  timerIntervalId = setInterval(() => {
    if (roundFinished || sequence !== roundSequence) return stopTimer();
    const elapsed = performance.now() - roundStartedAt;
    if (elapsed >= durationMs) return expireRound(sequence);
    updateTimer(elapsed);
  }, TIMER_UPDATE_INTERVAL_MS);
}
async function startRound() {
  const sequence = ++roundSequence;
  prepareRound();
  roundNumberElement.textContent = String(currentRound);
  roundTotalElement.textContent = String(roundCount);
  guessInput.value = "";
  setFeedback("");
  const { data, error } = await supabase.rpc("get_life_map_round", {
    p_session_id: sessionId,
    p_round_number: currentRound
  });
  if (error) return handleError(error);
  currentClue = data;
  await renderClue(currentClue, false);
  if (sequence !== roundSequence) return;
  if (!(await runCountdown(sequence))) return;
  await startActiveRound(sequence);
}
async function startNewGame() {
  roundSequence += 1;
  stopTimer();
  countdownOverlay.hidden = true;
  hideResult();
  setFeedback("Creating game…");
  const { data, error } = await supabase.rpc("start_life_map_game", {
    p_collection_slug: collectionSlug,
    p_round_count: requestedRounds,
    p_timed: timedMode,
    p_show_places: showPlacesInitially,
    p_difficulty: difficultyFilter
  });
  if (error) return handleError(error);
  sessionId = data.session_id;
  roundCount = Number(data.round_count);
  currentRound = 1;
  score = 0;
  correctAnswers = 0;
  scoreElement.textContent = "0";
  collectionTitle.textContent = data.collection_title;
  collectionDescription.textContent = data.collection_description;
  collectionBreadcrumb.textContent = data.collection_title;
  document.title = `${data.collection_title} — Histoglyph`;
  roundSettingSummary.textContent = `${roundCount} ${roundCount === 1 ? "round" : "rounds"}`;
  await startRound();
}
async function submitGuess() {
  if (roundFinished || !sessionId) return;
  const guess = guessInput.value.trim();
  if (!guess) return;
  setControls(false);
  const { data, error } = await supabase.rpc("submit_life_map_guess", {
    p_session_id: sessionId,
    p_round_number: currentRound,
    p_guess: guess
  });
  if (error) { setControls(true); return handleError(error); }
  if (roundFinished) return;
  if (data?.outcome === "try_again") {
    setFeedback("Not correct — keep trying, or choose I don't know.", "incorrect");
    setControls(true);
    guessInput.focus();
    guessInput.select();
    return;
  }
  await finishRound(data);
}
async function revealAnswer() {
  if (roundFinished || !sessionId) return;
  setControls(false);
  const { data, error } = await supabase.rpc("reveal_life_map_answer", {
    p_session_id: sessionId,
    p_round_number: currentRound,
    p_reason: "revealed"
  });
  if (error) { setControls(true); return handleError(error); }
  await finishRound(data);
}
function showGameOver() {
  gameFinished = true;
  nextButton.disabled = true;
  resultMetricElement.hidden = false;
  resultStatusElement.textContent = "Game over";
  if (timedMode) {
    resultPersonNameElement.textContent = `${score} total points`;
    resultPointsElement.textContent = String(score);
    resultUnitElement.textContent = `points out of ${roundCount * MAX_ROUND_POINTS}`;
  } else {
    resultPersonNameElement.textContent = `${correctAnswers} of ${roundCount} correct`;
    resultPointsElement.textContent = String(correctAnswers);
    resultUnitElement.textContent = `correct out of ${roundCount}`;
  }
  resultInstructionElement.textContent = "Choose New game to play again";
  clearResultPortrait();
  resultOverlay.className = "round-result round-result--game-over";
  resultOverlay.hidden = false;
}
async function advanceAfterRound() {
  if (!roundFinished || resultOverlay.hidden || gameFinished) return;
  if (currentRound >= roundCount) return showGameOver();
  currentRound += 1;
  await startRound();
}
function handleError(error) {
  console.error(error);
  stopTimer();
  countdownOverlay.hidden = true;
  setControls(false);
  setFeedback(error?.message || "The Supabase request failed.", "incorrect");
}

timerHudItem.hidden = !timedMode;
timingSettingSummary.textContent = timedMode ? "Timed · 20 seconds" : "Untimed · correct answers only";
placeSettingSummary.textContent = showPlacesInitially ? "Place names shown from the start" : "Place names hidden until the answer";
roundSettingSummary.textContent = `${requestedRounds} rounds`;
difficultySettingSummary.textContent = difficultyFilter === null
  ? "All difficulties"
  : `Difficulty ${difficultyFilter}`;
scoreLabelElement.textContent = timedMode ? "Total score" : "Correct";
document.body.classList.toggle("untimed-game", !timedMode);

guessForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!countdownOverlay.hidden) return;
  submitGuess();
});
revealButton.addEventListener("click", revealAnswer);
nextButton.addEventListener("click", advanceAfterRound);
newGameButton.addEventListener("click", startNewGame);
document.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.repeat && roundFinished && !resultOverlay.hidden && !gameFinished) {
    event.preventDefault();
    advanceAfterRound();
  }
});

startNewGame().catch(handleError);
