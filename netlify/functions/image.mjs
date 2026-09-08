import { getSettings, getTryOnImage, initBlobs } from "../lib/store.mjs";
import { pinOk } from "../lib/http.mjs";

/** Serve try-on image for a date. PIN-gated when a PIN is configured. */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, x-household-pin",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
      },
      body: "",
    };
  }

  try {
    initBlobs(event);
    const settings = await getSettings();
    if (!pinOk(event, settings)) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "PIN required", needsPin: true }),
      };
    }

    const dateISO = event.queryStringParameters?.date;
    if (!dateISO) {
      return { statusCode: 400, body: "date required" };
    }

    const img = await getTryOnImage(dateISO);
    if (!img) {
      return { statusCode: 404, body: "Not found" };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": img.contentType,
        "Cache-Control": "private, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
      body: img.bytes.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: String(err.message || err) };
  }
}
