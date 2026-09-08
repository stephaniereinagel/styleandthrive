import { chicagoParts } from "../lib/season.mjs";
import { initBlobs, getPick } from "../lib/store.mjs";
import { runTryOn } from "../lib/run-daily-select.mjs";

/**
 * Sweep today's pending try-on every few minutes (background).
 * Safety net when the client background invoke doesn't finish.
 */
export async function handler(event) {
  initBlobs(event);
  const dateISO = chicagoParts().iso;
  try {
    const pick = await getPick(dateISO);
    if (!pick?.pieces?.length) {
      console.log("pending-tryon: no pick", dateISO);
      return;
    }
    if (!pick.imagePending || pick.imageUrl) {
      console.log("pending-tryon: nothing to do", dateISO);
      return;
    }
    console.log("pending-tryon: generating", dateISO);
    const result = await runTryOn({ event, dateISO });
    console.log("pending-tryon: done", result?.ok, result?.pick?.imageError || "");
  } catch (err) {
    console.error("pending-tryon error", err);
  }
}
