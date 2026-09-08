import { initBlobs, getPick, savePick, saveTryOnImage } from "../lib/store.mjs";
import { json, okOptions, requireJobSecret, publicPick } from "../lib/http.mjs";
import { chicagoParts } from "../lib/season.mjs";

/**
 * Save a try-on image produced off-platform (GitHub Actions worker).
 */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return okOptions();
  if (event.httpMethod !== "POST") return json(405, { error: "POST" });
  if (!requireJobSecret(event) || !process.env.DAILY_JOB_SECRET) {
    return json(401, { error: "Unauthorized" });
  }

  initBlobs(event);
  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const dateISO = body.date || chicagoParts().iso;
  const b64 = body.imageBase64 || body.image;
  if (!b64) return json(400, { error: "imageBase64 required" });

  try {
    const pick = (await getPick(dateISO)) || { date: dateISO, pieces: [] };
    const bytes = Buffer.from(b64, "base64");
    const contentType = body.contentType || "image/png";
    await saveTryOnImage(dateISO, bytes, contentType);
    pick.imageModel = body.model || "gpt-image-2";
    pick.imageUrl = `/.netlify/functions/image?date=${dateISO}&v=${encodeURIComponent(pick.pickedAt || String(Date.now()))}`;
    pick.imagePending = false;
    pick.imageFailed = false;
    pick.imageError = null;
    if (body.style) pick.style = body.style;
    await savePick(pick);
    return json(200, { ok: true, pick: publicPick(pick) });
  } catch (err) {
    console.error(err);
    return json(500, { error: String(err.message || err) });
  }
}
