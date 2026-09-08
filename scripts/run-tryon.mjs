#!/usr/bin/env node
/**
 * Off-platform try-on worker (GitHub Actions).
 * Avoids Netlify's ~30s edge timeout by calling OpenAI from the runner.
 *
 * Env: SITE_URL, DAILY_JOB_SECRET, OPENAI_API_KEY, optional DATE=YYYY-MM-DD
 */
import { generateTryOn } from "../netlify/lib/tryon.mjs";

const SITE = (process.env.SITE_URL || process.env.STYLE_THRIVE_URL || "").replace(/\/$/, "");
const SECRET = process.env.DAILY_JOB_SECRET || "";
const API_KEY = process.env.OPENAI_API_KEY || "";
const DATE = process.env.DATE || "";

if (!SITE || !SECRET || !API_KEY) {
  console.error("Need SITE_URL, DAILY_JOB_SECRET, OPENAI_API_KEY");
  process.exit(1);
}

async function main() {
  const packUrl = `${SITE}/.netlify/functions/tryon-pack${DATE ? `?date=${DATE}` : ""}`;
  const packRes = await fetch(packUrl, {
    headers: { "x-job-secret": SECRET },
  });
  const pack = await packRes.json();
  if (!packRes.ok) throw new Error(pack.error || `pack ${packRes.status}`);
  if (!pack.pending) {
    console.log("Nothing pending:", pack.reason || "ok");
    return;
  }
  if (pack.error) throw new Error(pack.error);
  if (!pack.references?.length) throw new Error("No reference photos in pack");

  const references = pack.references.map((r) => ({
    bytes: Buffer.from(r.base64, "base64"),
    contentType: r.contentType || "image/jpeg",
  }));

  const garments = [];
  for (const piece of (pack.pieces || []).slice(0, 3)) {
    const rel = String(piece.image || `images/thumbs/${piece.id}.jpg`).replace(/^\//, "");
    if (/\.svg$/i.test(rel)) continue;
    try {
      const res = await fetch(`${SITE}/${rel}`);
      if (!res.ok) continue;
      const bytes = Buffer.from(await res.arrayBuffer());
      if (bytes.length < 500) continue;
      garments.push({
        bytes,
        contentType: "image/jpeg",
        name: piece.name || piece.id,
      });
    } catch (err) {
      console.warn("garment fetch failed", piece.id, err.message);
    }
  }

  console.log(
    `Generating try-on for ${pack.date}: ${references.length} ref(s), ${garments.length} garment(s)`
  );
  const img = await generateTryOn({
    apiKey: API_KEY,
    references,
    garments,
    prompt: pack.prompt,
  });
  if (!img?.bytes?.length) throw new Error("Empty try-on result");

  const saveRes = await fetch(`${SITE}/.netlify/functions/tryon-save`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-job-secret": SECRET,
    },
    body: JSON.stringify({
      date: pack.date,
      imageBase64: img.bytes.toString("base64"),
      contentType: img.contentType || "image/png",
      model: img.model || "gpt-image-2",
      style: pack.style,
    }),
  });
  const saved = await saveRes.json().catch(() => ({}));
  if (!saveRes.ok) throw new Error(saved.error || `save ${saveRes.status}`);
  console.log("Saved try-on", pack.date, saved.pick?.imageUrl || "ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
