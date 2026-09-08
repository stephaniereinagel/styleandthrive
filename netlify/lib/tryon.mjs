/**
 * AI try-on via OpenAI Images (gpt-image-1) with Stephanie's reference photo.
 * On failure, caller keeps the outfit pick and skips the image.
 */

export function buildTryOnPrompt(pick, catalogueById) {
  const names = (pick.pieces || [])
    .map((id) => catalogueById[id])
    .filter(Boolean)
    .map((p) => {
      const colors = (p.colors || []).slice(0, 2).join("/");
      return `${p.name}${colors ? ` (${colors})` : ""} [${p.slot}]`;
    });

  return [
    "Edit this photo of the same woman so she is wearing the outfit described below.",
    "Keep her exact face, hair, body shape, and identity. Soft Autumn coloring.",
    "Homestead mom look: natural light, flattering but realistic, full or three-quarter body.",
    "Silhouette: marked waist, skim the hip, draw the eye up. Waist-length layers when layered.",
    "Do not invent extra garments. Shoes must match the list.",
    `Outfit formula: ${pick.outfit}`,
    `Pieces: ${names.join("; ")}.`,
    "Photorealistic. No text overlay, no watermark, no extra people.",
  ].join(" ");
}

function normalizeType(contentType) {
  const t = String(contentType || "image/jpeg").split(";")[0].trim().toLowerCase();
  if (t === "image/jpg") return "image/jpeg";
  if (t === "image/heic" || t === "image/heif") return "image/jpeg"; // may still fail if bytes are HEIC
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
    // HEIC/unknown often fails OpenAI validation
    console.warn("Reference photo type not sniffed as jpeg/png/webp; contentType=", ref.contentType);
  }

  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append(
    "prompt",
    `${prompt} Use the attached reference photo only for her face, hair, and body — replace the clothes with the outfit listed.`
  );
  form.append("size", "1024x1536");
  form.append("quality", "medium");
  form.append("input_fidelity", "high");
  form.append("output_format", "png");
  // One image only — do not pass a third filename arg when using Blob name via File
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
  // Try each stored reference alone (model allows only one image per request)
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
