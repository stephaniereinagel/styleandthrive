import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function hashPin(pin, salt = randomBytes(16).toString("hex")) {
  const hash = createHash("sha256").update(`${salt}:${pin}`).digest("hex");
  return `${salt}:${hash}`;
}

export function verifyPin(pin, stored) {
  if (!pin || !stored || !stored.includes(":")) return false;
  const [salt, expected] = stored.split(":");
  const actual = createHash("sha256").update(`${salt}:${pin}`).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function json(status, body, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, x-household-pin, x-job-secret",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

export function okOptions() {
  return json(204, {});
}

export function requireJobSecret(event) {
  const secret = process.env.DAILY_JOB_SECRET || "";
  if (!secret) return true; // allow local/dev without secret
  const header = event.headers["x-job-secret"] || event.headers["X-Job-Secret"] || "";
  const qs = event.queryStringParameters?.secret || "";
  return header === secret || qs === secret;
}

export async function loadCatalogue(event) {
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const candidates = [
    join(process.cwd(), "data/catalogue.json"),
    join(process.cwd(), "wardrobe/data/catalogue.json"),
  ];
  for (const path of candidates) {
    try {
      const text = await readFile(path, "utf8");
      return JSON.parse(text);
    } catch {
      /* try next */
    }
  }
  const host = event.headers["x-forwarded-host"] || event.headers.host;
  const proto = event.headers["x-forwarded-proto"] || "https";
  if (!host) throw new Error("Could not load catalogue");
  const res = await fetch(`${proto}://${host}/data/catalogue.json`);
  if (!res.ok) throw new Error("Could not load catalogue");
  return res.json();
}

export function pinOk(event, settings) {
  if (!settings.pinHash) return true;
  const pin =
    event.headers["x-household-pin"] ||
    event.headers["X-Household-Pin"] ||
    event.queryStringParameters?.pin ||
    "";
  return verifyPin(pin, settings.pinHash);
}

export function publicPick(pick) {
  if (!pick) return null;
  return {
    date: pick.date,
    season: pick.season,
    day: pick.day,
    theme: pick.theme,
    outfit: pick.outfit,
    pieces: pick.pieces,
    why: pick.why,
    weather: pick.weather,
    activity: pick.activity,
    imageUrl: pick.imageUrl || null,
    imageFailed: !!pick.imageFailed,
    imageError: pick.imageError || null,
    relaxed: pick.relaxed || [],
    pickedAt: pick.pickedAt,
  };
}
