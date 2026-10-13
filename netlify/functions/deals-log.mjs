import { initBlobs } from "../lib/store.mjs";
import { json, okOptions, requireJobSecret } from "../lib/http.mjs";

/**
 * Memory for the deal hunter (GitHub Actions runner).
 * GET  -> { seen: { [key]: { date, price } }, posted: [...] }
 * POST { deals: [{ key, price, ... }] } -> records them as posted.
 */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return okOptions();
  const store = initBlobs(event);
  if (!requireJobSecret(event)) return json(401, { error: "Unauthorized" });

  const seen = (await store.get("deals/seen", { type: "json" })) || {};
  const posted = (await store.get("deals/posted", { type: "json" })) || [];

  if (event.httpMethod === "GET") return json(200, { seen, posted: posted.slice(-50) });

  let body = {};
  try {
    body = event.body ? JSON.parse(event.body) : {};
  } catch {
    return json(400, { error: "Bad JSON" });
  }
  const deals = Array.isArray(body.deals) ? body.deals : [];
  const date = new Date().toISOString().slice(0, 10);
  for (const d of deals) {
    if (!d?.key) continue;
    seen[d.key] = { date, price: d.price ?? null };
    posted.push({ ...d, date });
  }
  await store.setJSON("deals/seen", seen);
  await store.setJSON("deals/posted", posted.slice(-200));
  return json(200, { ok: true, recorded: deals.length });
}
