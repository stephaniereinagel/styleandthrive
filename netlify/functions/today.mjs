import { chicagoParts } from "../lib/season.mjs";
import { getSettings, getPick } from "../lib/store.mjs";
import { json, okOptions, pinOk, publicPick } from "../lib/http.mjs";
import { fetchWeather, DEFAULT_LOCATION } from "../lib/weather.mjs";
import { fetchIcalEvents, activityFromEvents } from "../lib/ical.mjs";

/** GET today's pick (+ live weather/events if no pick yet). */
export async function handler(event) {
  if (event.httpMethod === "OPTIONS") return okOptions();
  if (event.httpMethod !== "GET") return json(405, { error: "GET only" });

  try {
    const settings = await getSettings();
    if (!pinOk(event, settings)) {
      return json(401, { error: "PIN required", needsPin: true });
    }

    const qs = event.queryStringParameters || {};
    const dateISO = qs.date || chicagoParts().iso;
    const pick = await getPick(dateISO);

    const lat = settings.lat ?? DEFAULT_LOCATION.lat;
    const lon = settings.lon ?? DEFAULT_LOCATION.lon;
    const locationLabel = settings.locationLabel || DEFAULT_LOCATION.label;

    let weather = pick?.weather || null;
    let activity = pick?.activity || null;

    if (!weather || !activity) {
      try {
        weather = weather || (await fetchWeather(lat, lon, dateISO));
      } catch (err) {
        console.error(err);
      }
      try {
        if (!activity) {
          const events = await fetchIcalEvents(settings.icalUrl || "", dateISO);
          activity = activityFromEvents(events);
          activity = {
            summary: activity.summary,
            events: activity.events.map((e) => ({ summary: e.summary, time: e.time })),
            nudgeTheme: activity.nudgeTheme,
          };
        }
      } catch (err) {
        console.error(err);
        activity = activity || { summary: "calendar unavailable", events: [], nudgeTheme: null };
      }
    }

    return json(200, {
      date: dateISO,
      pick: publicPick(pick),
      weather,
      activity,
      locationLabel,
      configured: {
        hasIcal: !!settings.icalUrl,
        hasReferencePhoto: !!settings.hasReferencePhoto,
        hasPin: !!settings.pinHash,
        locationLabel,
      },
    });
  } catch (err) {
    console.error(err);
    return json(500, { error: String(err.message || err) });
  }
}
