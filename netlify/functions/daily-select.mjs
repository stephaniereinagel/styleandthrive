import { chicagoParts } from "../lib/season.mjs";
import { initBlobs, getSettings } from "../lib/store.mjs";
import { json, okOptions, requireJobSecret, pinOk } from "../lib/http.mjs";
import { runDailySelect, resolveDateISO } from "../lib/run-daily-select.mjs";

export const config = {
  schedule: "0 9,10 * * *",
};

/**
 * Scheduled 4am pick. Netlify may block public HTTP on scheduled functions (403),
 * so on-demand picks use pick-now.mjs instead.
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

  if (!requireJobSecret(event)) {
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

  try {
    const dateISO = resolveDateISO(event, body);
    const result = await runDailySelect({ event, dateISO, force: isForce });
    return json(200, result);
  } catch (err) {
    console.error(err);
    return json(500, { error: String(err.message || err) });
  }
}
