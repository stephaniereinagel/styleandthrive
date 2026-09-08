/**
 * Shared daily outfit selection used by scheduled daily-select and HTTP pick-now.
 */

import { chicagoParts } from "./season.mjs";
import { fetchWeather, DEFAULT_LOCATION } from "./weather.mjs";
import { fetchIcalEvents, activityFromEvents } from "./ical.mjs";
import { pickOutfit } from "./pick-outfit.mjs";
import { buildTryOnPrompt, generateTryOn } from "./tryon.mjs";
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
 * @param {object} opts
 * @param {object} opts.event - Lambda/Netlify event (for catalogue fetch host)
 * @param {string} opts.dateISO
 * @param {boolean} opts.force
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
  const pick = pickOutfit({ catalogue, dateISO, weather, activity, history });

  let imageUrl = null;
  let imageFailed = false;
  let imageError = null;
  try {
    const refs = await getReferencePhotos();
    const apiKey = process.env.OPENAI_API_KEY || "";
    if (!apiKey) {
      imageFailed = true;
      imageError = "OPENAI_API_KEY not set in Netlify";
    } else if (!refs.length) {
      imageFailed = true;
      imageError = "No reference photos uploaded";
    } else {
      const byId = Object.fromEntries((catalogue.items || []).map((i) => [i.id, i]));
      const prompt = buildTryOnPrompt(pick, byId);
      const img = await generateTryOn({
        apiKey,
        references: refs,
        prompt,
      });
      if (img) {
        await saveTryOnImage(dateISO, img.bytes, img.contentType);
        imageUrl = `/.netlify/functions/image?date=${dateISO}`;
      } else {
        imageFailed = true;
        imageError = "Try-on returned empty";
      }
    }
  } catch (err) {
    console.error("try-on error", err);
    imageFailed = true;
    imageError = String(err.message || err).slice(0, 280);
  }

  pick.imageUrl = imageUrl;
  pick.imageFailed = imageFailed;
  pick.imageError = imageError;
  await savePick(pick);

  return { ok: true, pick: publicPick(pick) };
}

export function resolveDateISO(event, body = {}) {
  const qs = event.queryStringParameters || {};
  return body.date || qs.date || chicagoParts().iso;
}
