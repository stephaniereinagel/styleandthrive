import {
  getSettings,
  saveSettings,
  saveReferencePhotos,
} from "../lib/store.mjs";
import { hashPin, json, okOptions, pinOk } from "../lib/http.mjs";
import { DEFAULT_LOCATION } from "../lib/weather.mjs";

function decodeDataUrl(dataUrl) {
  const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  const contentType = m ? m[1] : "image/jpeg";
  const b64 = m ? m[2] : String(dataUrl);
  return { bytes: Buffer.from(b64, "base64"), contentType };
}

/**
 * GET settings (public subset) or POST updates.
 * PIN-protected once a PIN is set.
 */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return okOptions();

  try {
    const settings = await getSettings();

    if (event.httpMethod === "GET") {
      return json(200, {
        hasIcal: !!settings.icalUrl,
        hasReferencePhoto: !!settings.hasReferencePhoto,
        referencePhotoCount: settings.referencePhotoCount || (settings.hasReferencePhoto ? 1 : 0),
        hasPin: !!settings.pinHash,
        lat: settings.lat ?? DEFAULT_LOCATION.lat,
        lon: settings.lon ?? DEFAULT_LOCATION.lon,
        locationLabel: settings.locationLabel || DEFAULT_LOCATION.label,
        icalUrl: pinOk(event, settings) ? settings.icalUrl || "" : "",
        jobSecretConfigured: !!process.env.DAILY_JOB_SECRET,
      });
    }

    if (event.httpMethod !== "POST") return json(405, { error: "GET or POST" });

    if (settings.pinHash && !pinOk(event, settings)) {
      return json(401, { error: "PIN required", needsPin: true });
    }

    const body = JSON.parse(event.body || "{}");
    const patch = {};

    if (typeof body.icalUrl === "string") patch.icalUrl = body.icalUrl.trim();
    if (typeof body.lat === "number") patch.lat = body.lat;
    if (typeof body.lon === "number") patch.lon = body.lon;
    if (typeof body.locationLabel === "string") patch.locationLabel = body.locationLabel.trim();

    if (typeof body.pin === "string" && body.pin.length >= 4) {
      patch.pinHash = hashPin(body.pin);
    }

    if (body.clearPin === true && settings.pinHash) {
      if (!pinOk(event, settings)) return json(401, { error: "PIN required" });
      patch.pinHash = "";
    }

    const photoPayloads = [];
    if (Array.isArray(body.referencePhotosBase64) && body.referencePhotosBase64.length) {
      for (const raw of body.referencePhotosBase64) {
        const decoded = decodeDataUrl(raw);
        if (decoded.bytes.length > 8_000_000) {
          return json(400, { error: "Reference photo too large (max ~6MB each)" });
        }
        photoPayloads.push(decoded);
      }
    } else if (body.referencePhotoBase64) {
      const decoded = decodeDataUrl(body.referencePhotoBase64);
      if (decoded.bytes.length > 8_000_000) {
        return json(400, { error: "Reference photo too large (max ~6MB)" });
      }
      photoPayloads.push(decoded);
    }
    if (photoPayloads.length) {
      const count = await saveReferencePhotos(photoPayloads);
      patch.hasReferencePhoto = count > 0;
      patch.referencePhotoCount = count;
    }

    const next = await saveSettings(patch);
    return json(200, {
      ok: true,
      hasIcal: !!next.icalUrl,
      hasReferencePhoto: !!next.hasReferencePhoto,
      referencePhotoCount: next.referencePhotoCount || (next.hasReferencePhoto ? 1 : 0),
      hasPin: !!next.pinHash,
      lat: next.lat,
      lon: next.lon,
      locationLabel: next.locationLabel,
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: String(err.message || err) });
  }
}
