/** Open-Meteo forecast — no API key. Default: Gravette, AR. */

export const DEFAULT_LOCATION = {
  lat: 36.42202,
  lon: -94.45355,
  label: "Gravette, AR",
};

const WMO = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Fog",
  51: "Drizzle",
  53: "Drizzle",
  55: "Drizzle",
  61: "Rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Snow",
  73: "Snow",
  75: "Snow",
  80: "Showers",
  81: "Showers",
  82: "Heavy showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

export function warmthBand(highF) {
  if (highF >= 80) return "hot";
  if (highF >= 70) return "warm";
  if (highF >= 55) return "mild";
  if (highF >= 40) return "cool";
  return "cold";
}

export async function fetchWeather(lat = DEFAULT_LOCATION.lat, lon = DEFAULT_LOCATION.lon, dateISO) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,windspeed_10m_max` +
    `&temperature_unit=fahrenheit&windspeed_unit=mph&timezone=America%2FChicago` +
    `&start_date=${dateISO}&end_date=${dateISO}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  const data = await res.json();
  const d = data.daily;
  const high = Math.round(d.temperature_2m_max[0]);
  const low = Math.round(d.temperature_2m_min[0]);
  const precip = d.precipitation_probability_max[0] ?? 0;
  const code = d.weathercode[0];
  const wind = Math.round(d.windspeed_10m_max[0] ?? 0);
  const wet = precip >= 50 || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code);
  const band = warmthBand(high);

  return {
    high,
    low,
    precip,
    wind,
    code,
    condition: WMO[code] || "Mixed",
    wet,
    band,
    label: `${high}° / ${low}° · ${WMO[code] || "Mixed"}`,
  };
}
