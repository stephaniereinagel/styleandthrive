import { initBlobs, getPick, getReferencePhotos, savePick } from "../lib/store.mjs";
import { json, okOptions, requireJobSecret, loadCatalogue, publicPick } from "../lib/http.mjs";
import { buildTryOnPrompt, styleSuggestions } from "../lib/tryon.mjs";
import { chicagoParts } from "../lib/season.mjs";

/**
 * Job-secret pack for off-platform try-on (GitHub Actions).
 * Returns pick + reference photos so a worker can call OpenAI without Netlify timeouts.
 */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return okOptions();
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return json(405, { error: "GET or POST" });
  }
  if (!requireJobSecret(event) || !process.env.DAILY_JOB_SECRET) {
    return json(401, { error: "Unauthorized" });
  }

  initBlobs(event);
  const qs = event.queryStringParameters || {};
  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    body = {};
  }
  const dateISO = body.date || qs.date || chicagoParts().iso;
  const force = qs.force === "1" || qs.force === "true" || body.force === true;

  try {
    let pick = await getPick(dateISO);
    if (!pick?.pieces?.length) {
      return json(200, { pending: false, reason: "no pick", date: dateISO });
    }
    if (force && pick.imageUrl) {
      pick = {
        ...pick,
        imagePending: true,
        imageFailed: false,
        imageError: null,
        imageUrl: null,
      };
      await savePick(pick);
    } else if (pick.imageUrl && !pick.imagePending) {
      return json(200, { pending: false, reason: "already has image", date: dateISO });
    } else if (!pick.imagePending && pick.imageFailed) {
      // Allow retry of failed photos
    } else if (!pick.imagePending) {
      return json(200, { pending: false, reason: "not pending", date: dateISO });
    }

    const [refs, catalogue] = await Promise.all([getReferencePhotos(), loadCatalogue(event)]);
    if (!refs.length) {
      return json(200, { pending: true, error: "No reference photos", date: dateISO });
    }

    const byId = Object.fromEntries((catalogue.items || []).map((i) => [i.id, i]));
    const slotRank = (slot) =>
      slot === "both" ? 0 : slot === "top" || slot === "bottom" ? 1 : slot === "shoes" ? 3 : 2;
    const pieces = (pick.pieces || [])
      .map((id) => {
        const item = byId[id];
        if (!item) return { id };
        return {
          id,
          name: item.name,
          slot: item.slot,
          colors: item.colors,
          description: item.description,
          subcategory: item.subcategory,
          image: item.image_full || item.image || `images/source/${id}.jpg`,
          image_full: item.image_full || `images/source/${id}.jpg`,
        };
      })
      .sort((a, b) => slotRank(a.slot) - slotRank(b.slot));

    const garmentLabels = pieces
      .filter((p) => p.name && (p.slot === "both" || p.slot === "top" || p.slot === "bottom" || p.slot === "shoes"))
      .map((p) => p.name);
    const { prompt, style } = buildTryOnPrompt(pick, byId, garmentLabels);

    return json(200, {
      pending: true,
      date: dateISO,
      pick: publicPick(pick),
      prompt,
      style: style || styleSuggestions(pick),
      pieces,
      references: refs.map((r) => ({
        contentType: r.contentType || "image/jpeg",
        base64: Buffer.from(r.bytes).toString("base64"),
      })),
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: String(err.message || err) });
  }
}
