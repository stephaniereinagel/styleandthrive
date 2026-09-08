/** Netlify Blobs store for settings, daily picks, history, images. */

import { connectLambda, getStore } from "@netlify/blobs";

const STORE = "style-and-thrive";

/**
 * Functions v1 (export async function handler) must call connectLambda
 * before getStore, or Blobs throws MissingBlobsEnvironmentError.
 */
export function initBlobs(event) {
  if (event) connectLambda(event);
  return getStore(STORE);
}

export function blobs() {
  return getStore(STORE);
}

export async function getSettings() {
  const store = blobs();
  const raw = await store.get("settings", { type: "json" });
  return (
    raw || {
      icalUrl: "",
      lat: 36.42202,
      lon: -94.45355,
      locationLabel: "Gravette, AR",
      pinHash: "",
      hasReferencePhoto: false,
      referencePhotoCount: 0,
    }
  );
}

export async function saveSettings(partial) {
  const store = blobs();
  const current = await getSettings();
  const next = { ...current, ...partial, updatedAt: new Date().toISOString() };
  await store.setJSON("settings", next);
  return next;
}

export async function getHistory() {
  const store = blobs();
  const raw = await store.get("history", { type: "json" });
  return Array.isArray(raw) ? raw : [];
}

export async function appendHistory(pick) {
  const store = blobs();
  const history = await getHistory();
  const filtered = history.filter((h) => h.date !== pick.date);
  filtered.push({
    date: pick.date,
    pieces: pick.pieces,
    constrained: pick.constrained,
    slots: pick.slots,
    pieceMeta: pick.pieceMeta,
    theme: pick.theme,
    outfit: pick.outfit,
  });
  // Keep ~60 days
  filtered.sort((a, b) => a.date.localeCompare(b.date));
  const trimmed = filtered.slice(-60);
  await store.setJSON("history", trimmed);
  return trimmed;
}

export async function getPick(dateISO) {
  const store = blobs();
  return store.get(`picks/${dateISO}`, { type: "json" });
}

export async function savePick(pick) {
  const store = blobs();
  await store.setJSON(`picks/${pick.date}`, pick);
  await appendHistory(pick);
  return pick;
}

export async function getWeekPicks(mondayISO) {
  const { parseISODate, addDays, toISODate } = await import("./season.mjs");
  const monday = parseISODate(mondayISO);
  const out = {};
  for (let i = 0; i < 7; i++) {
    const iso = toISODate(addDays(monday, i));
    out[iso] = await getPick(iso);
  }
  return out;
}

/** Save one or more full-body reference photos (index 0 = primary). */
export async function saveReferencePhotos(photos) {
  const store = blobs();
  const list = Array.isArray(photos) ? photos : [photos];
  let count = 0;
  for (let i = 0; i < list.length; i++) {
    const photo = list[i];
    if (!photo?.bytes?.length) continue;
    const key = i === 0 ? "reference-photo" : `reference-photo-${i}`;
    await store.set(key, photo.bytes, {
      metadata: { contentType: photo.contentType || "image/jpeg" },
    });
    count += 1;
  }
  await saveSettings({ hasReferencePhoto: count > 0, referencePhotoCount: count });
  return count;
}

/** @deprecated prefer saveReferencePhotos */
export async function saveReferencePhoto(bytes, contentType = "image/jpeg") {
  return saveReferencePhotos([{ bytes, contentType }]);
}

export async function getReferencePhotos() {
  const store = blobs();
  const out = [];
  for (const key of ["reference-photo", "reference-photo-1", "reference-photo-2"]) {
    const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!result?.data) continue;
    out.push({
      bytes: Buffer.from(result.data),
      contentType: result.metadata?.contentType || "image/jpeg",
    });
  }
  return out;
}

export async function getReferencePhoto() {
  const photos = await getReferencePhotos();
  return photos[0] || null;
}

export async function saveTryOnImage(dateISO, bytes, contentType = "image/png") {
  const store = blobs();
  const key = `tryon/${dateISO}`;
  await store.set(key, bytes, { metadata: { contentType } });
  return key;
}

export async function getTryOnImage(dateISO) {
  const store = blobs();
  const key = `tryon/${dateISO}`;
  const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
  if (!result?.data) return null;
  return {
    bytes: Buffer.from(result.data),
    contentType: result.metadata?.contentType || "image/png",
  };
}
