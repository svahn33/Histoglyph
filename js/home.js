import { GAME_MODES } from "../data/game-catalog.js";

const modeGrid = document.querySelector("#game-mode-grid");

function createModeCard(mode) {
  const article = document.createElement("article");
  article.className = `mode-card mode-card--${mode.status}`;

  const top = document.createElement("div");
  top.className = "mode-card-top";

  const eyebrow = document.createElement("span");
  eyebrow.className = "mode-card-eyebrow";
  eyebrow.textContent = mode.eyebrow;

  const badge = document.createElement("span");
  badge.className = `status-badge status-badge--${mode.status}`;
  badge.textContent = mode.status === "available" ? "Play now" : "Coming soon";

  top.append(eyebrow, badge);

  const heading = document.createElement("h2");
  heading.textContent = mode.title;

  const description = document.createElement("p");
  description.textContent = mode.description;

  const footer = document.createElement("div");
  footer.className = "mode-card-footer";

  if (mode.status === "available") {
    const link = document.createElement("a");
    link.className = "primary-button mode-card-action";
    link.href = mode.href;
    link.textContent = "Choose collection";
    footer.append(link);
    article.classList.add("mode-card--clickable");
    article.addEventListener("click", event => {
      if (!event.target.closest("a")) window.location.href = mode.href;
    });
  } else {
    const text = document.createElement("span");
    text.className = "mode-card-disabled-text";
    text.textContent = "This mode is prepared for a future release.";
    footer.append(text);
  }

  article.append(top, heading, description, footer);
  return article;
}

modeGrid.replaceChildren(...GAME_MODES.map(createModeCard));
