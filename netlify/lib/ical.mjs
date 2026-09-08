/**
 * Minimal iCal / ICS parser for Google Calendar secret feed.
 * Extracts VEVENT summary + DTSTART for a given America/Chicago date.
 */

function unfold(ics) {
  return ics.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

function parseDateValue(raw) {
  // VALUE=DATE:20260907 or 20260907T140000Z or TZID=...:20260907T090000
  const cleaned = raw.replace(/^[^:]*:/, "").trim();
  const m = cleaned.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseTimeLabel(raw) {
  const cleaned = raw.replace(/^[^:]*:/, "").trim();
  const m = cleaned.match(/T(\d{2})(\d{2})/);
  if (!m) return "all day";
  let h = Number(m[1]);
  const min = m[2];
  const ampm = h >= 12 ? "pm" : "am";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${min}${ampm}`;
}

export function parseIcalEvents(icsText, dateISO) {
  const text = unfold(icsText);
  const blocks = text.split("BEGIN:VEVENT").slice(1);
  const events = [];

  for (const block of blocks) {
    const body = block.split("END:VEVENT")[0] || "";
    const lines = body.split(/\r?\n/);
    let summary = "";
    let dtstart = "";
    let dtstartRaw = "";
    for (const line of lines) {
      if (line.startsWith("SUMMARY")) {
        summary = line.replace(/^SUMMARY[^:]*:/, "").trim()
          .replace(/\\,/g, ",").replace(/\\n/g, " ").replace(/\\;/g, ";");
      }
      if (line.startsWith("DTSTART")) {
        dtstartRaw = line;
        dtstart = parseDateValue(line);
      }
    }
    if (!summary || !dtstart) continue;
    if (dtstart !== dateISO) continue;
    events.push({
      summary,
      date: dtstart,
      time: parseTimeLabel(dtstartRaw),
    });
  }

  return events;
}

export async function fetchIcalEvents(icalUrl, dateISO) {
  if (!icalUrl) return [];
  const res = await fetch(icalUrl, {
    headers: { "User-Agent": "StyleAndThrive/1.0" },
  });
  if (!res.ok) throw new Error(`iCal fetch failed: ${res.status}`);
  const text = await res.text();
  return parseIcalEvents(text, dateISO);
}

/** Map calendar keywords → theme nudge + shoe preference. */
export function activityFromEvents(events) {
  const blob = events.map((e) => e.summary.toLowerCase()).join(" | ");
  const hits = [];
  let theme = null;
  let sturdyShoes = false;

  const rules = [
    { re: /\b(church|worship|sunday school|bible)\b/, theme: "Feminine", label: "church" },
    { re: /\b(farm\s*stand|garden|coop|chickens?|chores?|homestead)\b/, theme: "Practical", label: "farm / chores" },
    { re: /\b(creek|hike|hiking|trail|park|woods|adventure)\b/, theme: "Practical", label: "outdoors", sturdy: true },
    { re: /\b(doctor|appt|appointment|errands?|dentist|therapy)\b/, theme: "Polished", label: "errands" },
    { re: /\b(playdate|outing|museum|zoo|library)\b/, theme: "Playful", label: "outing" },
    { re: /\b(rest|home day|sick|quiet|nap day)\b/, theme: "Cozy", label: "home / rest" },
  ];

  for (const r of rules) {
    if (r.re.test(blob)) {
      hits.push(r.label);
      if (!theme) theme = r.theme;
      if (r.sturdy) sturdyShoes = true;
    }
  }

  return {
    events,
    nudgeTheme: theme,
    sturdyShoes,
    labels: hits,
    summary: hits.length ? hits.join(", ") : events.length ? "calendar day" : "no events",
  };
}
