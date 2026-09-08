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

/**
 * @param {object} opts
 * @param {string} opts.apiKey
 * @param {Array<{bytes: Buffer, contentType?: string}>} [opts.references]
 * @param {Buffer} [opts.referenceBytes] - single-photo legacy
 * @param {string} [opts.referenceType]
 * @param {string} opts.prompt
 * @returns {Promise<{bytes: Buffer, contentType: string}|null>}
 */
export async function generateTryOn({ apiKey, references, referenceBytes, referenceType, prompt }) {
  if (!apiKey) return null;
  const refs =
    Array.isArray(references) && references.length
      ? references.filter((r) => r?.bytes?.length)
      : referenceBytes?.length
        ? [{ bytes: referenceBytes, contentType: referenceType || "image/jpeg" }]
        : [];
  if (!refs.length) return null;

  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append(
    "prompt",
    `${prompt} Use the attached reference photo(s) only for her face, hair, and body — replace the clothes with the outfit listed.`
  );
  form.append("size", "1024x1536");
  form.append("quality", "medium");
  refs.slice(0, 3).forEach((ref, i) => {
    const type = ref.contentType || "image/jpeg";
    const blob = new Blob([ref.bytes], { type });
    form.append("image[]", blob, `reference-${i + 1}.jpg`);
  });

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("OpenAI image edit failed", res.status, errText.slice(0, 500));
    return null;
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    console.error("OpenAI image response missing b64_json");
    return null;
  }
  return {
    bytes: Buffer.from(b64, "base64"),
    contentType: "image/png",
  };
}
