/**
 * Put-together styling guide for a daily pick.
 * Suggests how to wear the outfit + common Soft Autumn / homestead accessories
 * even when accessory photos aren't in the catalogue yet.
 */

import { styleSuggestions as baseStyle } from "./tryon.mjs";

function textOf(item) {
  return `${item?.subcategory || ""} ${item?.name || ""} ${item?.category || ""}`.toLowerCase();
}

function isDress(item) {
  return item?.slot === "both" && /\bdress|jumpsuit\b/i.test(textOf(item)) && !/\boveralls\b/i.test(textOf(item));
}

function isOveralls(item) {
  return /\boveralls\b/i.test(textOf(item));
}

function isBoxyKnit(item) {
  return /\b(sweatshirt|hoodie|quilted|crewneck|sweater)\b/i.test(textOf(item));
}

function hasBelt(pieces) {
  return pieces.some((p) => /\bbelt\b/i.test(textOf(p)));
}

function hasTopper(pieces) {
  return pieces.some((p) => p.slot === "topper" || p.slot === "outerwear");
}

/**
 * @param {object} pick - daily pick (theme, weather, date, pickCount, pieces as IDs or items)
 * @param {object[]} [pieceItems] - resolved catalogue items for the outfit
 */
export function buildStylingGuide(pick, pieceItems = []) {
  const pieces = pieceItems.length
    ? pieceItems
    : Object.values(pick?.pieceMeta || {}).map((m) => ({
        name: m.name,
        slot: m.slot,
        character: m.character,
      }));
  const theme = pick?.theme || "Practical";
  const band = pick?.weather?.band || "mild";
  const hot = band === "hot" || band === "warm";
  const cool = band === "cool" || band === "cold";
  const base = baseStyle(pick);

  const accessories = [];
  const how = [];
  const seen = new Set();

  function addAcc({ name, why, inCloset = false }) {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    accessories.push({ name, why, inCloset: !!inCloset });
  }

  const dress = pieces.find(isDress);
  const overalls = pieces.find(isOveralls);
  const boxy = pieces.find(isBoxyKnit);
  const beltInOutfit = hasBelt(pieces);
  const layered = hasTopper(pieces);

  // —— How to wear (always 2–4 concrete steps) ——
  if (boxy && !dress) {
    how.push(
      beltInOutfit
        ? "Cinch the thin brown belt at your natural waist — that's the put-together move on a boxy knit."
        : "Half-tuck the front of the top (or add your thin brown belt) so the waist shows."
    );
  }
  if (dress) {
    if (/\b(tiered|t-shirt|tee|utility|wrap)\b/i.test(textOf(dress))) {
      how.push(
        beltInOutfit
          ? "Keep the belt at the smallest part of your waist; smooth the skirt so it skims the hip."
          : "If the dress feels boxy, add your thin brown belt — instant polish without changing clothes."
      );
    } else {
      how.push("Smooth the dress over the hip; stand tall — midi length already does the finishing work.");
    }
  }
  if (overalls) {
    how.push("Shirt fully under the bib (not just a jacket). Adjust straps so the waist hits high.");
    how.push("Roll or cuff the shirt sleeves once if it's warm — looks intentional, not unfinished.");
  }
  if (layered) {
    how.push("Leave the jacket/cardigan open so the waist and neckline stay visible.");
  }
  if (pieces.some((p) => p.slot === "bottom" && /\bjeans|pants\b/i.test(textOf(p)))) {
    how.push("High-rise as-is; no bunching at the ankle — stack or slight break only.");
  }
  if (!how.length) {
    how.push("Shoes on before you leave the bedroom — unfinished feet undo the whole outfit.");
  }
  how.push("One last mirror check: waist marked, shoes on, one piece of jewelry. Then stop deciding.");

  // —— Accessories: closet belt first, then common Soft Autumn homestead pieces ——
  if (beltInOutfit) {
    addAcc({
      name: "Thin brown belt",
      why: "Already in this outfit — wear it at the natural waist.",
      inCloset: true,
    });
  } else if (boxy || (dress && /\b(tiered|t-shirt|tee|utility|quilted)\b/i.test(textOf(dress)))) {
    addAcc({
      name: "Thin brown belt",
      why: "Marks the waist on boxy knits and soft dresses — you already own this.",
      inCloset: true,
    });
  }

  // Theme-driven jewelry / bags (suggested — photos can be added later)
  if (theme === "Feminine" || theme === "Polished") {
    addAcc({
      name: "Small gold hoops or soft drop earrings",
      why: "Draws the eye up; Soft Autumn metal that reads finished without fuss.",
    });
    addAcc({
      name: "Delicate gold necklace or small cross",
      why: "One quiet layer at the collarbone — church- and farm-stand friendly.",
    });
  } else if (theme === "Playful") {
    addAcc({
      name: "One cheerful earring or a patterned hair claw",
      why: "Thursday gets one fun finisher — keep the rest calm.",
    });
  } else {
    // Practical / Cozy
    addAcc({
      name: "Simple gold studs or small hoops",
      why: "Takes 5 seconds and reads 'I got dressed on purpose.'",
    });
  }

  if (theme === "Polished" || theme === "Feminine" || theme === "Practical") {
    addAcc({
      name: hot
        ? "Olive, cognac, or dusty-rose crossbody (light)"
        : "Cognac or olive crossbody / tote",
      why: "Hands free for kids + a finished silhouette. Soft Autumn leather tones.",
    });
  }

  if (cool && (theme === "Cozy" || theme === "Polished" || theme === "Feminine")) {
    addAcc({
      name: "Lightweight scarf in camel, dusty rose, or olive",
      why: "Tied once at the neck or on the bag — polish for cooler days without a heavy coat.",
    });
  }

  if (overalls || theme === "Practical") {
    addAcc({
      name: "Watch with a tan/cognac band (or your everyday watch)",
      why: "Practical finisher that still looks intentional with denim and boots.",
    });
  }

  if (hot && (dress || theme === "Feminine")) {
    addAcc({
      name: "Thin gold bangle or simple stack",
      why: "One wrist detail when sleeves are short — optional if you're elbow-deep in homestead life.",
    });
  }

  // Cap at 4 accessories so it's not a shopping list
  const accessoryList = accessories.slice(0, 4);

  const finishBits = [];
  if (accessoryList[0]) finishBits.push(accessoryList[0].name.toLowerCase());
  if (accessoryList[1]) finishBits.push(accessoryList[1].name.toLowerCase());
  const finish = finishBits.length
    ? `${theme} finish: ${how[0]} Then add ${finishBits.join(" + ")}.`
    : `${theme} finish: ${how[0]}`;

  return {
    ...base,
    finish,
    how: how.slice(0, 4),
    accessories: accessoryList,
    note: "Suggested accessories from a typical Soft Autumn homestead kit — add photos in Wardrobe anytime to lock your real ones in.",
  };
}
