import { requireSupabase } from "./supabase-client.js";
import { DetailedWorldMap } from "./offline-world-map.js";

const supabase = requireSupabase();
const $ = id => document.querySelector(`#${id}`);
const PAGE_SIZE = 50;
const PORTRAIT_BUCKET = "person-images";
const PORTRAIT_MAX_DIMENSION = 1000;
const state = {
  placePage: 0,
  personPage: 0,
  placeCount: 0,
  personCount: 0,
  selectedPlace: null,
  selectedPerson: null,
  map: null,
  portraitObjectUrl: null,
  removePortrait: false
};
let searchTimer;

function message(target, text, type = "neutral") {
  target.textContent = text;
  target.className = `validation-panel ${type === "error" ? "validation-error" : type === "success" ? "validation-success" : ""}`;
}
function normalizeSlug(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function formatPlace(place) { return `${place.name}, ${place.country}`; }
function portraitPublicUrl(path) {
  if (!path) return "";
  return supabase.storage.from(PORTRAIT_BUCKET).getPublicUrl(path).data.publicUrl;
}
function revokePortraitObjectUrl() {
  if (state.portraitObjectUrl) URL.revokeObjectURL(state.portraitObjectUrl);
  state.portraitObjectUrl = null;
}
function showPortraitPreview(url = "") {
  const image = $("person-portrait-preview");
  const empty = $("person-portrait-empty");
  if (url) {
    image.src = url;
    image.hidden = false;
    empty.hidden = true;
  } else {
    image.removeAttribute("src");
    image.hidden = true;
    empty.hidden = false;
  }
}
function resetPortraitEditor() {
  revokePortraitObjectUrl();
  state.removePortrait = false;
  $("person-portrait-file").value = "";
  $("person-image-credit").value = "";
  $("person-image-license").value = "";
  $("person-image-source-url").value = "";
  $("remove-person-portrait").disabled = true;
  showPortraitPreview();
}
function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("The selected image could not be read.")); };
    image.src = url;
  });
}
async function preparePortraitBlob(file) {
  if (!file || !file.type.startsWith("image/")) throw new Error("Choose a JPEG, PNG or WebP image.");
  if (file.size > 20 * 1024 * 1024) throw new Error("The source image is larger than 20 MB.");
  const image = await loadImageElement(file);
  const scale = Math.min(1, PORTRAIT_MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", 0.84));
  if (!blob) throw new Error("The browser could not convert the portrait to WebP.");
  return blob;
}
async function uploadPortrait(personId, file) {
  const blob = await preparePortraitBlob(file);
  const path = `persons/${personId}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(PORTRAIT_BUCKET).upload(path, blob, {
    cacheControl: "31536000",
    contentType: "image/webp",
    upsert: false
  });
  if (error) throw new Error(`Portrait upload failed: ${error.message}`);
  return path;
}
async function removePortraitObject(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(PORTRAIT_BUCKET).remove([path]);
  if (error) console.warn("Could not remove old portrait object:", error);
}
function debounce(fn) { clearTimeout(searchTimer); searchTimer = setTimeout(fn, 250); }
function setTab(name) {
  document.querySelectorAll(".tab-button").forEach(button => button.classList.toggle("active", button.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach(panel => panel.hidden = panel.id !== `tab-${name}`);
}
function recordButton(title, subtitle, active, handler, status) {
  const button = document.createElement("button"); button.type = "button"; button.className = `record-item${active ? " active" : ""}`;
  const strong = document.createElement("strong"); strong.textContent = title;
  const span = document.createElement("span");
  if (status) { const dot = document.createElement("i"); dot.className = `status-dot status-${status}`; span.append(dot); }
  span.append(document.createTextNode(subtitle)); button.append(strong, span); button.addEventListener("click", handler); return button;
}
async function requireAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;
  const { data, error } = await supabase.rpc("is_histoglyph_admin");
  if (error || !data) return false;
  $("admin-user-email").textContent = session.user.email || "Administrator";
  return true;
}
async function showApp() {
  $("admin-auth-gate").hidden = true; $("admin-app").hidden = false;
  if (!state.map) {
    state.map = new DetailedWorldMap($("admin-map"), {
      editable: true,
      onLocationChange({ latitude, longitude }) {
        $("place-latitude").value = latitude.toFixed(6); $("place-longitude").value = longitude.toFixed(6);
      }
    });
  }
  await Promise.all([refreshMetrics(), loadPlaces(), loadPersons()]);
  clearPlace(); clearPerson();
}
async function refreshMetrics() {
  const queries = [
    supabase.from("places").select("id", { count: "exact", head: true }),
    supabase.from("places").select("id", { count: "exact", head: true }).eq("verification_status", "manually_verified"),
    supabase.from("places").select("id", { count: "exact", head: true }).neq("verification_status", "manually_verified"),
    supabase.from("persons").select("id", { count: "exact", head: true })
  ];
  const [places, verified, review, persons] = await Promise.all(queries);
  $("metric-places").textContent = places.count ?? 0; $("metric-verified").textContent = verified.count ?? 0;
  $("metric-review").textContent = review.count ?? 0; $("metric-persons").textContent = persons.count ?? 0;
}
async function loadPlaces() {
  const query = $("place-search").value.trim(); const status = $("place-status-filter").value;
  let request = supabase.from("places").select("*", { count: "exact" }).order("name").range(state.placePage * PAGE_SIZE, state.placePage * PAGE_SIZE + PAGE_SIZE - 1);
  if (query) request = request.ilike("search_text", `%${query}%`);
  if (status !== "all") request = request.eq("verification_status", status);
  const { data, count, error } = await request; if (error) return message($("place-validation"), error.message, "error");
  state.placeCount = count || 0;
  $("place-list").replaceChildren(...(data || []).map(place => recordButton(place.name, `${place.country} · ${place.verification_status.replaceAll("_", " ")}`, state.selectedPlace?.id === place.id, () => loadPlace(place.id), place.verification_status)));
  $("place-page-label").textContent = `Page ${state.placePage + 1} · ${state.placeCount} results`;
  $("place-prev").disabled = state.placePage === 0; $("place-next").disabled = (state.placePage + 1) * PAGE_SIZE >= state.placeCount;
}
async function loadPlace(id) {
  const { data, error } = await supabase.from("places").select("*").eq("id", id).single(); if (error) return message($("place-validation"), error.message, "error");
  state.selectedPlace = data; $("place-id").value = data.id; $("place-name").value = data.name; $("place-country").value = data.country;
  $("place-latitude").value = data.latitude; $("place-longitude").value = data.longitude; $("place-precision").value = data.precision;
  $("place-verification-status").value = data.verification_status; $("place-source").value = data.source || ""; $("place-source-id").value = data.source_id || ""; $("place-notes").value = data.notes || "";
  $("place-editor-title").textContent = formatPlace(data); $("place-id-badge").textContent = data.legacy_id || data.id; $("delete-place-button").disabled = false;
  await state.map.setEditableLocation(data.latitude, data.longitude); await state.map.focusEditableLocation(false); await loadPlaces();
}
function clearPlace() {
  state.selectedPlace = null; $("place-form").reset(); $("place-id").value = ""; $("place-editor-title").textContent = "New place"; $("place-id-badge").textContent = "Unsaved"; $("delete-place-button").disabled = true;
  $("place-precision").value = "locality"; $("place-verification-status").value = "unverified"; state.map?.setEditableLocation(20, 0); state.map?.zoomToRegion("world", false); loadPlaces();
}
async function savePlace(event) {
  event.preventDefault();
  const payload = { name: $("place-name").value.trim(), country: $("place-country").value.trim(), latitude: Number($("place-latitude").value), longitude: Number($("place-longitude").value), precision: $("place-precision").value, verification_status: $("place-verification-status").value, source: $("place-source").value.trim() || null, source_id: $("place-source-id").value.trim() || null, notes: $("place-notes").value.trim() || null };
  if (state.selectedPlace?.id) payload.id = state.selectedPlace.id;
  const { data, error } = await supabase.from("places").upsert(payload).select().single();
  if (error) return message($("place-validation"), error.message, "error");
  message($("place-validation"), "Place saved in Supabase.", "success"); await refreshMetrics(); await loadPlace(data.id);
}
async function deletePlace() {
  if (!state.selectedPlace || !confirm("Delete this place?")) return;
  const { error } = await supabase.from("places").delete().eq("id", state.selectedPlace.id);
  if (error) return message($("place-validation"), error.message, "error"); clearPlace(); await refreshMetrics();
}
async function nextReview() {
  const { data, error } = await supabase.from("places").select("id").neq("verification_status", "manually_verified").order("updated_at").limit(1).maybeSingle();
  if (error) return message($("place-validation"), error.message, "error"); if (data) loadPlace(data.id); else message($("place-validation"), "Every place is verified.", "success");
}
async function loadPersons() {
  const query = $("person-search").value.trim();
  const difficulty = $("person-difficulty-filter").value;
  const verification = $("person-verification-filter").value;
  let request = supabase.from("persons").select("id,name,period,difficulty,published,verification_status,birth_place:places!persons_birth_place_id_fkey(name),death_place:places!persons_death_place_id_fkey(name)", { count: "exact" }).order("name").range(state.personPage * PAGE_SIZE, state.personPage * PAGE_SIZE + PAGE_SIZE - 1);
  if (query) request = request.ilike("search_text", `%${query}%`);
  if (difficulty !== "all") request = request.eq("difficulty", Number(difficulty));
  if (verification === "verified") request = request.eq("verification_status", "manually_verified");
  if (verification === "not_verified") request = request.neq("verification_status", "manually_verified");
  const { data, count, error } = await request; if (error) return message($("person-validation"), error.message, "error");
  state.personCount = count || 0;
  $("person-list").replaceChildren(...(data || []).map(person => recordButton(person.name, `${person.birth_place?.name || "?"} → ${person.death_place?.name || "?"} · difficulty ${person.difficulty}${person.published ? " · published" : ""}`, state.selectedPerson?.id === person.id, () => loadPerson(person.id), person.verification_status)));
  $("person-page-label").textContent = `Page ${state.personPage + 1} · ${state.personCount} results`;
  $("person-prev").disabled = state.personPage === 0; $("person-next").disabled = (state.personPage + 1) * PAGE_SIZE >= state.personCount;
}
async function loadPerson(id) {
  const { data, error } = await supabase.from("persons").select("*,birth_place:places!persons_birth_place_id_fkey(id,name,country,verification_status),death_place:places!persons_death_place_id_fkey(id,name,country,verification_status),accepted_answers(answer),person_tags(tags(slug))").eq("id", id).single();
  if (error) return message($("person-validation"), error.message, "error"); state.selectedPerson = data;
  $("person-id").value = data.id; $("person-name").value = data.name; $("person-period").value = data.period; $("person-birth-year").value = data.birth_year; $("person-death-year").value = data.death_year;
  $("person-difficulty").value = data.difficulty; $("person-verification-status").value = data.verification_status; $("person-published").checked = data.published;
  $("person-accepted-answers").value = (data.accepted_answers || []).map(x => x.answer).join("\n"); $("person-tags").value = (data.person_tags || []).map(x => x.tags?.slug).filter(Boolean).join("\n");
  revokePortraitObjectUrl(); state.removePortrait = false; $("person-portrait-file").value = "";
  $("person-image-credit").value = data.image_credit || ""; $("person-image-license").value = data.image_license || ""; $("person-image-source-url").value = data.image_source_url || "";
  showPortraitPreview(data.image_path ? portraitPublicUrl(data.image_path) : ""); $("remove-person-portrait").disabled = !data.image_path;
  selectPlace("birth", data.birth_place); selectPlace("death", data.death_place); $("person-editor-title").textContent = data.name; $("person-id-badge").textContent = data.legacy_id || data.id; $("delete-person-button").disabled = false; await loadPersons();
}
function clearPerson() {
  state.selectedPerson = null; $("person-form").reset(); $("person-id").value = ""; $("birth-place-id").value = ""; $("death-place-id").value = ""; $("birth-place-selected").textContent = "No place selected"; $("death-place-selected").textContent = "No place selected"; $("person-editor-title").textContent = "New person"; $("person-id-badge").textContent = "Unsaved"; $("delete-person-button").disabled = true; $("person-difficulty").value = "1"; $("person-verification-status").value = "unverified"; resetPortraitEditor(); loadPersons();
}
function selectPlace(prefix, place) {
  $(`${prefix}-place-id`).value = place?.id || ""; $(`${prefix}-place-selected`).textContent = place ? `${place.name}, ${place.country} · ${place.verification_status.replaceAll("_", " ")}` : "No place selected"; $(`${prefix}-place-search`).value = ""; $(`${prefix}-place-suggestions`).replaceChildren();
}
function setupPlacePicker(prefix) {
  $(`${prefix}-place-search`).addEventListener("input", () => debounce(async () => {
    const query = $(`${prefix}-place-search`).value.trim(); if (!query) return $(`${prefix}-place-suggestions`).replaceChildren();
    const { data } = await supabase.from("places").select("id,name,country,verification_status").ilike("search_text", `%${query}%`).order("name").limit(10);
    $(`${prefix}-place-suggestions`).replaceChildren(...(data || []).map(place => { const b = document.createElement("button"); b.type = "button"; b.className = "suggestion-button"; b.textContent = `${place.name}, ${place.country}`; b.addEventListener("click", () => selectPlace(prefix, place)); return b; }));
  }));
}
async function savePerson(event) {
  event.preventDefault();
  const selectedFile = $("person-portrait-file").files[0] || null;
  const previousPath = state.selectedPerson?.image_path || null;
  const basePayload = {
    id: state.selectedPerson?.id || null,
    legacy_id: state.selectedPerson?.legacy_id || null,
    name: $("person-name").value.trim(),
    period: $("person-period").value.trim(),
    birth_year: Number($("person-birth-year").value),
    death_year: Number($("person-death-year").value),
    birth_place_id: $("birth-place-id").value,
    death_place_id: $("death-place-id").value,
    difficulty: Number($("person-difficulty").value),
    verification_status: $("person-verification-status").value,
    published: $("person-published").checked,
    accepted_answers: $("person-accepted-answers").value.split(/\r?\n/).map(x => x.trim()).filter(Boolean),
    tags: $("person-tags").value.split(/\r?\n/).map(normalizeSlug).filter(Boolean),
    image_credit: $("person-image-credit").value.trim() || null,
    image_source_url: $("person-image-source-url").value.trim() || null,
    image_license: $("person-image-license").value.trim() || null
  };

  try {
    message($("person-validation"), selectedFile ? "Saving person and preparing portrait…" : "Saving person…");

    // First save guarantees that a new person has a stable UUID for a neutral Storage path.
    const initialPayload = { ...basePayload };
    if (state.removePortrait) initialPayload.image_path = null;
    else if (previousPath) initialPayload.image_path = previousPath;
    const initial = await supabase.rpc("admin_upsert_person", { p_payload: initialPayload });
    if (initial.error) throw initial.error;
    const personId = initial.data;

    let finalPath = state.removePortrait ? null : previousPath;
    let uploadedPath = null;
    if (selectedFile) {
      message($("person-validation"), "Uploading compressed portrait…");
      uploadedPath = await uploadPortrait(personId, selectedFile);
      finalPath = uploadedPath;
      const finalSave = await supabase.rpc("admin_upsert_person", {
        p_payload: { ...basePayload, id: personId, image_path: finalPath }
      });
      if (finalSave.error) {
        await removePortraitObject(uploadedPath);
        throw finalSave.error;
      }
    }

    if ((state.removePortrait || selectedFile) && previousPath && previousPath !== finalPath) {
      await removePortraitObject(previousPath);
    }

    message($("person-validation"), selectedFile ? "Person and portrait saved in Supabase." : "Person saved in Supabase.", "success");
    await refreshMetrics();
    await loadPerson(personId);
  } catch (error) {
    message($("person-validation"), error.message || String(error), "error");
  }
}
async function deletePerson() {
  if (!state.selectedPerson || !confirm("Delete this person?")) return;
  const portraitPath = state.selectedPerson.image_path || null;
  const { error } = await supabase.from("persons").delete().eq("id", state.selectedPerson.id);
  if (error) return message($("person-validation"), error.message, "error");
  if (portraitPath) await removePortraitObject(portraitPath);
  clearPerson(); await refreshMetrics();
}
function parseCsv(text) {
  const rows=[]; let row=[], field="", quoted=false;
  for (let i=0;i<text.length;i++){const c=text[i]; if(quoted){if(c==='"'&&text[i+1]==='"'){field+='"';i++;}else if(c==='"')quoted=false;else field+=c;}else if(c==='"')quoted=true;else if(c===','){row.push(field);field="";}else if(c==='\n'){row.push(field);rows.push(row);row=[];field="";}else if(c!=='\r')field+=c;}
  row.push(field); if(row.some(Boolean)) rows.push(row); if(!rows.length)return[]; const headers=rows.shift().map(x=>x.trim()); return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]||""])));
}
function chunk(array, size=100){const out=[];for(let i=0;i<array.length;i+=size)out.push(array.slice(i,i+size));return out;}
async function importCsv(kind) {
  const input = kind === "places" ? $("import-places-file") : $("import-persons-file"); const file=input.files[0]; if(!file)return message($("transfer-status"),"Choose a CSV file first.","error");
  const rows=parseCsv(await file.text()); let imported=0; message($("transfer-status"),`Importing ${rows.length} rows…`);
  for(const part of chunk(rows,100)){const fn=kind==="places"?"admin_import_places":"admin_import_people";const {data,error}=await supabase.rpc(fn,{p_rows:part});if(error)return message($("transfer-status"),error.message,"error");imported+=Number(data||0);message($("transfer-status"),`Imported ${imported} of ${rows.length}…`);}
  message($("transfer-status"),`${imported} ${kind} imported successfully.`,"success"); await Promise.all([refreshMetrics(),loadPlaces(),loadPersons()]);
}
async function fetchAll(table, select="*") { const result=[]; for(let from=0;;from+=1000){const {data,error}=await supabase.from(table).select(select).range(from,from+999);if(error)throw error;result.push(...data);if(data.length<1000)return result;} }
function download(name,text,type){const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
function csvEscape(value){const s=String(value??"");return /[",\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;}
function toCsv(rows, cols){return [cols.join(","),...rows.map(r=>cols.map(c=>csvEscape(r[c])).join(","))].join("\n");}
async function exportData(format) {
  try { message($("transfer-status"),"Preparing export…"); const places=await fetchAll("places"); const persons=await fetchAll("persons","*,accepted_answers(answer),person_tags(tags(slug))");
    if(format==="json") download("histoglyph-supabase-backup.json",JSON.stringify({exported_at:new Date().toISOString(),places,persons},null,2),"application/json");
    if(format==="places") download("places.csv",toCsv(places.map(p=>({id:p.legacy_id||p.id,name:p.name,country:p.country,latitude:p.latitude,longitude:p.longitude,precision:p.precision,verification_status:p.verification_status,source:p.source||"",source_id:p.source_id||"",notes:p.notes||""})),["id","name","country","latitude","longitude","precision","verification_status","source","source_id","notes"]),"text/csv");
    if(format==="persons") download("persons.csv",toCsv(persons.map(p=>({id:p.legacy_id||p.id,name:p.name,accepted_answers:(p.accepted_answers||[]).map(a=>a.answer).join("|"),tags:(p.person_tags||[]).map(t=>t.tags?.slug).filter(Boolean).join("|"),period:p.period,birth_year:p.birth_year,death_year:p.death_year,birth_place_id:p.birth_place_id,death_place_id:p.death_place_id,difficulty:p.difficulty,verification_status:p.verification_status,published:p.published,image_path:p.image_path||"",image_credit:p.image_credit||"",image_source_url:p.image_source_url||"",image_license:p.image_license||""})),["id","name","accepted_answers","tags","period","birth_year","death_year","birth_place_id","death_place_id","difficulty","verification_status","published","image_path","image_credit","image_source_url","image_license"]),"text/csv");
    message($("transfer-status"),"Export ready.","success");
  } catch(error){message($("transfer-status"),error.message,"error");}
}

$("admin-login-form").addEventListener("submit", async event => { event.preventDefault(); $("admin-login-status").textContent="Signing in…"; const {error}=await supabase.auth.signInWithPassword({email:$("admin-email").value,password:$("admin-password").value}); if(error)return $("admin-login-status").textContent=error.message; if(await requireAdmin())showApp(); else {await supabase.auth.signOut();$("admin-login-status").textContent="This account is not listed in admin_users.";} });
$("admin-sign-out").addEventListener("click",async()=>{await supabase.auth.signOut();location.reload();});
document.querySelectorAll(".tab-button").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
$("place-search").addEventListener("input",()=>debounce(()=>{state.placePage=0;loadPlaces();})); $("place-status-filter").addEventListener("change",()=>{state.placePage=0;loadPlaces();});
$("person-search").addEventListener("input",()=>debounce(()=>{state.personPage=0;loadPersons();}));
$("person-difficulty-filter").addEventListener("change",()=>{state.personPage=0;loadPersons();});
$("person-verification-filter").addEventListener("change",()=>{state.personPage=0;loadPersons();});
$("place-prev").addEventListener("click",()=>{state.placePage=Math.max(0,state.placePage-1);loadPlaces();}); $("place-next").addEventListener("click",()=>{state.placePage++;loadPlaces();});
$("person-prev").addEventListener("click",()=>{state.personPage=Math.max(0,state.personPage-1);loadPersons();}); $("person-next").addEventListener("click",()=>{state.personPage++;loadPersons();});
$("new-place-button").addEventListener("click",clearPlace); $("next-review-button").addEventListener("click",nextReview); $("place-form").addEventListener("submit",savePlace); $("delete-place-button").addEventListener("click",deletePlace);
$("new-person-button").addEventListener("click",clearPerson); $("person-form").addEventListener("submit",savePerson); $("delete-person-button").addEventListener("click",deletePerson);
setupPlacePicker("birth"); setupPlacePicker("death");
["place-latitude","place-longitude"].forEach(id=>$(id).addEventListener("input",()=>{const lat=Number($("place-latitude").value),lon=Number($("place-longitude").value);if(Number.isFinite(lat)&&Number.isFinite(lon))state.map?.setEditableLocation(lat,lon);}));
document.querySelectorAll("[data-admin-region]").forEach(button=>button.addEventListener("click",()=>{document.querySelectorAll("[data-admin-region]").forEach(x=>x.classList.remove("active"));button.classList.add("active");state.map.zoomToRegion(button.dataset.adminRegion);}));
$("import-places-button").addEventListener("click",()=>importCsv("places")); $("import-persons-button").addEventListener("click",()=>importCsv("persons"));
$("export-json-button").addEventListener("click",()=>exportData("json")); $("export-places-csv-button").addEventListener("click",()=>exportData("places")); $("export-persons-csv-button").addEventListener("click",()=>exportData("persons"));
$("person-portrait-file").addEventListener("change", () => {
  revokePortraitObjectUrl();
  const file = $("person-portrait-file").files[0];
  if (!file) {
    showPortraitPreview(state.removePortrait ? "" : portraitPublicUrl(state.selectedPerson?.image_path));
    return;
  }
  state.removePortrait = false;
  state.portraitObjectUrl = URL.createObjectURL(file);
  showPortraitPreview(state.portraitObjectUrl);
  $("remove-person-portrait").disabled = false;
});
$("remove-person-portrait").addEventListener("click", () => {
  revokePortraitObjectUrl();
  state.removePortrait = true;
  $("person-portrait-file").value = "";
  showPortraitPreview();
  $("remove-person-portrait").disabled = true;
});

if (await requireAdmin()) await showApp();
