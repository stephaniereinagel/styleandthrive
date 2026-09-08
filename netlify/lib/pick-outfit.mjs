/**
 * Daily outfit picker from the seasonal capsule.
 * Constrained slots: top, bottom, topper, dress (slot "both").
 * Overalls are bottoms (never a solo "both") and always need a shirt underneath.
 * Outerwear + shoes may repeat. Soft Autumn / homestead formula rules.
 * Hot days stay in-season first (fall dresses, etc.); only bridge summer/spring
 * when the season closet can't dress the weather — shoes bridge freely.
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
const HEAVY = /\b(sweater|sweatshirt|hoodie|boot|pea coat|quilted|flannel|cardigan)\b/i;

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

function isOveralls(item) {
  return /\boveralls\b/i.test(textOf(item));
}

/** One-and-done dresses/jumpsuits only — overalls are bottoms, not dresses. */
function isDress(item) {
  if (isOveralls(item)) return false;
  return item.slot === "both" && /\bdress|jumpsuit\b/i.test(textOf(item));
}

function inSeason(item, seasonKey) {
  return (item.seasons || []).includes(seasonKey);
}

function warmthScore(item) {
  const t = textOf(item);
  let s = 3;
  if (HOT_OK.test(t)) s -= 1;
  if (SHORTS.test(t) || SANDALS.test(t)) s -= 1;
  // Soft dresses (not knit / long-sleeve) count as warm-weather friendly
  if (isDress(item) && !HEAVY.test(t) && !/\blong-sleeve\b/i.test(t)) s -= 0.5;
  if (COLD_NEED.test(t)) s += 1;
  if (BOOTS.test(t) || /\bpea coat|quilted\b/i.test(t)) s += 1;
  if (JACKET.test(t)) s += 0.5;
  return s;
}

function fitsBand(item, band) {
  const t = textOf(item);
  const s = warmthScore(item);
  if (band === "hot") {
    if (HEAVY.test(t)) return false;
    if (item.slot === "outerwear" || item.slot === "topper") return false;
    // Non-long-sleeve dresses are fair game in heat (fall capsule lives on these)
    if (isDress(item) && !/\blong-sleeve\b/i.test(t)) return true;
    if (/\blong-sleeve\b/i.test(t) && !/\bdress\b/i.test(t)) return false;
    return s <= 3.5;
  }
  if (band === "warm") {
    if (/\bpea coat|hoodie|quilted\b/i.test(t)) return false;
    if (BOOTS.test(t)) return false;
    if (item.slot === "outerwear") return false;
    if (item.slot === "topper" && CARDIGAN.test(t)) return false;
    if (isDress(item) && !HEAVY.test(t)) return true;
    return s <= 4;
  }
  if (band === "mild") {
    if (/\bpea coat\b/i.test(t)) return false;
    return true;
  }
  if (band === "cool") {
    if (SHORTS.test(t) || SANDALS.test(t)) return false;
    if (/\btank\b/i.test(t) && item.slot !== "undershirt") return false;
    return s >= 2.5;
  }
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
  const dresses = pieces.filter((p) => isDress(p));
  const hasKnit = tops.some(isKnitTop) || pieces.some((p) => p.slot === "top" && isKnitTop(p));
  const hasCardi = toppers.some(isCardigan);
  const hasDress = dresses.length > 0;
  const hasOveralls = pieces.some(isOveralls);
  // Overalls always need a real shirt underneath (not just a jacket/cardigan)
  if (hasOveralls && !tops.length) return false;
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
      const constrained =
        entry.constrained?.includes(id) || (slot && CONSTRAINED.has(slot));
      if (!constrained && slot && !CONSTRAINED.has(slot)) continue;

      if (!skipGap && gap > 0 && gap <= 2) blocked.add(id);
      if (!skipWeekday && sameWeekday && weeksApart >= 0.9 && weeksApart <= 1.1) blocked.add(id);
      if (!skipWeekday && sameWeekday && gap === -7) blocked.add(id);
      if (!skipGap && gap < 0 && gap >= -2) blocked.add(id);
    }
  }
  return blocked;
}

/**
 * Season capsule first. Hot/warm days may borrow spring/summer *shoes*
 * (fall often only has boots). Full spring/summer bases only when bridgeBases.
 */
function capsulePool(catalogue, seasonKey, weather, { bridgeBases = false } = {}) {
  const items = catalogue.items || [];
  const inSeasonItems = items.filter(
    (i) => i.rating >= 3 && (i.seasons || []).includes(seasonKey) && i.slot !== "other"
  );
  const byId = new Map(inSeasonItems.map((i) => [i.id, i]));

  const needHeatBridge = weather?.band === "hot" || weather?.band === "warm";
  if (needHeatBridge) {
    for (const i of items) {
      if (i.rating < 3 || i.slot === "other") continue;
      const seasons = i.seasons || [];
      if (!seasons.includes("summer") && !seasons.includes("spring")) continue;
      if (byId.has(i.id)) continue;

      const isShoe = i.slot === "shoes" || SANDALS.test(textOf(i));
      if (!bridgeBases && !isShoe) continue;

      if (
        !fitsBand(i, weather.band) &&
        !SANDALS.test(textOf(i)) &&
        !HOT_OK.test(textOf(i)) &&
        !isDress(i)
      ) {
        continue;
      }
      byId.set(i.id, i);
    }
  }

  if (weather?.band === "cold") {
    for (const i of items) {
      if (i.rating < 3 || i.slot === "other") continue;
      if (!(i.seasons || []).includes("winter")) continue;
      if (byId.has(i.id)) continue;
      byId.set(i.id, i);
    }
  }

  return [...byId.values()];
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
    // Overalls are bottoms even if an old catalogue entry still says "both"
    const s = isOveralls(item) ? "bottom" : item.slot || "other";
    if (map[s]) map[s].push(item);
    else if (s === "other" && /\bbelt\b/i.test(textOf(item))) map.accessory.push(item);
  }
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
      if (!skipWarmth && !fitsBand(item, weather.band)) return false;
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

function whyLine({ theme, weather, activity, relaxed, bridged }) {
  const bits = [`${theme} day`, weather.label];
  if (activity.labels?.length) bits.push(activity.summary);
  if (bridged === "shoes") bits.push("borrowed warm-weather shoes");
  if (bridged === "bases") bits.push("weather bridge from spring/summer");
  if (relaxed.length) bits.push(`relaxed: ${relaxed.join(", ")}`);
  return bits.join(" · ");
}

/**
 * @param {object} opts
 * @param {string[]} [opts.avoidPieces] - piece IDs to skip (e.g. previous Pick again outfit)
 * @param {number} [opts.variety] - rotate through top candidates (0 = best)
 */
export function pickOutfit({ catalogue, dateISO, weather, activity, history, avoidPieces = [], variety = 0 }) {
  const date = parseISODate(dateISO);
  const season = seasonForDate(date);
  const dayName = dayNameFromDate(date);
  let theme = activity?.nudgeTheme || DAY_THEMES[dayName] || "Practical";
  // Heat overrides cozy defaults
  if ((weather.band === "hot" || weather.band === "warm") && theme === "Cozy") {
    theme = "Practical";
  }

  // Warmth is last resort — stay in season first, then gaps, then bridge bases
  const relaxOrder = [
    { skipWarmth: false, skipGap: false, skipWeekday: false, label: null },
    { skipWarmth: false, skipGap: true, skipWeekday: false, label: "2-day gap" },
    { skipWarmth: false, skipGap: true, skipWeekday: true, label: "same-weekday" },
    { skipWarmth: true, skipGap: true, skipWeekday: true, label: "warmth" },
  ];

  const bridgePasses = [
    { bridgeBases: false, label: "shoes" },
    { bridgeBases: true, label: "bases" },
  ];

  let lastError = "no legal outfit";
  for (const bridge of bridgePasses) {
    const pool = capsulePool(catalogue, season.key, weather, {
      bridgeBases: bridge.bridgeBases,
    });
    const bridged =
      weather?.band === "hot" || weather?.band === "warm" ? bridge.label : null;

    for (const relax of relaxOrder) {
      const relaxed = relaxOrder
        .slice(1, relaxOrder.indexOf(relax) + 1)
        .map((r) => r.label)
        .filter(Boolean);

      const blocked = blockedIds(history, dateISO, {
        skipGap: relax.skipGap,
        skipWeekday: relax.skipWeekday,
      });

      const slots = bySlot(pool);

      const tops = filterAvailable(slots.top, blocked, weather, theme, relax);
      const bottoms = filterAvailable(slots.bottom, blocked, weather, theme, relax);
      const dresses = filterAvailable(
        slots.both.filter((i) => isDress(i)),
        blocked,
        weather,
        theme,
        relax
      );
      const toppers = filterAvailable(slots.topper, blocked, weather, theme, relax);
      const outer = sortHeroes(
        slots.outerwear.filter((item) => {
          if (!relax.skipWarmth && !fitsBand(item, weather.band)) return false;
          if (theme === "Practical" && !practicalOk(item)) return false;
          return true;
        })
      );
      let shoes = sortHeroes(
        slots.shoes.filter((item) => {
          if (!relax.skipWarmth && !fitsBand(item, weather.band)) return false;
          return true;
        })
      );
      if (activity?.sturdyShoes && weather.band !== "hot" && weather.band !== "warm") {
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
        (weather.wet && weather.band !== "hot") ||
        (weather.wind >= 18 && weather.band !== "hot" && weather.band !== "warm");

      const candidates = [];

      for (const dress of dresses.slice(0, 14)) {
        for (const shoe of (shoes.length ? shoes : slots.shoes).slice(0, 4)) {
          if (!relax.skipWarmth && shoes.length && !fitsBand(shoe, weather.band)) continue;
          const layerOpts =
            weather.band === "hot" || weather.band === "warm"
              ? [null]
              : [null, ...toppers.slice(0, 2), ...outer.slice(0, 3)];
          for (const layer of layerOpts) {
            const pieces = layer ? [dress, shoe, layer] : [dress, shoe];
            if (layer && isCardigan(layer) && isKnitTop(dress)) continue;
            if (!layeringOk(pieces)) continue;
            if (!characterOk(pieces, theme)) continue;
            candidates.push(pieces);
          }
        }
      }

      for (const bottom of bottoms.slice(0, 12)) {
        for (const top of tops.slice(0, 16)) {
          for (const shoe of (shoes.length ? shoes : slots.shoes).slice(0, 4)) {
            if (!relax.skipWarmth && shoes.length && !fitsBand(shoe, weather.band)) continue;
            const layerOpts =
              weather.band === "hot" || weather.band === "warm"
                ? [null]
                : [null, ...toppers.slice(0, 2), ...outer.slice(0, 3)];
            for (const layer of layerOpts) {
              const pieces = layer ? [top, bottom, shoe, layer] : [top, bottom, shoe];
              if (!layeringOk(pieces)) continue;
              if (!characterOk(pieces, theme)) continue;
              candidates.push(pieces);
            }
          }
        }
      }

      if (!candidates.length) {
        lastError = `no candidates under bridge=${bridge.label} relax=${relax.label || "strict"}`;
        continue;
      }

      function score(pieces) {
        let s = pieces.reduce((acc, p) => acc + (p.rating || 0), 0);
        const hasOuter = pieces.some((p) => p.slot === "outerwear");
        const hasCardi = pieces.some((p) => isCardigan(p));
        const heavyCount = pieces.filter((p) => HEAVY.test(textOf(p))).length;
        // Strongly prefer the current season's capsule (don't "revert" to summer)
        const constrained = pieces.filter((p) => CONSTRAINED.has(p.slot));
        const seasonHits = constrained.filter((p) => inSeason(p, season.key)).length;
        const borrowed = constrained.filter((p) => !inSeason(p, season.key)).length;
        s += seasonHits * 6;
        s -= borrowed * 12;
        if (wantOuter && (hasOuter || hasCardi)) s += 3;
        if (weather.band === "hot" || weather.band === "warm") {
          s -= heavyCount * 8;
          if (hasOuter || hasCardi) s -= 6;
          if (pieces.some((p) => SANDALS.test(textOf(p)))) s += 5;
          // Fall heat: dresses are the season's real answer — prefer them over tunic+pants
          if (pieces.some((p) => isDress(p))) s += 10;
          else if (pieces.some((p) => HOT_OK.test(textOf(p)))) s += 2;
          s -= Math.max(0, pieces.length - 3);
        }
        if (theme === "Feminine" && pieces.some((p) => isDress(p))) s += 4;
        if (theme === "Practical") {
          if (weather.band === "hot" || weather.band === "warm") {
            if (pieces.some((p) => isOveralls(p) || (isDress(p) && /\butility\b/i.test(textOf(p))))) s += 3;
          } else if (pieces.some((p) => isOveralls(p) || /\bjeans|pants|utility\b/i.test(textOf(p)))) {
            s += 3;
          }
        }
        // Reward properly layered overalls (shirt + bib)
        if (pieces.some(isOveralls) && pieces.some((p) => p.slot === "top" || p.slot === "undershirt")) s += 4;
        if (theme === "Cozy" && weather.band !== "hot" && pieces.some((p) => isKnitTop(p) || isCardigan(p))) s += 3;
        if (theme === "Playful" && pieces.some((p) => p.character === "Print")) s += 2;
        if (theme === "Polished" && weather.band !== "hot" && (hasOuter || pieces.some(isDress))) s += 2;
        return s;
      }

      candidates.sort((a, b) => score(b) - score(a));

      // Unique by constrained pieces, then skip the previous outfit when re-picking
      const unique = [];
      const seen = new Set();
      for (const c of candidates) {
        const key = c
          .filter((p) => CONSTRAINED.has(p.slot))
          .map((p) => p.id)
          .sort()
          .join(",");
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(c);
      }
      const avoid = new Set(avoidPieces || []);
      const fresh = unique.filter(
        (c) => !c.some((p) => avoid.has(p.id) && CONSTRAINED.has(p.slot))
      );
      const choices = fresh.length ? fresh : unique;
      const idx = Math.abs(Number(variety) || 0) % Math.max(choices.length, 1);
      let best = choices[idx];
      if (!best) {
        lastError = `no candidates under bridge=${bridge.label} relax=${relax.label || "strict"}`;
        continue;
      }

      const needsBelt = best.some(
        (p) =>
          /\b(sweatshirt|hoodie|t-shirt dress|tee dress|quilted)\b/i.test(textOf(p)) ||
          (isDress(p) && /\btiered|t-shirt\b/i.test(textOf(p)))
      );
      if (needsBelt && belts.length) {
        best = [...best, belts[0]];
      }

      const constrainedIds = best.filter((p) => CONSTRAINED.has(p.slot)).map((p) => p.id);
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
        constrained: constrainedIds,
        pieceMeta,
        slots: slotsMap,
        why: whyLine({ theme, weather, activity, relaxed, bridged }),
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
  }

  throw new Error(lastError);
}
