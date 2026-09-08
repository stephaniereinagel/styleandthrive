import { initBlobs, getSettings } from "../lib/store.mjs";
import { json, okOptions, pinOk, requireJobSecret } from "../lib/http.mjs";
import { runTryOn, resolveDateISO } from "../lib/run-daily-select.mjs";

/**
 * Synchronous try-on (may take 15–25s). Prefer this on free/starter plans.
 * Pro plans can also use tryon-background for longer runs.
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
    const isJob = requireJobSecret(event) && !!process.env.DAILY_JOB_SECRET;
    if (settings.pinHash && !isJob && !pinOk(event, settings)) {
      return json(401, { error: "PIN required", needsPin: true });
    }

    const dateISO = resolveDateISO(event, body);
    const result = await runTryOn({ event, dateISO });
    return json(200, result);
  } catch (err) {
    console.error(err);
    return json(500, { error: String(err.message || err) });
  }
}
