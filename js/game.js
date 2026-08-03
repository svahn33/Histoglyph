import {
  PERSONS_STORE,
  PLACES_STORE,
  getAllRecords,
  initializeDatabase,
  normalizeText
} from "./db.js";

import {
  fitSceneToPositions,
  getStoredOrCalculatedPosition,
  positionMarker
} from "./map.js";

const ROUND_LIMIT = 5;

const birthYearElement =
  document.querySelector("#birth-year");
const deathYearElement =
  document.querySelector("#death-year");
const roundNumberElement =
  document.querySelector("#round-number");
const roundTotalElement =
  document.querySelector("#round-total");
const scoreElement =
  document.querySelector("#score");
const guessForm =
  document.querySelector("#guess-form");
const guessInput =
  document.querySelector("#guess-input");
const guessButton =
  document.querySelector("#guess-button");
const feedbackElement =
  document.querySelector("#feedback");
const nextButton =
  document.querySelector("#next-button");
const revealButton =
  document.querySelector("#reveal-button");
const newGameButton =
  document.querySelector("#new-game-button");
const periodFilter =
  document.querySelector("#period-filter");
const mapViewport =
  document.querySelector("#map-viewport");
const mapScene =
  document.querySelector("#map-scene");
const birthMarker =
  document.querySelector("#birth-marker");
const deathMarker =
  document.querySelector("#death-marker");
const placeDetails =
  document.querySelector("#place-details");
const birthPlaceName =
  document.querySelector("#birth-place-name");
const deathPlaceName =
  document.querySelector("#death-place-name");
const dataWarning =
  document.querySelector("#data-warning");

let allPersons = [];
let placesById = new Map();
let availablePersons = [];
let usedPersonIds = new Set();
let currentPerson = null;
let currentBirthPlace = null;
let currentDeathPlace = null;
let currentPositions = [];
let currentRound = 1;
let score = 0;
let roundFinished = false;

function formatYear(year) {
  return year < 0
    ? `${Math.abs(year)} BC`
    : String(year);
}

function populatePeriodFilter() {
  const periods = [
    ...new Set(
      allPersons
        .map(person => person.period)
        .filter(Boolean)
    )
  ].sort((a, b) => a.localeCompare(b, "en"));

  periodFilter.replaceChildren(
    new Option("All periods", "all"),
    ...periods.map(
      period => new Option(period, period)
    )
  );
}

function getPlayablePersons() {
  return allPersons.filter(person => {
    if (!person.published) {
      return false;
    }

    const birthPlace =
      placesById.get(person.birthPlaceId);
    const deathPlace =
      placesById.get(person.deathPlaceId);

    return Boolean(birthPlace && deathPlace);
  });
}

function getFilteredPersons() {
  const playable = getPlayablePersons();

  if (periodFilter.value === "all") {
    return playable;
  }

  return playable.filter(
    person =>
      person.period === periodFilter.value
  );
}

function getNextPerson() {
  let unused = availablePersons.filter(
    person => !usedPersonIds.has(person.id)
  );

  if (unused.length === 0) {
    usedPersonIds.clear();
    unused = [...availablePersons];
  }

  return unused[
    Math.floor(Math.random() * unused.length)
  ];
}

function setFeedback(message, type = "neutral") {
  feedbackElement.textContent = message;
  feedbackElement.className =
    `feedback ${type}`;
}

function hidePlaceDetails() {
  placeDetails.hidden = true;
  birthPlaceName.textContent = "–";
  deathPlaceName.textContent = "–";
}

function revealPlaceDetails() {
  birthPlaceName.textContent =
    `${currentBirthPlace.name}, ${currentBirthPlace.country}`;
  deathPlaceName.textContent =
    `${currentDeathPlace.name}, ${currentDeathPlace.country}`;
  placeDetails.hidden = false;
}

function updateMap() {
  const birthPosition =
    getStoredOrCalculatedPosition(
      currentBirthPlace
    );
  const deathPosition =
    getStoredOrCalculatedPosition(
      currentDeathPlace
    );

  currentPositions = [
    birthPosition,
    deathPosition
  ];

  const samePlace =
    currentBirthPlace.id === currentDeathPlace.id;

  if (samePlace) {
    positionMarker(
      birthMarker,
      birthPosition,
      -0.55
    );
    positionMarker(
      deathMarker,
      deathPosition,
      0.55
    );
  } else {
    positionMarker(
      birthMarker,
      birthPosition
    );
    positionMarker(
      deathMarker,
      deathPosition
    );
  }

  const unverified = [
    currentBirthPlace,
    currentDeathPlace
  ].filter(
    place =>
      place.verificationStatus !==
      "manually_verified"
  );

  dataWarning.hidden = unverified.length === 0;

  requestAnimationFrame(() => {
    fitSceneToPositions(
      mapViewport,
      mapScene,
      currentPositions
    );
  });
}

function lockRound() {
  roundFinished = true;
  guessInput.disabled = true;
  guessButton.disabled = true;
  revealButton.disabled = true;
  nextButton.disabled = false;
  revealPlaceDetails();
}

function unlockRound() {
  roundFinished = false;
  guessInput.disabled = false;
  guessButton.disabled = false;
  revealButton.disabled = false;
  nextButton.disabled = true;
  hidePlaceDetails();
}

function startRound() {
  if (availablePersons.length === 0) {
    setFeedback(
      "There are no playable people in this period.",
      "incorrect"
    );
    return;
  }

  currentPerson = getNextPerson();
  usedPersonIds.add(currentPerson.id);

  currentBirthPlace =
    placesById.get(currentPerson.birthPlaceId);
  currentDeathPlace =
    placesById.get(currentPerson.deathPlaceId);

  birthYearElement.textContent =
    formatYear(currentPerson.birthYear);
  deathYearElement.textContent =
    formatYear(currentPerson.deathYear);
  roundNumberElement.textContent =
    currentRound;
  roundTotalElement.textContent =
    Math.min(
      ROUND_LIMIT,
      availablePersons.length
    );

  updateMap();
  guessInput.value = "";
  setFeedback("");
  unlockRound();
  guessInput.focus();
}

function startNewGame() {
  availablePersons = getFilteredPersons();
  usedPersonIds.clear();
  currentRound = 1;
  score = 0;
  scoreElement.textContent = score;
  startRound();
}

function isCorrectGuess(value) {
  const normalizedGuess = normalizeText(value);

  return [
    currentPerson.name,
    ...(currentPerson.acceptedAnswers || [])
  ]
    .map(normalizeText)
    .includes(normalizedGuess);
}

guessForm.addEventListener("submit", event => {
  event.preventDefault();

  if (!currentPerson || roundFinished) {
    return;
  }

  if (isCorrectGuess(guessInput.value)) {
    score += 100;
    scoreElement.textContent = score;

    setFeedback(
      `Correct! The person is ${currentPerson.name}.`,
      "correct"
    );
  } else {
    setFeedback(
      `Incorrect. The correct answer is ${currentPerson.name}.`,
      "incorrect"
    );
  }

  lockRound();
});

revealButton.addEventListener("click", () => {
  if (!currentPerson || roundFinished) {
    return;
  }

  setFeedback(
    `The correct answer is ${currentPerson.name}.`,
    "neutral"
  );

  lockRound();
});

nextButton.addEventListener("click", () => {
  const totalRounds = Math.min(
    ROUND_LIMIT,
    availablePersons.length
  );

  if (currentRound >= totalRounds) {
    lockRound();
    nextButton.disabled = true;

    setFeedback(
      `Game over. You scored ${score} out of ${totalRounds * 100} points.`,
      "neutral"
    );
    return;
  }

  currentRound += 1;
  startRound();
});

newGameButton.addEventListener(
  "click",
  startNewGame
);

periodFilter.addEventListener(
  "change",
  startNewGame
);

const resizeObserver = new ResizeObserver(() => {
  if (currentPositions.length > 0) {
    fitSceneToPositions(
      mapViewport,
      mapScene,
      currentPositions
    );
  }
});

resizeObserver.observe(mapViewport);

async function boot() {
  try {
    await initializeDatabase();

    const [places, persons] = await Promise.all([
      getAllRecords(PLACES_STORE),
      getAllRecords(PERSONS_STORE)
    ]);

    placesById = new Map(
      places.map(place => [place.id, place])
    );
    allPersons = persons;

    populatePeriodFilter();
    startNewGame();
  } catch (error) {
    console.error(error);

    setFeedback(
      "The local database could not be opened. Run the project through Live Server.",
      "incorrect"
    );
  }
}

boot();
