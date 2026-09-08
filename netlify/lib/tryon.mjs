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

function toFile(ref, index) {
  const type = ref.contentType || "image/jpeg";
  const name = `reference-${index + 1}.jpg`;
  const bytes = ref.bytes;
  if (typeof File !== "undefined") {
    return new File([bytes], name, { type });
  }
  return new Blob([bytes], { type });
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

  // gpt-image-1 edits currently accept a single input image (not multiple).
  // Use the first uploaded reference; extra photos stay stored as backups.
  const primary = refs[0];
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

  const file = toFile(primary, 0);
  form.append("image", file, "reference.jpg");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    console.error("OpenAI image edit failed", res.status, errText.slice(0, 800));
    const err = new Error(`OpenAI ${res.status}: ${errText.slice(0, 240)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) {
    console.error("OpenAI image response missing b64_json", JSON.stringify(data).slice(0, 300));
    throw new Error("OpenAI response missing image data");
  }
  return {
    bytes: Buffer.from(b64, "base64"),
    contentType: "image/png",
  };
}
