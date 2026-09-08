import { initBlobs, getSettings } from "../lib/store.mjs";
import { pinOk, requireJobSecret } from "../lib/http.mjs";
import { runTryOn, resolveDateISO } from "../lib/run-daily-select.mjs";

/**
 * Background try-on (up to 15 min). Client gets 202 immediately —
 * avoids Netlify edge 502/504 while gpt-image runs.
 * File suffix `-background` enables Netlify background mode (Functions v1).
 */
export async function handler(event) {
  // Platform already returned 202; keep working and write result to Blobs.
  if (event.httpMethod === "OPTIONS") return;
  if (event.httpMethod !== "POST" && event.httpMethod !== "GET") return;

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
      console.error("tryon-background: PIN required");
      return;
    }

    const dateISO = resolveDateISO(event, body);
    const result = await runTryOn({ event, dateISO });
    console.log("tryon-background done", dateISO, result?.ok, result?.pick?.imageError || "");
  } catch (err) {
    console.error("tryon-background error", err);
  }
}
