import { initBlobs, getSettings } from "../lib/store.mjs";
import { json, okOptions, pinOk } from "../lib/http.mjs";
import { runDailySelect, resolveDateISO } from "../lib/run-daily-select.mjs";

/**
 * On-demand outfit pick (Home "Pick again" / Settings "Pick now").
 * Separate from scheduled daily-select so Netlify does not 403 HTTP invokes.
 */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return okOptions();
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") {
    return json(405, { error: "POST or GET" });
  }
  initBlobs(event);

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    body = {};
  }

  try {
    const settings = await getSettings();
    if (settings.pinHash && !pinOk(event, settings)) {
      return json(401, { error: "PIN required", needsPin: true });
    }

    const dateISO = resolveDateISO(event, body);
    const result = await runDailySelect({ event, dateISO, force: true });
    return json(200, result);
  } catch (err) {
    console.error(err);
    return json(500, { error: String(err.message || err) });
  }
}
