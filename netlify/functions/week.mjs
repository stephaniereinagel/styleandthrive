import { getSettings, getWeekPicks } from "../lib/store.mjs";
import { json, okOptions, pinOk, publicPick } from "../lib/http.mjs";
import { mondayOf, parseISODate, toISODate, chicagoParts } from "../lib/season.mjs";

/** GET a week's daily picks keyed by ISO date. */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return okOptions();
  if (event.httpMethod !== "GET") return json(405, { error: "GET only" });

  try {
    const settings = await getSettings();
    if (!pinOk(event, settings)) {
      return json(401, { error: "PIN required", needsPin: true });
    }

    const qs = event.queryStringParameters || {};
    let mondayISO = qs.monday;
    if (!mondayISO) {
      mondayISO = toISODate(mondayOf(parseISODate(chicagoParts().iso)));
    }

    const raw = await getWeekPicks(mondayISO);
    const picks = {};
    for (const [iso, pick] of Object.entries(raw)) {
      picks[iso] = publicPick(pick);
    }

    return json(200, { monday: mondayISO, picks });
  } catch (err) {
    console.error(err);
    return json(500, { error: String(err.message || err) });
  }
}
