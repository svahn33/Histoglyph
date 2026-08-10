import { supabase, isSupabaseConfigured } from "./supabase-client.js";
const PORTRAIT_BUCKET = "person-images";

const card = document.querySelector("#hero-person-card");
const image = document.querySelector("#hero-person-image");
const placeholder = document.querySelector("#hero-person-image-placeholder");
const name = document.querySelector("#hero-person-name");
const birth = document.querySelector("#hero-person-birth");
const death = document.querySelector("#hero-person-death");
const birthYear = document.querySelector("#hero-birth-year");
const birthPlace = document.querySelector("#hero-birth-place");
const deathYear = document.querySelector("#hero-death-year");
const deathPlace = document.querySelector("#hero-death-place");

function setText(node, value) {
  if (node && value !== undefined && value !== null && String(value).trim() !== "") {
    node.textContent = String(value);
  }
}

async function loadFeaturedPerson() {
  if (!card || !image || !isSupabaseConfigured() || !supabase) return;

  const { data, error } = await supabase.rpc("get_homepage_featured_person", {
    p_name: "Albert Einstein"
  });

  if (error || !data) {
    card.classList.remove("hero-person-card--loading");
    return;
  }

  setText(name, data.name);
  setText(birth, `${data.birth_year} · ${data.birth_place_name}`);
  setText(death, `${data.death_year} · ${data.death_place_name}`);
  setText(birthYear, data.birth_year);
  setText(birthPlace, data.birth_place_name);
  setText(deathYear, data.death_year);
  setText(deathPlace, data.death_place_name);

  if (!data.image_path) {
    card.classList.remove("hero-person-card--loading");
    return;
  }

  const { data: publicData } = supabase.storage
    .from(PORTRAIT_BUCKET)
    .getPublicUrl(data.image_path);

  if (!publicData?.publicUrl) {
    card.classList.remove("hero-person-card--loading");
    return;
  }

  image.addEventListener("load", () => {
    placeholder.hidden = true;
    image.hidden = false;
    card.classList.remove("hero-person-card--loading");
    card.classList.add("hero-person-card--loaded");
  }, { once: true });

  image.addEventListener("error", () => {
    card.classList.remove("hero-person-card--loading");
  }, { once: true });

  image.src = publicData.publicUrl;
}

loadFeaturedPerson().catch(() => {
  card?.classList.remove("hero-person-card--loading");
});
