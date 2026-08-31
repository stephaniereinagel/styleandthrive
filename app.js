const state = {
  tab: "home",
  catalogue: null,
  menus: null,
  /** Monday date (YYYY-MM-DD) of the week being viewed on Outfits */
  weekMonday: null,
  season: "summer",
  ratingFilter: "all",
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_SLUGS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const SEASON_ORDER = ["spring", "summer", "fall", "winter"];
const SEASON_START_MONTH = { spring: 3, summer: 6, fall: 9, winter: 12 };
const USER_ITEMS_KEY = "snt-user-items-v1";

function pad(n) {
  return String(n).padStart(2, "0");
}

function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseISODate(iso) {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, m - 1, day);
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d, n) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday of the week containing date d (week runs Mon–Sun). */
function mondayOf(d) {
  const x = startOfDay(d);
  const dow = x.getDay(); // 0 Sun … 6 Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(x, offset);
}

/** First Monday on or after the 1st of `month` (1–12) in `year`. */
function firstMondayOfMonth(year, month) {
  const first = new Date(year, month - 1, 1);
  const dow = first.getDay();
  const add = dow === 0 ? 1 : dow === 1 ? 0 : 8 - dow;
  return addDays(first, add);
}

/**
 * Season starts: first Monday of March, June, September, December.
 * Returns { key, start, endExclusive, label }
 */
function seasonForDate(d) {
  const day = startOfDay(d);
  const y = day.getFullYear();

  const candidates = [
    { key: "winter", start: firstMondayOfMonth(y - 1, 12) },
    { key: "spring", start: firstMondayOfMonth(y, 3) },
    { key: "summer", start: firstMondayOfMonth(y, 6) },
    { key: "fall", start: firstMondayOfMonth(y, 9) },
    { key: "winter", start: firstMondayOfMonth(y, 12) },
    { key: "spring", start: firstMondayOfMonth(y + 1, 3) },
  ];

  let current = candidates[0];
  for (let i = 0; i < candidates.length - 1; i++) {
    if (day >= candidates[i].start && day < candidates[i + 1].start) {
      current = candidates[i];
      return {
        key: current.key,
        start: current.start,
        endExclusive: candidates[i + 1].start,
      };
    }
  }
  return {
    key: "winter",
    start: firstMondayOfMonth(y, 12),
    endExclusive: firstMondayOfMonth(y + 1, 3),
  };
}

/** 0-based week index within the season (Mon weeks), then mod 3 for rotation. */
function weekPlanForMonday(monday) {
  const season = seasonForDate(monday);
  const ms = monday - season.start;
  const weekIndex = Math.max(0, Math.floor(ms / (7 * 24 * 60 * 60 * 1000)));
  const rotation = weekIndex % 3;
  const seasonData = state.menus.seasons[season.key];
  const menu = seasonData.menus.find((m) => m.rotation_index === rotation) || seasonData.menus[rotation];
  return { season, weekIndex, rotation, menu, seasonData };
}

function formatWeekRange(monday) {
  const sunday = addDays(monday, 6);
  const opts = { month: "short", day: "numeric" };
  const sameYear = monday.getFullYear() === sunday.getFullYear();
  const left = monday.toLocaleDateString(undefined, { ...opts, year: sameYear ? undefined : "numeric" });
  const right = sunday.toLocaleDateString(undefined, { ...opts, year: "numeric" });
  return `${left} – ${right}`;
}

function dayNameFromDate(d) {
  return DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

async function load() {
  const [catalogue, menus] = await Promise.all([
    fetch("/data/catalogue.json").then((r) => r.json()),
    fetch("/data/menus.json").then((r) => r.json()),
  ]);
  state.catalogue = catalogue;
  mergeUserItems();
  state.menus = menus;
  const today = new Date();
  state.weekMonday = toISODate(mondayOf(today));
  state.season = seasonForDate(today).key;
  bindTabs();
  render();
}

function bindTabs() {
  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.tab = btn.dataset.tab;
      document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b === btn));
      render();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

function itemsById() {
  const map = {};
  for (const it of state.catalogue.items) map[it.id] = it;
  return map;
}

function loadUserItems() {
  try {
    return JSON.parse(localStorage.getItem(USER_ITEMS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveUserItems(items) {
  localStorage.setItem(USER_ITEMS_KEY, JSON.stringify(items));
}

function mergeUserItems() {
  const extras = loadUserItems();
  const have = new Set(state.catalogue.items.map((i) => i.id));
  for (const item of extras) {
    if (!have.has(item.id)) {
      state.catalogue.items.push(item);
      have.add(item.id);
    }
  }
  state.catalogue.stats.total = state.catalogue.items.length;
}

function pieceImage(item, full) {
  if (!item) return "";
  if (item.image_data) return item.image_data;
  if (full) return item.image_full ? `/${item.image_full}` : `/images/source/${item.id}.jpg`;
  if (item.image) return `/${item.image}`;
  return `/images/thumbs/${item.id}.jpg`;
}

function thumb(id) {
  const item = state.catalogue?.items.find((i) => i.id === id);
  return pieceImage(item) || `/images/thumbs/${id}.jpg`;
}

/** Completed-outfit sketch for a season day. Fall only until other seasons are drawn. */
function outfitSketchPath(seasonKey, rotation, dayIndex) {
  if (seasonKey !== "fall" || rotation < 0 || rotation > 2 || dayIndex < 0 || dayIndex > 6) return "";
  const n = String(rotation * 7 + dayIndex + 1).padStart(2, "0");
  return `/sketches/fall/fall-${n}-w${rotation + 1}-${DAY_SLUGS[dayIndex]}.jpg`;
}

function pieceThumbs(pieces, byId) {
  return `
    <div class="thumbs">
      ${pieces.map((id) => `<img src="${thumb(id)}" alt="${byId[id]?.name || id}" title="${byId[id]?.name || id}" data-id="${id}" class="open-piece" />`).join("")}
    </div>
  `;
}

function pieceNameChips(pieces, byId) {
  return `
    <div class="piece-names">
      ${pieces.map((id) => `<button type="button" class="piece-name open-piece" data-id="${id}">${byId[id]?.name || id}</button>`).join("")}
    </div>
  `;
}

function outfitVisual(seasonKey, rotation, dayIndex, pieces, byId, alt) {
  const sketch = outfitSketchPath(seasonKey, rotation, dayIndex);
  if (!sketch) return pieceThumbs(pieces, byId);
  const safeAlt = String(alt || "Outfit sketch").replace(/"/g, "&quot;");
  return `
    <img class="outfit-sketch open-sketch" src="${sketch}" alt="${safeAlt}" data-sketch="${sketch}" data-sketch-title="${safeAlt}" />
    ${pieceNameChips(pieces, byId)}
  `;
}

function seasonTitle(s) {
  return s[0].toUpperCase() + s.slice(1);
}

function render() {
  const view = document.getElementById("view");
  if (!state.catalogue) {
    view.innerHTML = `<div class="card empty">Loading wardrobe…</div>`;
    return;
  }
  const pages = {
    home: renderHome,
    outfits: renderOutfits,
    capsules: renderCapsules,
    wardrobe: renderWardrobe,
    gaps: renderGaps,
  };
  view.innerHTML = pages[state.tab]();
  wirePage();
}

function renderHome() {
  const today = new Date();
  const monday = mondayOf(today);
  const plan = weekPlanForMonday(monday);
  const day = dayNameFromDate(today);
  const entry = plan.menu.days[day];
  const byId = itemsById();
  const heroes = state.catalogue.items.filter((i) => i.rating === 5).slice(0, 6);
  const stats = state.catalogue.stats;

  return `
    <section class="card hero-today">
      <div>
        <span class="theme-chip">${entry.theme} · ${day}</span>
        <h2 style="margin-top:10px">Today's outfit</h2>
        <p class="muted">${seasonTitle(plan.season.key)} · Week of ${monday.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</p>
        <p class="muted">${plan.seasonData.label} · ${plan.menu.name}</p>
        <p style="margin:10px 0 0; line-height:1.45">${entry.outfit}</p>
        ${outfitVisual(plan.season.key, plan.rotation, DAYS.indexOf(day), entry.pieces, byId, entry.outfit)}
      </div>
    </section>

    <section class="card">
      <h2>Your wardrobe at a glance</h2>
      <p class="muted">${stats.total} pieces catalogued · Soft Autumn · high waist · homestead</p>
      <div class="pill-row">
        <span class="pill">5★ × ${stats.by_rating["5"]}</span>
        <span class="pill">4★ × ${stats.by_rating["4"]}</span>
        <span class="pill warm">Discard × ${stats.by_rating["0"]}</span>
        <span class="pill rust">${seasonTitle(plan.season.key)} capsule ${stats.by_season[plan.season.key]}</span>
      </div>
    </section>

    <section class="card">
      <h2>Hero pieces</h2>
      <p class="muted">Wear these first — they do the most work.</p>
      <div class="thumbs" style="margin-top:12px">
        ${heroes.map((i) => `<img src="${thumb(i.id)}" alt="${i.name}" title="${i.name}" data-id="${i.id}" class="open-piece" />`).join("")}
      </div>
    </section>
  `;
}

function renderOutfits() {
  const monday = parseISODate(state.weekMonday);
  const plan = weekPlanForMonday(monday);
  const byId = itemsById();
  const todayISO = toISODate(new Date());
  const isThisWeek = toISODate(mondayOf(new Date())) === state.weekMonday;

  return `
    <div class="week-nav">
      <button type="button" data-week-delta="-7" aria-label="Previous week">‹</button>
      <div class="week-nav-center">
        <strong>Week of ${monday.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</strong>
        <span class="muted">${formatWeekRange(monday)}</span>
        ${isThisWeek ? `<span class="pill rust" style="margin-top:6px;display:inline-block">This week</span>` : `<button type="button" class="linkish" data-week-today>Jump to today</button>`}
      </div>
      <button type="button" data-week-delta="7" aria-label="Next week">›</button>
    </div>

    <section class="card">
      <div class="pill-row" style="margin-top:0;margin-bottom:8px">
        <span class="pill rust">${seasonTitle(plan.season.key)}</span>
        <span class="pill">Week ${plan.weekIndex + 1} of season</span>
        <span class="pill warm">${plan.menu.name}</span>
      </div>
      <div>
        ${DAYS.map((day, i) => {
          const date = addDays(monday, i);
          const e = plan.menu.days[day];
          const iso = toISODate(date);
          const isToday = iso === todayISO;
          return `
            <div class="day-card day-card-sketch${isToday ? " today" : ""}">
              <div class="day-head">
                <div>
                  <div class="day-name">${day.slice(0, 3)}</div>
                  <div class="muted" style="font-size:12px;margin-top:2px">${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
                </div>
                <span class="pill">${e.theme}</span>
              </div>
              <div>
                <div>${e.outfit}</div>
                ${outfitVisual(plan.season.key, plan.rotation, i, e.pieces, byId, e.outfit)}
              </div>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderCapsules() {
  const season = state.season;
  const pieces = state.catalogue.items
    .filter((i) => i.rating > 0 && (i.seasons || []).includes(season))
    .sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  const core = pieces; // seasons field = curated capsule membership
  const startMonth = SEASON_START_MONTH[season];
  const year = new Date().getFullYear();
  // Show the season start that is most relevant (current or next occurrence)
  let start = firstMondayOfMonth(year, startMonth);
  if (season === "winter") {
    const dec = firstMondayOfMonth(year, 12);
    const today = startOfDay(new Date());
    start = today >= dec ? dec : firstMondayOfMonth(year - 1, 12);
  } else if (start > new Date() && seasonForDate(new Date()).key !== season) {
    // keep this year's start for browsing
  }

  return `
    <div class="season-tabs">
      ${SEASON_ORDER.map((s) => `
        <button data-season="${s}" class="${s === season ? "active" : ""}">${seasonTitle(s)} (${state.catalogue.stats.by_season[s]})</button>
      `).join("")}
    </div>
    <section class="card">
      <h2>${seasonTitle(season)} board</h2>
      <p class="muted">${state.menus.seasons[season].label}. True capsule of ${core.length} pieces — all 3★+ (few staples carry over) · Soft Autumn · high waist · homestead.</p>
      <img class="collage" src="/seasons/${season}-capsule.jpg" alt="${season} capsule collage" />
    </section>
    <div class="grid">
      ${core.map(pieceCard).join("")}
    </div>
  `;
}

function pieceCard(i) {
  return `
    <article class="piece open-piece" data-id="${i.id}">
      <img src="${pieceImage(i)}" alt="${i.name}" loading="lazy" />
      <div class="meta">
        <strong>${i.name}</strong>
        <span class="rating">${i.rating}</span>
        <span class="muted"> ${i.slot || i.category}</span>
        ${i.character ? `<span class="pill ${i.character.toLowerCase()}">${i.character}</span>` : ""}
      </div>
    </article>
  `;
}

function renderWardrobe() {
  let list = [...state.catalogue.items].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
  if (state.ratingFilter === "heroes") list = list.filter((i) => i.rating >= 4);
  if (state.ratingFilter === "mid") list = list.filter((i) => i.rating === 2 || i.rating === 3);
  if (state.ratingFilter === "low") list = list.filter((i) => i.rating <= 1);

  return `
    <section class="card">
      <h2>Add a piece</h2>
      <p class="muted">Purchased or gifted? Add it here. It stays on this phone and shows in Wardrobe. Ask Alison to drop it into the weekly outfits.</p>
      <form id="add-piece-form" class="add-form">
        <label>Name <input name="name" required placeholder="Thin brown belt" /></label>
        <div class="add-row">
          <label>Slot
            <select name="slot" required>
              <option value="top">Top</option>
              <option value="bottom">Bottom</option>
              <option value="both">Both (dress / overalls)</option>
              <option value="undershirt">Undershirt</option>
              <option value="topper">Topper</option>
              <option value="outerwear">Outerwear</option>
              <option value="shoes">Shoes</option>
              <option value="accessory">Accessory</option>
            </select>
          </label>
          <label>Character
            <select name="character" required>
              <option value="Neutral">Neutral</option>
              <option value="Print">Print</option>
              <option value="Color">Color</option>
            </select>
          </label>
        </div>
        <div class="add-row">
          <label>How you got it
            <select name="source">
              <option value="purchased">Purchased</option>
              <option value="gifted">Gifted</option>
            </select>
          </label>
          <label>Rating
            <select name="rating">
              <option value="4">4 — strong staple</option>
              <option value="5">5 — hero</option>
              <option value="3">3 — usable</option>
              <option value="2">2 — meh</option>
            </select>
          </label>
        </div>
        <fieldset class="season-checks">
          <legend>Seasons</legend>
          ${["spring", "summer", "fall", "winter"].map((s) => `
            <label><input type="checkbox" name="seasons" value="${s}" checked /> ${s}</label>
          `).join("")}
        </fieldset>
        <label>Photo <input type="file" name="photo" accept="image/*" /></label>
        <label>Notes <input name="notes" placeholder="Wear open / belt the waffle" /></label>
        <button type="submit" class="add-submit">Save to my closet</button>
      </form>
    </section>
    <div class="filters">
      ${[
        ["all", "All"],
        ["heroes", "4–5★"],
        ["mid", "2–3★"],
        ["low", "0–1★"],
      ].map(([id, label]) => `
        <button data-filter="${id}" class="${state.ratingFilter === id ? "active" : ""}">${label}</button>
      `).join("")}
    </div>
    <div class="grid">
      ${list.map(pieceCard).join("")}
    </div>
  `;
}

function renderGaps() {
  return `
    <section class="card">
      <h2>Buy minimally</h2>
      <p class="muted">Soft Autumn · high waist. The thin brown belt is in the closet now. Fill only what's left.</p>
      <div class="gap-item">
        <div class="priority">Priority 1</div>
        <h3>Taupe / camel / cognac everyday shoe</h3>
        <p class="muted">Fall and winter only have the tall cognac boots. Buy one Chelsea, clog, or leather-look sneaker — walkable, dirt-hiding, sandwiches the camel cardi. Not black. Not white canvas.</p>
      </div>
      <div class="gap-item">
        <div class="priority">Priority 2</div>
        <h3>Warm brown or olive jeans</h3>
        <p class="muted">Unlocks cozy menus without cool blue denim. Soft Autumn bottom that hides homestead dirt.</p>
      </div>
      <div class="gap-item">
        <div class="priority">Priority 3</div>
        <h3>Nothing else required</h3>
        <p class="muted">The thin brown belt and rust flannel are already in the mix. Don't buy a second belt.</p>
      </div>
      <div class="gap-item">
        <div class="priority">Optional</div>
        <h3>Long cocoa cardigan · ivory blouse</h3>
        <p class="muted">Only if the camel waffle isn't long enough, and you want one polished cream top that isn't a tank.</p>
      </div>
    </section>
    <section class="card">
      <h2>Do not buy</h2>
      <div class="pill-row">
        <span class="pill">More black</span>
        <span class="pill">Cool gray sweats</span>
        <span class="pill">Graphic tees</span>
        <span class="pill">Bright true red</span>
        <span class="pill">Clingy sheaths</span>
      </div>
    </section>
    <section class="card">
      <h2>Free upgrades</h2>
      <p class="muted">Cull 0–1★ pieces · belt olive dresses & mustard sweatshirt · repair or retire the holey terracotta tank · wear olive/camel/cognac/dusty rose first each morning.</p>
    </section>
  `;
}

function wirePage() {
  document.querySelectorAll("[data-week-delta]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const delta = Number(btn.dataset.weekDelta);
      const monday = addDays(parseISODate(state.weekMonday), delta);
      state.weekMonday = toISODate(monday);
      render();
    });
  });
  document.querySelectorAll("[data-week-today]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.weekMonday = toISODate(mondayOf(new Date()));
      render();
    });
  });
  document.querySelectorAll("[data-season]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.season = btn.dataset.season;
      render();
    });
  });
  document.querySelectorAll("[data-filter]").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.ratingFilter = btn.dataset.filter;
      render();
    });
  });
  document.querySelectorAll(".open-piece").forEach((el) => {
    el.addEventListener("click", () => openPiece(el.dataset.id));
  });
  document.querySelectorAll(".open-sketch").forEach((el) => {
    el.addEventListener("click", () => openSketch(el.dataset.sketch, el.dataset.sketchTitle));
  });
  const addForm = document.getElementById("add-piece-form");
  if (addForm) {
    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const fd = new FormData(addForm);
      const seasons = fd.getAll("seasons");
      const id = `USER_${Date.now()}`;
      const file = addForm.photo.files[0];
      const finish = (image_data) => {
        const item = {
          id,
          name: String(fd.get("name") || "").trim(),
          category: fd.get("slot"),
          subcategory: fd.get("source"),
          colors: [],
          pattern: fd.get("character") === "Print" ? "print" : "solid",
          description: String(fd.get("notes") || "").trim() || "Added in Style & Thrive.",
          rating: Number(fd.get("rating")),
          rating_reason: "Added by Stephanie.",
          seasons,
          themes: ["practical"],
          soft_autumn_fit: "good",
          image: image_data ? "" : "",
          image_full: "",
          image_data: image_data || "",
          in_capsule: true,
          is_staple: false,
          slot: fd.get("slot"),
          character: fd.get("character"),
          user_added: true,
          source: fd.get("source"),
        };
        const extras = loadUserItems();
        extras.push(item);
        saveUserItems(extras);
        state.catalogue.items.push(item);
        state.catalogue.stats.total = state.catalogue.items.length;
        state.tab = "wardrobe";
        render();
      };
      if (file) {
        const reader = new FileReader();
        reader.onload = () => finish(String(reader.result));
        reader.readAsDataURL(file);
      } else {
        finish("");
      }
    });
  }
}

function ensureModal() {
  let modal = document.getElementById("modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "modal";
    modal.className = "modal";
    document.body.appendChild(modal);
  }
  return modal;
}

function bindModalClose(modal) {
  modal.onclick = (e) => {
    if (e.target === modal || e.target.classList.contains("close")) {
      modal.className = "modal";
    }
  };
}

function openSketch(src, title) {
  if (!src) return;
  const modal = ensureModal();
  modal.className = "modal open";
  modal.innerHTML = `
    <div class="modal-sheet">
      <button class="close" aria-label="Close">×</button>
      <img src="${src}" alt="${title || "Outfit sketch"}" />
      <h2 style="font-family:Cormorant Garamond,serif;margin:12px 0 4px">${title || "Outfit"}</h2>
      <p class="muted">Sketchbook page · tap a piece name on the outfit to see the hanger</p>
    </div>
  `;
  bindModalClose(modal);
}

function openPiece(id) {
  const item = state.catalogue.items.find((i) => i.id === id);
  if (!item) return;
  const modal = ensureModal();
  modal.className = "modal open";
  modal.innerHTML = `
    <div class="modal-sheet">
      <button class="close" aria-label="Close">×</button>
      <img src="${pieceImage(item, true)}" alt="${item.name}" />
      <h2 style="font-family:Cormorant Garamond,serif;margin:12px 0 4px">${item.name}</h2>
      <p class="muted">${item.description || ""}</p>
      <div class="pill-row">
        <span class="pill">${item.rating}★</span>
        <span class="pill warm">${item.soft_autumn_fit || ""} Soft Autumn</span>
        <span class="pill">${item.slot || item.category}</span>
        ${item.character ? `<span class="pill ${item.character.toLowerCase()}">${item.character}</span>` : ""}
        <span class="pill">${item.category}</span>
        ${(item.seasons || []).map((s) => `<span class="pill rust">${s}</span>`).join("")}
      </div>
      <p style="margin-top:12px;line-height:1.45">${item.rating_reason || ""}</p>
      <p class="muted" style="margin-top:8px">${(item.themes || []).join(" · ")}</p>
      ${item.user_added ? `<p class="muted" style="margin-top:8px">Saved on this phone · ${item.source || "added"}</p><button type="button" class="remove-user-piece" data-remove-id="${item.id}">Remove from this phone</button>` : ""}
    </div>
  `;
  bindModalClose(modal);
  const removeBtn = modal.querySelector(".remove-user-piece");
  if (removeBtn) {
    removeBtn.onclick = (e) => {
      e.stopPropagation();
      const rid = removeBtn.dataset.removeId;
      saveUserItems(loadUserItems().filter((i) => i.id !== rid));
      state.catalogue.items = state.catalogue.items.filter((i) => i.id !== rid);
      state.catalogue.stats.total = state.catalogue.items.length;
      modal.className = "modal";
      render();
    };
  }
}

load().catch((err) => {
  document.getElementById("view").innerHTML = `
    <div class="card">
      <h2>Couldn’t load data</h2>
      <p class="muted">Open this app via a local server from the wardrobe folder (browsers block fetch from file://).</p>
      <pre style="white-space:pre-wrap;font-size:12px">${err}</pre>
    </div>
  `;
});
