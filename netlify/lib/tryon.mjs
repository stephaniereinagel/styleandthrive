/**
 * AI try-on via OpenAI Images (gpt-image-2) with Stephanie's reference photo
 * plus hanger photos of the actual outfit pieces.
 */

const IMAGE_MODEL = "gpt-image-2";
const FALLBACK_MODELS = ["gpt-image-1.5", "gpt-image-1"];

const HAIR_BY_THEME = {
  Practical: [
    "loose low ponytail with soft face pieces",
    "half-up messy bun (her usual easy look)",
    "soft claw-clip twist at the crown",
  ],
  Cozy: [
    "loose soft waves down past the shoulders",
    "side part with ends tucked behind one ear",
    "low bun with a few wispy pieces out",
  ],
  Feminine: [
    "soft waves with a gentle side part",
    "polished half-up with light volume at the crown",
    "neat low chignon, soft and pretty",
  ],
  Playful: [
    "high messy bun with bounce",
    "loose braid over one shoulder",
    "half-up with playful texture",
  ],
  Polished: [
    "smooth soft waves, brushed and finished",
    "sleek low ponytail",
    "neat half-up, clean and intentional",
  ],
};

const POSES = [
  "standing three-quarter view, weight on one hip, relaxed natural smile",
  "facing camera, one hand lightly marking the waist, confident but easy",
  "walking toward camera with a natural stride, looking at the lens",
  "standing angled slightly, arms relaxed at her sides, soft smile",
];

const BACKGROUNDS = [
  "clean blank warm-cream studio backdrop, soft even light, no furniture or clutter",
  "plain soft taupe seamless backdrop, empty and calm",
  "simple light oatmeal wall with soft window light only — no room details",
];

function daySeed(dateISO = "", extra = 0) {
  return [...String(dateISO)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) + Number(extra || 0) * 31;
}

/** Pick a stable hairstyle / pose / backdrop for the day (and theme). */
export function styleSuggestions(pick) {
  const theme = pick?.theme || "Practical";
  const hairs = HAIR_BY_THEME[theme] || HAIR_BY_THEME.Practical;
  const seed = daySeed(pick?.date, pick?.pickCount || 0) + theme.length * 17;
  return {
    hairstyle: hairs[seed % hairs.length],
    pose: POSES[seed % POSES.length],
    background: BACKGROUNDS[seed % BACKGROUNDS.length],
  };
}

export function buildTryOnPrompt(pick, catalogueById, garmentLabels = []) {
  const names = (pick.pieces || [])
    .map((id) => catalogueById[id])
    .filter(Boolean)
    .map((p) => {
      const colors = (p.colors || []).slice(0, 2).join("/");
      return `${p.name}${colors ? ` (${colors})` : ""} [${p.slot}]`;
    });

  const style = styleSuggestions(pick);
  const garmentLines = garmentLabels.length
    ? garmentLabels.map((g, i) => `Image ${i + 2}: exact closet photo of ${g}`).join(". ")
    : "";

  return {
    prompt: [
      "Photorealistic virtual try-on composite.",
      "Image 1 is the woman (Stephanie) — preserve her exact face, facial features, skin tone, age, dark brown hair color, and body shape (high waist, full bust, long legs) so she is unmistakably the same person.",
      garmentLines
        ? `${garmentLines}. Dress her in those exact garments — match fabric, color, pattern, cut, and details from the closet photos. Do not invent or substitute clothes.`
        : "Wardrobe must match the listed pieces exactly — do not invent garments.",
      `Setting: ${style.background}. Do not keep the original room.`,
      `Pose: ${style.pose}.`,
      `Hairstyle: ${style.hairstyle} (same hair color/texture, restyled).`,
      "Silhouette: marked waist, skim the hip, draw the eye up. Homestead-mom, flattering, natural light — not glam editorial.",
      `Outfit formula: ${pick.outfit}`,
      `Pieces: ${names.join("; ")}.`,
      "Full or three-quarter body. No text overlay, no watermark, no extra people.",
    ].join(" "),
    style,
  };
}

function normalizeType(contentType) {
  const t = String(contentType || "image/jpeg").split(";")[0].trim().toLowerCase();
  if (t === "image/jpg") return "image/jpeg";
  if (t === "image/heic" || t === "image/heif") return "image/jpeg";
  if (t.startsWith("image/")) return t;
  return "image/jpeg";
}

function sniffType(bytes) {
  if (!bytes || bytes.length < 12) return null;
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return "image/webp";
  return null;
}

function toImageBlob(ref, index = 0) {
  const raw = ref.bytes;
  const u8 = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  const sniffed = sniffType(u8);
  const type = sniffed || normalizeType(ref.contentType);
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  return {
    blob: new Blob([u8], { type }),
    filename: `img-${index + 1}.${ext}`,
    type,
    bytes: u8.length,
  };
}

/** Load hanger photos for outfit pieces from the published site files. */
export async function loadGarmentImages(catalogue, pieceIds) {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const byId = Object.fromEntries((catalogue.items || []).map((i) => [i.id, i]));
  const out = [];

  for (const id of pieceIds || []) {
    const item = byId[id];
    if (!item) continue;
    const rel = String(item.image_full || item.image || `images/source/${id}.jpg`).replace(/^\//, "");
    if (/\.svg$/i.test(rel)) continue; // OpenAI needs raster
    const candidates = [join(process.cwd(), rel), join(process.cwd(), "images", "source", `${id}.jpg`)];
    for (const path of candidates) {
      try {
        const bytes = await readFile(path);
        if (!sniffType(bytes)) continue;
        out.push({
          bytes,
          contentType: path.endsWith(".png") ? "image/png" : "image/jpeg",
          name: item.name || id,
        });
        break;
      } catch {
        /* try next path */
      }
    }
    if (out.length >= 4) break; // person + 4 garments is plenty
  }
  return out;
}

async function editWithImages({ apiKey, model, prompt, images }) {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", "1024x1536");
  form.append("quality", "high");
  form.append("output_format", "png");
  // gpt-image-2: omit input_fidelity (always high). Older models: set high when alone.
  if (model !== "gpt-image-2" && images.length === 1) {
    form.append("input_fidelity", "high");
  }

  images.forEach((ref, i) => {
    const { blob, filename, bytes } = toImageBlob(ref, i);
    if (bytes < 500) throw new Error(`Image ${i + 1} too small`);
    // Repeat the `image` field — gpt-image-2 maps upload order to Image 1, Image 2, …
    form.append("image", blob, filename);
  });

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("OpenAI image edit failed", model, res.status, errText.slice(0, 800));
    const err = new Error(`OpenAI ${res.status}: ${errText.slice(0, 240)}`);
    err.status = res.status;
    err.body = errText;
    throw err;
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI response missing image data");
  return {
    bytes: Buffer.from(b64, "base64"),
    contentType: "image/png",
    model,
  };
}

function modelNotAvailable(err) {
  const t = String(err?.body || err?.message || "");
  return /model|not found|does not exist|invalid/i.test(t) && /gpt-image/i.test(t);
}

/**
 * @returns {Promise<{bytes: Buffer, contentType: string, model?: string}|null>}
 */
export async function generateTryOn({
  apiKey,
  references,
  referenceBytes,
  referenceType,
  garments = [],
  prompt,
}) {
  if (!apiKey) {
    console.error("OpenAI try-on skipped: missing OPENAI_API_KEY");
    return null;
  }
  const personRefs =
    Array.isArray(references) && references.length
      ? references.filter((r) => r?.bytes?.length)
      : referenceBytes?.length
        ? [{ bytes: referenceBytes, contentType: referenceType || "image/jpeg" }]
        : [];
  if (!personRefs.length) {
    console.error("OpenAI try-on skipped: no reference photos");
    return null;
  }

  const garmentRefs = (garments || []).filter((g) => g?.bytes?.length).slice(0, 4);
  const models = [IMAGE_MODEL, ...FALLBACK_MODELS];
  let lastErr = null;

  // Prefer first person photo; if it fails, try the next stored person photo
  for (let p = 0; p < personRefs.length; p++) {
    const images = [personRefs[p], ...garmentRefs];
    for (const model of models) {
      try {
        // Older models may reject multiple images — fall back to person-only
        try {
          return await editWithImages({ apiKey, model, prompt, images });
        } catch (multiErr) {
          const msg = String(multiErr?.body || multiErr?.message || "");
          if (images.length > 1 && /multiple|only one|Duplicate parameter|image\[\]/i.test(msg)) {
            console.warn(`${model}: multi-image rejected, retrying person-only`);
            return await editWithImages({
              apiKey,
              model,
              prompt: `${prompt} (Garment photos unavailable in this request — match the listed pieces as closely as possible.)`,
              images: [personRefs[p]],
            });
          }
          throw multiErr;
        }
      } catch (err) {
        lastErr = err;
        console.error(`try-on failed model=${model} personRef=${p + 1}`, err.message || err);
        if (modelNotAvailable(err)) continue;
      }
    }
  }
  throw lastErr || new Error("Try-on failed for all models/references");
}
