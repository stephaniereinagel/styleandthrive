/**
 * AI try-on via OpenAI Images (gpt-image-1) with Stephanie's reference photo.
 * On failure, caller keeps the outfit pick and skips the image.
 */

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

function daySeed(dateISO = "") {
  return [...String(dateISO)].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}

/** Pick a stable hairstyle / pose / backdrop for the day (and theme). */
export function styleSuggestions(pick) {
  const theme = pick?.theme || "Practical";
  const hairs = HAIR_BY_THEME[theme] || HAIR_BY_THEME.Practical;
  const seed = daySeed(pick?.date) + theme.length * 17;
  return {
    hairstyle: hairs[seed % hairs.length],
    pose: POSES[seed % POSES.length],
    background: BACKGROUNDS[seed % BACKGROUNDS.length],
  };
}

export function buildTryOnPrompt(pick, catalogueById) {
  const names = (pick.pieces || [])
    .map((id) => catalogueById[id])
    .filter(Boolean)
    .map((p) => {
      const colors = (p.colors || []).slice(0, 2).join("/");
      return `${p.name}${colors ? ` (${colors})` : ""} [${p.slot}]`;
    });

  const style = styleSuggestions(pick);

  return {
    prompt: [
      "Create a new photorealistic full-body (or three-quarter) photo of the SAME woman from the reference.",
      "Keep her exact face, facial features, skin tone, age, and Soft Autumn coloring so she is clearly recognizable.",
      "Her body proportions stay the same (high waist, full bust, long legs) — marked waist, skim the hip, draw the eye up.",
      `CHANGE the setting: ${style.background}. Do NOT keep the original room, furniture, or clutter.`,
      `CHANGE the pose: ${style.pose}. Do NOT copy the reference pose exactly.`,
      `Hairstyle suggestion for today: ${style.hairstyle}. Same dark brown hair color and natural texture; restyle it as suggested.`,
      "Homestead-mom energy: flattering, realistic, natural light — not glam editorial.",
      "Wardrobe must match exactly — do not invent extra garments. Shoes must match the list.",
      `Outfit formula: ${pick.outfit}`,
      `Pieces: ${names.join("; ")}.`,
      "No text overlay, no watermark, no extra people.",
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

function toImageBlob(ref) {
  const raw = ref.bytes;
  const u8 = raw instanceof Uint8Array ? raw : new Uint8Array(raw);
  const sniffed = sniffType(u8);
  const type = sniffed || normalizeType(ref.contentType);
  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  return {
    blob: new Blob([u8], { type }),
    filename: `reference.${ext}`,
    type,
    bytes: u8.length,
  };
}

async function editWithImage({ apiKey, prompt, ref }) {
  const { blob, filename, type, bytes } = toImageBlob(ref);
  if (bytes < 1000) {
    throw new Error(`Reference photo too small (${bytes} bytes)`);
  }
  if (!sniffType(ref.bytes instanceof Uint8Array ? ref.bytes : new Uint8Array(ref.bytes))) {
    console.warn("Reference photo type not sniffed as jpeg/png/webp; contentType=", ref.contentType);
  }

  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append(
    "prompt",
    `${prompt} The reference is for identity only (face and body). Freely change background, pose, and hairstyle as instructed.`
  );
  form.append("size", "1024x1536");
  form.append("quality", "medium");
  // Low fidelity so pose/background can change; face kept via prompt
  form.append("input_fidelity", "low");
  form.append("output_format", "png");
  form.append("image", blob, filename);

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("OpenAI image edit failed", res.status, type, bytes, errText.slice(0, 800));
    const err = new Error(`OpenAI ${res.status}: ${errText.slice(0, 240)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI response missing image data");
  return {
    bytes: Buffer.from(b64, "base64"),
    contentType: "image/png",
  };
}

/**
 * @returns {Promise<{bytes: Buffer, contentType: string}|null>}
 */
export async function generateTryOn({ apiKey, references, referenceBytes, referenceType, prompt }) {
  if (!apiKey) {
    console.error("OpenAI try-on skipped: missing OPENAI_API_KEY");
    return null;
  }
  const refs =
    Array.isArray(references) && references.length
      ? references.filter((r) => r?.bytes?.length)
      : referenceBytes?.length
        ? [{ bytes: referenceBytes, contentType: referenceType || "image/jpeg" }]
        : [];
  if (!refs.length) {
    console.error("OpenAI try-on skipped: no reference photos");
    return null;
  }

  let lastErr = null;
  for (let i = 0; i < refs.length; i++) {
    try {
      return await editWithImage({ apiKey, prompt, ref: refs[i] });
    } catch (err) {
      lastErr = err;
      console.error(`try-on failed with reference ${i + 1}`, err.message || err);
    }
  }
  throw lastErr || new Error("Try-on failed for all reference photos");
}
