import {
  PERSONS_STORE,
  PLACES_STORE,
  getAllRecords,
  initializeDatabase,
  normalizeText
} from "./db.js";
import { DetailedWorldMap } from "./offline-world-map.js";
import {
  getLifeMapCollection,
  personMatchesCollection
} from "../data/game-catalog.js";

const ROUND_DURATION_MS = 20_000;
const COUNTDOWN_SECONDS = 3;
const MAX_ROUND_POINTS = 1000;
const TIMER_UPDATE_INTERVAL_MS = 50;

const gameParameters = new URLSearchParams(window.location.search);
const collectionId = gameParameters.get("collection");
const timedMode = gameParameters.get("timed") !== "0";
const showPlacesInitially = gameParameters.get("showPlaces") === "1";
const activeCollection = getLifeMapCollection(collectionId);
const requestedRounds = Number.parseInt(gameParameters.get("rounds"), 10);
const ROUND_LIMIT = Number.isFinite(requestedRounds)
  ? Math.max(1, Math.min(100, requestedRounds))
  : (activeCollection.roundLimit ?? 5);

const roundNumberElement = document.querySelector("#round-number");
const roundTotalElement = document.querySelector("#round-total");
const scoreElement = document.querySelector("#score");
const scoreLabelElement = document.querySelector("#score-label");
const roundTimerElement = document.querySelector("#round-timer");
const timerHudItem = document.querySelector("#timer-hud-item");
const timingSettingSummary = document.querySelector("#timing-setting-summary");
const placeSettingSummary = document.querySelector("#place-setting-summary");
const roundSettingSummary = document.querySelector("#round-setting-summary");
const countdownOverlay = document.querySelector("#round-countdown");
const countdownValue = document.querySelector("#countdown-value");
const resultOverlay = document.querySelector("#round-result");
const resultStatusElement = document.querySelector("#result-status");
const resultPersonNameElement = document.querySelector("#result-person-name");
const resultPointsElement = document.querySelector("#result-points");
const resultUnitElement = document.querySelector("#result-unit");
const resultInstructionElement = document.querySelector("#result-instruction");
const guessForm = document.querySelector("#guess-form");
const guessInput = document.querySelector("#guess-input");
const guessButton = document.querySelector("#guess-button");
const feedbackElement = document.querySelector("#feedback");
const nextButton = document.querySelector("#next-button");
const revealButton = document.querySelector("#reveal-button");
const newGameButton = document.querySelector("#new-game-button");
const dataWarning = document.querySelector("#data-warning");
const collectionTitle = document.querySelector("#collection-title");
const collectionDescription = document.querySelector("#collection-description");
const collectionBreadcrumb = document.querySelector("#collection-breadcrumb");

let allPersons = [];
let placesById = new Map();
let availablePersons = [];
let usedPersonIds = new Set();
let currentPerson = null;
let currentBirthPlace = null;
let currentDeathPlace = null;
let currentRound = 1;
let score = 0;
let correctAnswers = 0;
let roundFinished = true;
let gameFinished = false;
let roundStartedAt = 0;
let timerIntervalId = null;
let roundSequence = 0;

const worldMap = new DetailedWorldMap(document.querySelector("#game-map"));

collectionTitle.textContent = activeCollection.title;
collectionDescription.textContent = activeCollection.description;
collectionBreadcrumb.textContent = activeCollection.title;
document.title = `${activeCollection.title} — Histoglyph`;
timerHudItem.hidden = !timedMode;
timingSettingSummary.textContent = timedMode
  ? "Timed · 20 seconds"
  : "Untimed · correct answers only";
placeSettingSummary.textContent = showPlacesInitially
  ? "Place names shown from the start"
  : "Place names hidden until the answer";
roundSettingSummary.textContent = `${ROUND_LIMIT} ${ROUND_LIMIT === 1 ? "round" : "rounds"}`;
scoreLabelElement.textContent = timedMode ? "Total score" : "Correct";
document.body.classList.toggle("untimed-game", !timedMode);

function formatYear(year) {
  return year < 0 ? `${Math.abs(year)} BC` : String(year);
}

function delay(milliseconds) {
  return new Promise(resolve => window.setTimeout(resolve, milliseconds));
}

function getPlayablePersons() {
  return allPersons.filter(person => {
    if (!person.published || !personMatchesCollection(person, activeCollection)) {
      return false;
    }

    return Boolean(
      placesById.get(person.birthPlaceId) &&
      placesById.get(person.deathPlaceId)
    );
  });
}

function getNextPerson() {
  let unused = availablePersons.filter(person => !usedPersonIds.has(person.id));

  if (unused.length === 0) {
    usedPersonIds.clear();
    unused = [...availablePersons];
  }

  return unused[Math.floor(Math.random() * unused.length)];
}

function setFeedback(message, type = "neutral") {
  feedbackElement.textContent = message;
  feedbackElement.className = `feedback ${type}`;
}

function hidePlaceDetails() {
  worldMap.setPlaceNamesVisible(showPlacesInitially);
}

function revealPlaceDetails() {
  worldMap.setPlaceNamesVisible(true);
}

function calculateRoundPoints(elapsedMilliseconds) {
  const remainingFraction = Math.max(0, 1 - elapsedMilliseconds / ROUND_DURATION_MS);
  return Math.round(MAX_ROUND_POINTS * remainingFraction);
}

function updateTimerDisplay(elapsedMilliseconds) {
  if (!timedMode) return;
  const remainingMilliseconds = Math.max(0, ROUND_DURATION_MS - elapsedMilliseconds);
  roundTimerElement.textContent = (remainingMilliseconds / 1000).toFixed(1);
  document.body.classList.toggle(
    "round-time-low",
    remainingMilliseconds > 0 && remainingMilliseconds <= 5_000
  );
}

function resetTimerDisplay() {
  roundTimerElement.textContent = timedMode ? "20.0" : "∞";
  document.body.classList.remove("round-time-low");
}

function stopRoundTimer() {
  if (timerIntervalId !== null) {
    window.clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

function setAnswerControlsEnabled(enabled) {
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

async function updateMap() {
  const locations = [
    {
      type: "birth",
      label: `Born ${formatYear(currentPerson.birthYear)} in ${currentBirthPlace.name}`,
      year: formatYear(currentPerson.birthYear),
      placeName: `${currentBirthPlace.name}, ${currentBirthPlace.country}`,
      latitude: Number(currentBirthPlace.latitude),
      longitude: Number(currentBirthPlace.longitude)
    },
    {
      type: "death",
      label: `Died ${formatYear(currentPerson.deathYear)} in ${currentDeathPlace.name}`,
      year: formatYear(currentPerson.deathYear),
      placeName: `${currentDeathPlace.name}, ${currentDeathPlace.country}`,
      latitude: Number(currentDeathPlace.latitude),
      longitude: Number(currentDeathPlace.longitude)
    }
  ];

  await worldMap.setGameLocations(locations);
  worldMap.setPlaceNamesVisible(showPlacesInitially);
  await worldMap.fitToLocations(locations);

  const unverified = [currentBirthPlace, currentDeathPlace].filter(
    place => place.verificationStatus !== "manually_verified"
  );
  dataWarning.hidden = unverified.length === 0;
}

function hideResultOverlay() {
  resultOverlay.hidden = true;
  resultOverlay.classList.remove(
    "round-result--correct",
    "round-result--incorrect",
    "round-result--neutral",
    "round-result--game-over"
  );
}

function showRoundResult({ status, statusClass, awardedPoints, correct }) {
  resultStatusElement.textContent = status;
  resultPersonNameElement.textContent = currentPerson.name;

  if (timedMode) {
    resultPointsElement.textContent = String(awardedPoints);
    resultUnitElement.textContent = "points";
  } else {
    resultPointsElement.textContent = correct ? "1" : "0";
    resultUnitElement.textContent = "correct this round";
  }

  const isFinalRound = currentRound >= ROUND_LIMIT;
  resultInstructionElement.textContent = isFinalRound
    ? "Press Enter to see your final result"
    : "Press Enter for the next round";

  resultOverlay.classList.add(`round-result--${statusClass}`);
  resultOverlay.hidden = false;
}

function showGameOver() {
  gameFinished = true;
  nextButton.disabled = true;
  resultStatusElement.textContent = "Game over";

  if (timedMode) {
    resultPersonNameElement.textContent = `${score} total points`;
    resultPointsElement.textContent = String(score);
    resultUnitElement.textContent = `points out of ${ROUND_LIMIT * MAX_ROUND_POINTS}`;
    setFeedback(
      `Game over. You scored ${score} out of ${ROUND_LIMIT * MAX_ROUND_POINTS} points.`,
      "neutral"
    );
  } else {
    resultPersonNameElement.textContent = `${correctAnswers} of ${ROUND_LIMIT} correct`;
    resultPointsElement.textContent = String(correctAnswers);
    resultUnitElement.textContent = `correct out of ${ROUND_LIMIT}`;
    setFeedback(
      `Game over. You answered ${correctAnswers} of ${ROUND_LIMIT} correctly.`,
      "neutral"
    );
  }

  resultInstructionElement.textContent = "Choose New game to play again";
  resultOverlay.classList.remove(
    "round-result--correct",
    "round-result--incorrect",
    "round-result--neutral"
  );
  resultOverlay.classList.add("round-result--game-over");
  resultOverlay.hidden = false;
}

function lockRound() {
  roundFinished = true;
  stopRoundTimer();
  setAnswerControlsEnabled(false);
  nextButton.disabled = false;
  revealPlaceDetails();
}

function prepareRound() {
  roundFinished = true;
  gameFinished = false;
  stopRoundTimer();
  setAnswerControlsEnabled(false);
  nextButton.disabled = true;
  hidePlaceDetails();
  hideResultOverlay();
  resetTimerDisplay();
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

function finishRound({ status, statusClass, awardedPoints, correct = false }) {
  lockRound();

  if (correct) {
    correctAnswers += 1;
  }

  if (timedMode) {
    score += awardedPoints;
    scoreElement.textContent = String(score);
  } else {
    scoreElement.textContent = String(correctAnswers);
  }

  setFeedback("");
  showRoundResult({ status, statusClass, awardedPoints, correct });
}

function handleTimeExpired(sequence) {
  if (sequence !== roundSequence || roundFinished) return;
  updateTimerDisplay(ROUND_DURATION_MS);
  finishRound({ status: "Time is up", statusClass: "incorrect", awardedPoints: 0, correct: false });
}

function startActiveRound(sequence) {
  if (sequence !== roundSequence) return;

  roundFinished = false;
  roundStartedAt = performance.now();
  setAnswerControlsEnabled(true);
  guessInput.focus();

  if (!timedMode) {
    return;
  }

  updateTimerDisplay(0);

  timerIntervalId = window.setInterval(() => {
    if (sequence !== roundSequence || roundFinished) {
      stopRoundTimer();
      return;
    }

    const elapsed = performance.now() - roundStartedAt;
    if (elapsed >= ROUND_DURATION_MS) {
      handleTimeExpired(sequence);
      return;
    }
    updateTimerDisplay(elapsed);
  }, TIMER_UPDATE_INTERVAL_MS);
}

async function startRound() {
  const sequence = ++roundSequence;
  prepareRound();

  if (availablePersons.length === 0) {
    countdownOverlay.hidden = true;
    setFeedback("There are no playable people in this collection yet.", "incorrect");
    return;
  }

  currentPerson = getNextPerson();
  usedPersonIds.add(currentPerson.id);
  currentBirthPlace = placesById.get(currentPerson.birthPlaceId);
  currentDeathPlace = placesById.get(currentPerson.deathPlaceId);

  roundNumberElement.textContent = String(currentRound);
  roundTotalElement.textContent = String(ROUND_LIMIT);
  guessInput.value = "";
  setFeedback("");

  await updateMap();
  if (sequence !== roundSequence) return;

  const countdownCompleted = await runCountdown(sequence);
  if (!countdownCompleted) return;
  startActiveRound(sequence);
}

async function startNewGame() {
  roundSequence += 1;
  stopRoundTimer();
  countdownOverlay.hidden = true;
  hideResultOverlay();

  availablePersons = getPlayablePersons();
  usedPersonIds.clear();
  currentRound = 1;
  score = 0;
  correctAnswers = 0;
  scoreElement.textContent = "0";

  await startRound();
}

function isCorrectGuess(value) {
  const normalizedGuess = normalizeText(value);
  return [currentPerson.name, ...(currentPerson.acceptedAnswers || [])]
    .map(normalizeText)
    .includes(normalizedGuess);
}

function submitGuess() {
  if (!currentPerson || roundFinished) return;

  const elapsed = timedMode ? Math.min(ROUND_DURATION_MS, performance.now() - roundStartedAt) : 0;

  if (isCorrectGuess(guessInput.value)) {
    updateTimerDisplay(elapsed);
    finishRound({
      status: "Correct",
      statusClass: "correct",
      awardedPoints: timedMode ? calculateRoundPoints(elapsed) : 0,
      correct: true
    });
  } else {
    finishRound({ status: "Incorrect", statusClass: "incorrect", awardedPoints: 0, correct: false });
  }
}

guessForm.addEventListener("submit", event => {
  event.preventDefault();
  if (roundFinished && !countdownOverlay.hidden) return;
  submitGuess();
});

revealButton.addEventListener("click", () => {
  if (!currentPerson || roundFinished) return;
  finishRound({ status: "Answer revealed", statusClass: "neutral", awardedPoints: 0, correct: false });
});

async function advanceAfterRound() {
  if (!roundFinished || resultOverlay.hidden || gameFinished) return;

  if (currentRound >= ROUND_LIMIT) {
    showGameOver();
    return;
  }

  currentRound += 1;
  await startRound();
}

nextButton.addEventListener("click", advanceAfterRound);

document.addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.repeat) return;
  if (roundFinished && !resultOverlay.hidden && !gameFinished) {
    event.preventDefault();
    advanceAfterRound();
  }
});

newGameButton.addEventListener("click", startNewGame);

async function boot() {
  try {
    await initializeDatabase();

    const [places, persons] = await Promise.all([
      getAllRecords(PLACES_STORE),
      getAllRecords(PERSONS_STORE)
    ]);

    placesById = new Map(places.map(place => [place.id, place]));
    allPersons = persons;
    await startNewGame();
  } catch (error) {
    console.error(error);
    countdownOverlay.hidden = true;
    hideResultOverlay();
    setFeedback(
      "The map or local database could not be opened. Run the project through Live Server.",
      "incorrect"
    );
  }
}

boot();
