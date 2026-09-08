/**
 * Shared daily outfit selection + separate try-on step.
 * Pick returns fast; try-on is its own function so Netlify doesn't 504.
 */

import { chicagoParts } from "./season.mjs";
import { fetchWeather, DEFAULT_LOCATION } from "./weather.mjs";
import { fetchIcalEvents, activityFromEvents } from "./ical.mjs";
import { pickOutfit } from "./pick-outfit.mjs";
import { buildTryOnPrompt, generateTryOn, loadGarmentImages } from "./tryon.mjs";
import { buildStylingGuide } from "./styling.mjs";
import {
  getSettings,
  getHistory,
  getPick,
  savePick,
  getReferencePhotos,
  saveTryOnImage,
} from "./store.mjs";
import { loadCatalogue, publicPick } from "./http.mjs";

/**
 * Select (and save) today's outfit. Does not generate the try-on photo.
 */
export async function runDailySelect({ event, dateISO, force = false }) {
  const existing = await getPick(dateISO);
  if (existing && !force) {
    return { skipped: true, reason: "already picked", pick: publicPick(existing) };
  }

  const settings = await getSettings();
  const lat = settings.lat ?? DEFAULT_LOCATION.lat;
  const lon = settings.lon ?? DEFAULT_LOCATION.lon;

  const [catalogue, weather, events, history] = await Promise.all([
    loadCatalogue(event),
    fetchWeather(lat, lon, dateISO),
    fetchIcalEvents(settings.icalUrl || "", dateISO).catch((err) => {
      console.error("iCal error", err);
      return [];
    }),
    getHistory(),
  ]);

  const activity = activityFromEvents(events);
  const avoidPieces =
    force && existing ? existing.constrained || existing.pieces || [] : [];
  const variety = force ? existing?.pickCount || 0 : 0;
  const pick = pickOutfit({
    catalogue,
    dateISO,
    weather,
    activity,
    history,
    avoidPieces,
    variety,
  });
  pick.pickCount = (existing?.pickCount || 0) + 1;
  const byId = Object.fromEntries((catalogue.items || []).map((i) => [i.id, i]));
  const pieceItems = (pick.pieces || []).map((id) => byId[id]).filter(Boolean);
  pick.style = buildStylingGuide(pick, pieceItems);
  pick.imageUrl = null;
  pick.imageFailed = false;
  pick.imageError = null;
  pick.imagePending = true;
  await savePick(pick);

  return { ok: true, pick: publicPick(pick), needsTryOn: true };
}

/**
 * Generate try-on for an existing daily pick and update Blobs.
 */
export async function runTryOn({ event, dateISO }) {
  const pick = await getPick(dateISO);
  if (!pick?.pieces?.length) {
    throw new Error("No outfit pick for this date — run Pick again first");
  }

  const catalogue = await loadCatalogue(event);
  const refs = await getReferencePhotos();
  const apiKey = process.env.OPENAI_API_KEY || "";

  if (!apiKey) {
    pick.imagePending = false;
    pick.imageFailed = true;
    pick.imageError = "OPENAI_API_KEY not set in Netlify";
    await savePick(pick);
    return { ok: false, pick: publicPick(pick) };
  }
  if (!refs.length) {
    pick.imagePending = false;
    pick.imageFailed = true;
    pick.imageError = "No reference photos uploaded";
    await savePick(pick);
    return { ok: false, pick: publicPick(pick) };
  }

  try {
    const byId = Object.fromEntries((catalogue.items || []).map((i) => [i.id, i]));
    const pieceItems = (pick.pieces || []).map((id) => byId[id]).filter(Boolean);
    const guide =
      pick.style?.accessories?.length || pick.style?.how?.length
        ? pick.style
        : buildStylingGuide(pick, pieceItems);
    const garments = await loadGarmentImages(catalogue, pick.pieces, event);
    const { prompt, style } = buildTryOnPrompt(
      pick,
      byId,
      garments.map((g) => g.name)
    );
    // Keep accessory / how-to guide; refresh hair/pose from try-on style
    pick.style = {
      ...guide,
      hairstyle: style?.hairstyle || guide.hairstyle,
      pose: style?.pose || guide.pose,
      background: style?.background || guide.background,
    };
    const img = await generateTryOn({
      apiKey,
      references: refs,
      garments,
      prompt,
    });
    if (!img) {
      pick.imagePending = false;
      pick.imageFailed = true;
      pick.imageError = "Try-on returned empty";
      await savePick(pick);
      return { ok: false, pick: publicPick(pick) };
    }
    await saveTryOnImage(dateISO, img.bytes, img.contentType);
    pick.imageModel = img.model || "gpt-image-2";
    pick.imageUrl = `/.netlify/functions/image?date=${dateISO}&v=${encodeURIComponent(pick.pickedAt || String(Date.now()))}`;
    pick.imagePending = false;
    pick.imageFailed = false;
    pick.imageError = null;
    await savePick(pick);
    return { ok: true, pick: publicPick(pick) };
  } catch (err) {
    console.error("try-on error", err);
    pick.imagePending = false;
    pick.imageFailed = true;
    pick.imageError = String(err.message || err).slice(0, 280);
    await savePick(pick);
    return { ok: false, pick: publicPick(pick) };
  }
}

export function resolveDateISO(event, body = {}) {
  const qs = event.queryStringParameters || {};
  return body.date || qs.date || chicagoParts().iso;
}
