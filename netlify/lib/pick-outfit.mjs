/**
 * Daily outfit picker from the seasonal capsule.
 * Constrained slots: top, bottom, topper, dress (slot "both").
 * Outerwear + shoes may repeat. Soft Autumn / homestead formula rules.
 */

import { DAY_THEMES, dayNameFromDate, daysBetween, parseISODate, seasonForDate } from "./season.mjs";

const CONSTRAINED = new Set(["top", "bottom", "topper", "both"]);
const KNIT_TOP = /\b(sweater|sweatshirt|hoodie|quilted)\b/i;
const CARDIGAN = /\bcardigan\b/i;
const DRESSY_DIRT = /\b(satin|velvet|lace|sheath)\b/i;
const HOT_OK = /\b(tank|short|sandal|tee|t-shirt|sleeveless)\b/i;
const COLD_NEED = /\b(sweater|sweatshirt|hoodie|boot|coat|quilted|flannel|cardigan|long-sleeve)\b/i;
const SHORTS = /\bshorts?\b/i;
const SANDALS = /\bsandal/i;
const BOOTS = /\bboot/i;
const JACKET = /\b(jacket|coat|moto|utility|trucker|pea)\b/i;

function textOf(item) {
  return `${item.subcategory || ""} ${item.name || ""} ${item.category || ""}`.toLowerCase();
}

function isKnitTop(item) {
  const t = textOf(item);
  return KNIT_TOP.test(t) && item.slot !== "topper" && !CARDIGAN.test(t);
}

function isCardigan(item) {
  return CARDIGAN.test(textOf(item)) || item.slot === "topper";
}

function isDress(item) {
  return item.slot === "both" && /\bdress|jumpsuit|overalls\b/i.test(textOf(item));
}

function isOveralls(item) {
  return /\boveralls\b/i.test(textOf(item));
}

function warmthScore(item) {
  const t = textOf(item);
  let s = 3;
  if (HOT_OK.test(t)) s -= 1;
  if (SHORTS.test(t) || SANDALS.test(t)) s -= 1;
  if (COLD_NEED.test(t)) s += 1;
  if (BOOTS.test(t) || /\bpea coat|quilted\b/i.test(t)) s += 1;
  if (JACKET.test(t)) s += 0.5;
  return s;
}

function fitsBand(item, band, wet) {
  const t = textOf(item);
  const s = warmthScore(item);
  if (band === "hot") {
    if (BOOTS.test(t) || /\bpea coat|hoodie|quilted crewneck\b/i.test(t)) return false;
    if (item.slot === "outerwear" && !/\bdenim|utility|moto|trucker\b/i.test(t)) return false;
    return s <= 3.5;
  }
  if (band === "warm") {
    if (/\bpea coat\b/i.test(t)) return false;
    if (BOOTS.test(t) && !/\bankle|chelsea|clog\b/i.test(t)) return false;
    return s <= 4;
  }
  if (band === "mild") return true;
  if (band === "cool") {
    if (SHORTS.test(t) || SANDALS.test(t)) return false;
    if (/\btank\b/i.test(t) && item.slot !== "undershirt") return false;
    return s >= 2.5;
  }
  // cold
  if (SHORTS.test(t) || SANDALS.test(t) || /\btank\b/i.test(t)) return false;
  return s >= 3;
}

function practicalOk(item) {
  return !DRESSY_DIRT.test(textOf(item));
}

function characterOk(pieces, theme) {
  const chars = pieces.map((p) => p.character || "Neutral");
  const prints = chars.filter((c) => c === "Print").length;
  const colors = chars.filter((c) => c === "Color").length;
  if (prints > 1) return false;
  if (colors > 1) return false;
  if (prints && colors && theme !== "Playful") return false;
  return true;
}

function layeringOk(pieces) {
  const tops = pieces.filter((p) => p.slot === "top" || p.slot === "undershirt");
  const toppers = pieces.filter((p) => p.slot === "topper" || isCardigan(p));
  const dresses = pieces.filter((p) => isDress(p) && !isOveralls(p));
  const hasKnit = tops.some(isKnitTop) || pieces.some((p) => p.slot === "top" && isKnitTop(p));
  const hasCardi = toppers.some(isCardigan);
  const hasDress = dresses.length > 0;

  // No sweater over a dress. No cardigan over a sweater.
  if (hasDress && hasKnit) return false;
  if (hasKnit && hasCardi) return false;
  return true;
}

function blockedIds(history, dateISO, { skipGap = false, skipWeekday = false } = {}) {
  const blocked = new Set();
  const target = parseISODate(dateISO);
  const targetDow = target.getDay();

  for (const entry of history || []) {
    if (!entry?.date || !entry?.pieces) continue;
    if (entry.date === dateISO) continue;
    const gap = daysBetween(entry.date, dateISO);
    const entryDow = parseISODate(entry.date).getDay();
    const sameWeekday = entryDow === targetDow;
    const weeksApart = Math.abs(gap) / 7;

    for (const id of entry.pieces) {
      const item = entry.pieceMeta?.[id];
      const slot = item?.slot || entry.slots?.[id];
      // If we don't know slot, treat as constrained to be safe when listed in constrainedPieces
      const constrained = entry.constrained?.includes(id)
        || (slot && CONSTRAINED.has(slot));
      if (!constrained && slot && !CONSTRAINED.has(slot)) continue;

      if (!skipGap && gap > 0 && gap <= 2) blocked.add(id);
      if (!skipWeekday && sameWeekday && weeksApart >= 0.9 && weeksApart <= 1.1) blocked.add(id);
      // also block if looking backward: worn 7 days ago same weekday
      if (!skipWeekday && sameWeekday && gap === -7) blocked.add(id);
      if (!skipGap && gap < 0 && gap >= -2) blocked.add(id);
    }
  }
  return blocked;
}

function capsulePool(catalogue, seasonKey) {
  return (catalogue.items || []).filter(
    (i) => i.rating >= 3 && (i.seasons || []).includes(seasonKey) && i.slot !== "other"
  );
}

function bySlot(pool) {
  const map = {
    top: [],
    bottom: [],
    both: [],
    undershirt: [],
    topper: [],
    outerwear: [],
    shoes: [],
    accessory: [],
  };
  for (const item of pool) {
    const s = item.slot || "other";
    if (map[s]) map[s].push(item);
    else if (s === "other" && /\bbelt\b/i.test(textOf(item))) map.accessory.push(item);
  }
  // Belts often tagged accessory or other
  for (const item of pool) {
    if (/\bbelt\b/i.test(textOf(item)) && !map.accessory.includes(item)) {
      map.accessory.push(item);
    }
  }
  return map;
}

function sortHeroes(list) {
  return [...list].sort((a, b) => b.rating - a.rating || a.name.localeCompare(b.name));
}

function filterAvailable(list, blocked, weather, theme, { skipWarmth = false } = {}) {
  return sortHeroes(
    list.filter((item) => {
      if (blocked.has(item.id)) return false;
      if (!skipWarmth && !fitsBand(item, weather.band, weather.wet)) return false;
      if (theme === "Practical" && !practicalOk(item)) return false;
      return true;
    })
  );
}

function formulaText(pieces, theme) {
  const parts = pieces
    .filter((p) => p.slot !== "accessory")
    .map((p) => p.name.replace(/^GAP\s+/i, "").toLowerCase());
  const short = parts.map((n) => n.replace(/\b(mid-wash|light-wash|heather)\b/gi, "").trim());
  return `${theme}: ${short.join(" + ")}.`;
}

function whyLine({ theme, weather, activity, relaxed }) {
  const bits = [`${theme} day`, weather.label];
  if (activity.labels?.length) bits.push(activity.summary);
  if (relaxed.length) bits.push(`relaxed: ${relaxed.join(", ")}`);
  return bits.join(" · ");
}

/**
 * @param {object} opts
 * @param {object} opts.catalogue
 * @param {string} opts.dateISO
 * @param {object} opts.weather
 * @param {object} opts.activity - from activityFromEvents
 * @param {array} opts.history - prior daily picks
 */
export function pickOutfit({ catalogue, dateISO, weather, activity, history }) {
  const date = parseISODate(dateISO);
  const season = seasonForDate(date);
  const dayName = dayNameFromDate(date);
  let theme = activity?.nudgeTheme || DAY_THEMES[dayName] || "Practical";

  const relaxOrder = [
    { skipWarmth: false, skipGap: false, skipWeekday: false, label: null },
    { skipWarmth: true, skipGap: false, skipWeekday: false, label: "warmth" },
    { skipWarmth: true, skipGap: true, skipWeekday: false, label: "2-day gap" },
    { skipWarmth: true, skipGap: true, skipWeekday: true, label: "same-weekday" },
  ];

  let lastError = "no legal outfit";
  for (const relax of relaxOrder) {
    const relaxed = relaxOrder
      .slice(1, relaxOrder.indexOf(relax) + 1)
      .map((r) => r.label)
      .filter(Boolean);

    const blocked = blockedIds(history, dateISO, {
      skipGap: relax.skipGap,
      skipWeekday: relax.skipWeekday,
    });

    const pool = capsulePool(catalogue, season.key);
    const slots = bySlot(pool);

    const tops = filterAvailable(slots.top, blocked, weather, theme, relax);
    const bottoms = filterAvailable(slots.bottom, blocked, weather, theme, relax);
    const dresses = filterAvailable(
      slots.both.filter((i) => isDress(i) || isOveralls(i)),
      blocked,
      weather,
      theme,
      relax
    );
    const toppers = filterAvailable(slots.topper, blocked, weather, theme, relax);
    // Outerwear + shoes: ignore blocked (may repeat)
    const outer = sortHeroes(
      slots.outerwear.filter((item) => {
        if (!relax.skipWarmth && !fitsBand(item, weather.band, weather.wet)) return false;
        if (theme === "Practical" && !practicalOk(item)) return false;
        return true;
      })
    );
    let shoes = sortHeroes(
      slots.shoes.filter((item) => {
        if (!relax.skipWarmth && !fitsBand(item, weather.band, weather.wet)) return false;
        return true;
      })
    );
    if (activity?.sturdyShoes) {
      const sturdy = shoes.filter((s) => BOOTS.test(textOf(s)) || /\bsneaker|utility\b/i.test(textOf(s)));
      if (sturdy.length) shoes = sturdy;
    }
    if (weather.wet) {
      const dry = shoes.filter((s) => !SANDALS.test(textOf(s)));
      if (dry.length) shoes = dry;
    }
    const belts = slots.accessory.filter((i) => /\bbelt\b/i.test(textOf(i)));

    const wantOuter =
      weather.band === "cool" ||
      weather.band === "cold" ||
      weather.wet ||
      weather.wind >= 15 ||
      theme === "Polished" ||
      theme === "Feminine";

    const candidates = [];

    // Dress / overalls path
    for (const dress of dresses.slice(0, 12)) {
      for (const shoe of shoes.slice(0, 3)) {
        const base = [dress, shoe];
        // optional open cardi (not over knit dress issue — dress isn't a knit top)
        const tryLayers = [null, ...toppers.slice(0, 2), ...outer.slice(0, 3)];
        for (const layer of tryLayers) {
          const pieces = layer ? [...base, layer] : [...base];
          if (layer && isCardigan(layer) && isKnitTop(dress)) continue;
          if (!layeringOk(pieces)) continue;
          if (!characterOk(pieces, theme)) continue;
          if (wantOuter && !layer && outer.length && weather.band !== "hot") {
            // prefer a layer when cool; still allow dress-only as candidate with lower score
          }
          candidates.push(pieces);
        }
      }
    }

    // Top + bottom path
    for (const bottom of bottoms.slice(0, 10)) {
      for (const top of tops.slice(0, 14)) {
        for (const shoe of shoes.slice(0, 3)) {
          const layerOpts = [null, ...toppers.slice(0, 2), ...outer.slice(0, 3)];
          for (const layer of layerOpts) {
            const pieces = layer ? [top, bottom, shoe, layer] : [top, bottom, shoe];
            if (!layeringOk(pieces)) continue;
            if (!characterOk(pieces, theme)) continue;
            // Prefer outerwear on cool days if top is not already a heavy knit
            candidates.push(pieces);
          }
        }
      }
    }

    if (!candidates.length) {
      lastError = `no candidates under relax=${relax.label || "strict"}`;
      continue;
    }

    // Score: heroes, theme match, weather layers, prefer outer when cool
    function score(pieces) {
      let s = pieces.reduce((acc, p) => acc + (p.rating || 0), 0);
      const hasOuter = pieces.some((p) => p.slot === "outerwear");
      const hasCardi = pieces.some((p) => isCardigan(p));
      if (wantOuter && (hasOuter || hasCardi)) s += 3;
      if (weather.band === "hot" && hasOuter) s -= 2;
      if (theme === "Feminine" && pieces.some((p) => isDress(p) && !isOveralls(p))) s += 4;
      if (theme === "Practical" && pieces.some((p) => isOveralls(p) || /\bjeans|pants|utility\b/i.test(textOf(p)))) s += 3;
      if (theme === "Cozy" && pieces.some((p) => isKnitTop(p) || isCardigan(p))) s += 3;
      if (theme === "Playful" && pieces.some((p) => p.character === "Print")) s += 2;
      if (theme === "Polished" && (hasOuter || pieces.some(isDress))) s += 2;
      // Prefer fewer pieces when hot
      if (weather.band === "hot") s -= Math.max(0, pieces.length - 3);
      return s;
    }

    candidates.sort((a, b) => score(b) - score(a));
    let best = candidates[0];

    // Optional belt on boxy knits / dresses without built-in waist
    const needsBelt = best.some(
      (p) =>
        /\b(sweatshirt|hoodie|t-shirt dress|tee dress|quilted)\b/i.test(textOf(p)) ||
        (isDress(p) && /\btiered|t-shirt\b/i.test(textOf(p)))
    );
    if (needsBelt && belts.length) {
      best = [...best, belts[0]];
    }

    const constrained = best
      .filter((p) => CONSTRAINED.has(p.slot))
      .map((p) => p.id);

    const pieceMeta = {};
    const slotsMap = {};
    for (const p of best) {
      pieceMeta[p.id] = { slot: p.slot, name: p.name, character: p.character };
      slotsMap[p.id] = p.slot;
    }

    return {
      date: dateISO,
      season: season.key,
      day: dayName,
      theme,
      outfit: formulaText(best, theme),
      pieces: best.map((p) => p.id),
      constrained,
      pieceMeta,
      slots: slotsMap,
      why: whyLine({ theme, weather, activity, relaxed }),
      weather,
      activity: {
        summary: activity?.summary || "no events",
        events: (activity?.events || []).map((e) => ({
          summary: e.summary,
          time: e.time,
        })),
        nudgeTheme: activity?.nudgeTheme || null,
      },
      relaxed,
      pickedAt: new Date().toISOString(),
    };
  }

  throw new Error(lastError);
}
