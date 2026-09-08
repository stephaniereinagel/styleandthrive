import { chicagoParts } from "../lib/season.mjs";
import { fetchWeather, DEFAULT_LOCATION } from "../lib/weather.mjs";
import { fetchIcalEvents, activityFromEvents } from "../lib/ical.mjs";
import { pickOutfit } from "../lib/pick-outfit.mjs";
import { buildTryOnPrompt, generateTryOn } from "../lib/tryon.mjs";
import {
  getSettings,
  getHistory,
  getPick,
  savePick,
  getReferencePhotos,
  saveTryOnImage,
  initBlobs,
} from "../lib/store.mjs";
import {
  json,
  okOptions,
  requireJobSecret,
  loadCatalogue,
  publicPick,
  pinOk,
} from "../lib/http.mjs";

export const config = {
  schedule: "0 9,10 * * *",
};

/**
 * Scheduled / on-demand daily outfit selection.
 * Cron hits at 09:00 and 10:00 UTC; only runs when Chicago local hour is 4,
 * unless force=1 (Settings "Pick now") with job secret or household PIN.
 */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return okOptions();
  initBlobs(event);

  const qs = event.queryStringParameters || {};
  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    body = {};
  }
  const isForce = qs.force === "1" || qs.force === "true" || body.force === true;

  const settings = await getSettings();
  const hasJobSecret = requireJobSecret(event);
  const hasPin = pinOk(event, settings);

  // Cron: job secret (or open if DAILY_JOB_SECRET unset).
  // Pick now (force): household PIN if set, else open; job secret also OK.
  if (isForce) {
    if (settings.pinHash && !hasPin && !hasJobSecret) {
      return json(401, { error: "PIN required", needsPin: true });
    }
  } else if (!hasJobSecret) {
    return json(401, { error: "Unauthorized" });
  }

  const parts = chicagoParts();
  if (!isForce && parts.hour !== 4) {
    return json(200, {
      skipped: true,
      reason: `Local hour is ${parts.hour}, not 4am America/Chicago`,
      iso: parts.iso,
    });
  }

  const dateISO = body.date || qs.date || parts.iso;

  try {
    const existing = await getPick(dateISO);
    if (existing && !isForce && !qs.rerun) {
      return json(200, { skipped: true, reason: "already picked", pick: publicPick(existing) });
    }

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
    try {
      const refs = await getReferencePhotos();
      const apiKey = process.env.OPENAI_API_KEY || "";
      if (refs.length && apiKey) {
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
        }
      } else {
        imageFailed = true;
      }
    } catch (err) {
      console.error("try-on error", err);
      imageFailed = true;
    }

    pick.imageUrl = imageUrl;
    pick.imageFailed = imageFailed;
    await savePick(pick);

    return json(200, { ok: true, pick: publicPick(pick) });
  } catch (err) {
    console.error(err);
    return json(500, { error: String(err.message || err) });
  }
}
