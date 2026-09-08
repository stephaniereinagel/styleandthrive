/**
 * AI try-on via OpenAI Images (gpt-image-2) with Stephanie's reference photo
 * plus full-size closet photos of the actual outfit pieces.
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

const CONSTRAINED = new Set(["top", "bottom", "topper", "both"]);

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

function pieceDetail(item) {
  if (!item) return "";
  const bits = [
    item.name,
    item.subcategory,
    (item.colors || []).slice(0, 2).join("/"),
    item.description ? String(item.description).slice(0, 160) : "",
  ].filter(Boolean);
  return bits.join(" — ");
}

/**
 * Build try-on prompt. When closet garment photos are attached, those win over
 * generic silhouette coaching (which was inventing the wrong olive dress).
 */
export function buildTryOnPrompt(pick, catalogueById, garmentLabels = []) {
  const items = (pick.pieces || []).map((id) => catalogueById[id]).filter(Boolean);
  const names = items.map((p) => {
    const colors = (p.colors || []).slice(0, 2).join("/");
    return `${p.name}${colors ? ` (${colors})` : ""} [${p.slot}]`;
  });
  const details = items
    .filter((p) => CONSTRAINED.has(p.slot) || p.slot === "shoes")
    .map((p) => pieceDetail(p));

  const style = styleSuggestions(pick);
  const hasGarmentPhotos = garmentLabels.length > 0;
  const garmentLines = hasGarmentPhotos
    ? garmentLabels.map((g, i) => `Image ${i + 2} is the closet photo of: ${g}.`).join(" ")
    : "";

  return {
    prompt: [
      "Photorealistic virtual try-on. Composite ONLY — do not redesign the clothes.",
      "Image 1 is Stephanie (the woman). Keep her exact face, facial features, skin tone, age, dark brown hair color, and body shape (high waist, full bust, long legs).",
      hasGarmentPhotos
        ? `${garmentLines} Put her in those exact garments from the closet photos. Copy neckline, sleeve shape, fabric texture, color, length, waistline, and every visible construction detail from Image 2+ — pixel-faithful clothing match.`
        : "Wardrobe must match the listed pieces exactly — do not invent garments.",
      "CRITICAL: If Image 2 shows a V-neck or wrap dress, do NOT output a crew-neck jersey tee-dress. Do not invent a side slit, ribbed crew collar, or different olive dress from elsewhere in her closet.",
      "Ignore clutter/mirrors/hangers in closet photos — extract only the garment(s) and shoes she should wear.",
      `Setting: ${style.background}. Do not keep the original room from Image 1.`,
      `Pose: ${style.pose}.`,
      `Hairstyle: ${style.hairstyle} (same hair color/texture, restyled).`,
      hasGarmentPhotos
        ? "Fit the real garments flatteringly on her body without changing their cut. Do not impose a generic 'marked waist' silhouette if the closet photo shows a different cut."
        : "Silhouette: marked waist, skim the hip, draw the eye up.",
      `Outfit formula: ${pick.outfit}`,
      `Pieces: ${names.join("; ")}.`,
      details.length ? `Garment details: ${details.join(" | ")}.` : "",
      pick?.style?.accessories?.length
        ? `Subtle finishers only (do not invent new clothes): ${(pick.style.accessories || [])
            .slice(0, 3)
            .map((a) => a.name)
            .join("; ")}.`
        : "",
      "Full or three-quarter body. No text overlay, no watermark, no extra people.",
    ]
      .filter(Boolean)
      .join(" "),
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

/** Prefer full-size source photos; constrained pieces (dress/top) before shoes. */
function garmentPathsForItem(item, id) {
  const full = String(item.image_full || `images/source/${id}.jpg`).replace(/^\//, "");
  const thumb = String(item.image || `images/thumbs/${id}.jpg`).replace(/^\//, "");
  const paths = [];
  if (full && !/\.svg$/i.test(full)) paths.push(full);
  if (thumb && thumb !== full && !/\.svg$/i.test(thumb)) paths.push(thumb);
  return paths;
}

function sortPieceIdsForTryOn(catalogue, pieceIds) {
  const byId = Object.fromEntries((catalogue.items || []).map((i) => [i.id, i]));
  const rank = (id) => {
    const slot = byId[id]?.slot || "";
    if (slot === "both") return 0;
    if (slot === "top" || slot === "bottom") return 1;
    if (slot === "topper" || slot === "outerwear") return 2;
    if (slot === "shoes") return 3;
    return 4;
  };
  return [...(pieceIds || [])].sort((a, b) => rank(a) - rank(b));
}

/** Load closet photos for outfit pieces (full source preferred over thumbs). */
export async function loadGarmentImages(catalogue, pieceIds, event) {
  const byId = Object.fromEntries((catalogue.items || []).map((i) => [i.id, i]));
  const host = event?.headers?.["x-forwarded-host"] || event?.headers?.host;
  const proto = event?.headers?.["x-forwarded-proto"] || "https";
  const base = host ? `${proto}://${host}` : "";
  const out = [];
  const ordered = sortPieceIdsForTryOn(catalogue, pieceIds);

  for (const id of ordered) {
    const item = byId[id];
    if (!item) continue;
    const paths = garmentPathsForItem(item, id);
    let loaded = null;

    for (const rel of paths) {
      if (base) {
        try {
          const res = await fetch(`${base}/${rel}`);
          if (res.ok) {
            const bytes = Buffer.from(await res.arrayBuffer());
            if (sniffType(bytes)) {
              loaded = { bytes, contentType: "image/jpeg", name: item.name || id, path: rel };
              break;
            }
          }
        } catch (err) {
          console.warn("garment fetch failed", id, rel, err.message || err);
        }
      }
      try {
        const { readFile } = await import("node:fs/promises");
        const { join } = await import("node:path");
        const bytes = await readFile(join(process.cwd(), rel));
        if (sniffType(bytes)) {
          loaded = { bytes, contentType: "image/jpeg", name: item.name || id, path: rel };
          break;
        }
      } catch {
        /* try next path */
      }
    }

    if (loaded) {
      out.push(loaded);
      console.log("garment loaded", id, loaded.path, loaded.bytes.length);
    }
    if (out.length >= 3) break;
  }
  return out;
}

async function editWithImages({ apiKey, model, prompt, images, quality = "high" }) {
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", prompt);
  form.append("size", "1024x1536");
  form.append("quality", quality);
  form.append("output_format", "png");
  // gpt-image-2: omit input_fidelity (always high). Older models: high when we have garments.
  if (model !== "gpt-image-2") {
    form.append("input_fidelity", images.length > 1 ? "high" : "low");
  }

  images.forEach((ref, i) => {
    const { blob, filename, bytes } = toImageBlob(ref, i);
    if (bytes < 500) throw new Error(`Image ${i + 1} too small`);
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
  if (!garmentRefs.length) {
    console.warn("try-on: no garment images loaded — clothing match will be weak");
  }
  const models = [IMAGE_MODEL, ...FALLBACK_MODELS];
  let lastErr = null;

  for (let p = 0; p < personRefs.length; p++) {
    const images = [personRefs[p], ...garmentRefs];
    for (const model of models) {
      try {
        try {
          return await editWithImages({
            apiKey,
            model,
            prompt,
            images,
            quality: "high",
          });
        } catch (multiErr) {
          const msg = String(multiErr?.body || multiErr?.message || "");
          // Only fall back to person-only if the API rejects multi-image —
          // and keep a stern reminder not to invent clothes.
          if (images.length > 1 && /multiple|only one|Duplicate parameter|image\[\]/i.test(msg)) {
            console.warn(`${model}: multi-image rejected, retrying person-only (weaker match)`);
            return await editWithImages({
              apiKey,
              model,
              prompt: `${prompt} IMPORTANT: Closet photos could not be attached. Recreate the listed pieces as faithfully as possible from the text details — especially neckline and fabric. Do not substitute a different dress.`,
              images: [personRefs[p]],
              quality: "high",
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
