#!/usr/bin/env node
/**
 * Style & Thrive deal hunter (GitHub Actions).
 * Finds 70%+ off natural-fiber pieces that fill a capsule gap or replace a weak piece,
 * then Alison posts only the few worth buying to Slack. Silent when nothing qualifies.
 *
 * Env: OPENAI_API_KEY, SLACK_BOT_TOKEN (Alison's own Slack app), SITE_URL, DAILY_JOB_SECRET
 * Optional: SLACK_DEALS_CHANNEL (overrides each person's slackChannel), DEALS_MODEL (default gpt-5), DRY_RUN=1 or --dry-run (print instead of post),
 *           --no-shopify, --no-web, --only=<store name>
 * Shopify rate-limits per IP after ~30 fast requests; keep the sleeps.
 */
import { readFile } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const ARGS = new Set(process.argv.slice(2));
const DRY = ARGS.has("--dry-run") || process.env.DRY_RUN === "1";
const SITE = (process.env.SITE_URL || process.env.STYLE_THRIVE_URL || "").replace(/\/$/, "");
const SECRET = process.env.DAILY_JOB_SECRET || "";
const API_KEY = process.env.OPENAI_API_KEY || "";
const MODEL = process.env.DEALS_MODEL || "gpt-5";
const SLACK_TOKEN = process.env.SLACK_BOT_TOKEN || "";
const SLACK_CHANNEL = process.env.SLACK_DEALS_CHANNEL || "";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const SYNTHETIC = [
  "polyester", "nylon", "polyamide", "acrylic", "spandex", "elastane", "lycra", "viscose", "rayon",
  "modal", "lyocell", "tencel", "acetate", "polyurethane", "faux leather", "vegan leather", "faux suede",
  "faux fur", "sherpa fleece", "polar fleece", "synthetik", "kunstleder", "mikrofaser",
];

const KINDS = [
  ["shoes", /\b(boots?|bootie|chelsea|clogs?|sneakers?|loafers?|mules?|flats|sandals?|shoes?|oxfords?)\b/],
  ["dress", /\b(dress|jumpsuit|romper|overalls?|coverall|jumper)\b/],
  ["bottom", /\b(pants?|jeans?|trousers?|skirt|shorts?|chinos?|culottes?|corduroys?|cords)\b/],
  ["outerwear", /\b(jacket|coat|parka|vest|blazer|shacket|anorak)\b/],
  ["top", /\b(top|tee|t-shirt|shirt|blouse|henley|sweater|cardigan|pullover|sweatshirt|hoodie|tank|cami|tunic|turtleneck|polo|knit|duster)\b/],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

async function fetchWithRetry(url, opts = {}, tries = 3) {
  for (let i = 0; i < tries; i++) {
    let res;
    try {
      res = await fetch(url, {
        ...opts,
        headers: { "User-Agent": UA, "Accept-Language": "en-US", ...(opts.headers || {}) },
        signal: AbortSignal.timeout(20000),
      });
    } catch (err) {
      if (i === tries - 1) throw err;
      await sleep(3000);
      continue;
    }
    if (res.status !== 429 || i === tries - 1) return res;
    await sleep(20000 * (i + 1));
  }
}

async function getJson(url) {
  const res = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
  if (!res.ok) return null;
  const type = res.headers.get("content-type") || "";
  if (!type.includes("json")) return null;
  return res.json().catch(() => null);
}

function stripHtml(html = "") {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalUrl(url) {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host.replace(/^www\./, "")}${u.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return url;
  }
}

function money(n) {
  return `$${Number(n).toFixed(Number(n) % 1 ? 2 : 0)}`;
}

/** Composition from text. Uses the first group of percentages that sums to ~100 (shell before lining). */
export function fiberInfo(text, rules, { allNatural = false, percentOnly = false } = {}) {
  const t = ` ${String(text).toLowerCase()} `;
  const isNatural = (phrase) =>
    rules.naturalFibers.some((f) => phrase.includes(f)) && !/faux|vegan|imitation|kunst/.test(phrase);
  const fiberWords = [...rules.naturalFibers, ...SYNTHETIC];
  const parts = [];
  let sum = 0;
  for (const m of t.matchAll(/(\d{1,3}(?:\.\d+)?)\s*%\s*([a-zäöü][a-zäöü \-]{2,30})/g)) {
    const pct = Number(m[1]);
    const phrase = m[2].trim().split(/\s{2,}|,|;/)[0];
    if (!pct || pct > 100 || !fiberWords.some((f) => phrase.includes(f))) continue;
    parts.push({ pct, phrase });
    sum += pct;
    if (sum >= 99) break;
  }
  if (sum >= 95 && sum <= 101) {
    const nat = parts.filter((p) => isNatural(p.phrase)).reduce((a, p) => a + p.pct, 0);
    const tidy = (phrase) => {
      const words = phrase.split(" ");
      const last = words.findIndex((w, i) => fiberWords.some((f) => words.slice(0, i + 1).join(" ").endsWith(f)));
      return words.slice(0, last >= 0 ? last + 1 : 2).join(" ");
    };
    const label = parts.map((p) => `${p.pct}% ${tidy(p.phrase)}`).join(", ");
    return { pct: Math.round((nat / sum) * 100), label };
  }
  if (percentOnly) return null;
  const hasSynthetic = SYNTHETIC.some((s) => t.includes(s));
  if (hasSynthetic) return null;
  const naturals = rules.naturalFibers.filter((f) => new RegExp(`\\b${f}\\b`).test(t));
  if (naturals.length) return { pct: 100, label: `${naturals.slice(0, 2).join(" + ")} (per description)` };
  if (allNatural) return { pct: 100, label: "natural fiber (brand is all-natural)" };
  return null;
}

function minDiscount(rules, kind) {
  return rules.minDiscountPctByKind?.[kind] ?? rules.minDiscountPct;
}

function classify(text) {
  const t = String(text).toLowerCase();
  for (const [kind, re] of KINDS) if (re.test(t)) return kind;
  return null;
}

function sizeMatches(value, wanted) {
  if (!wanted?.length) return true;
  const v = String(value).toUpperCase().replace(/\s+/g, " ").trim();
  const set = new Set(wanted.map((w) => w.toUpperCase()));
  if (set.has(v) || set.has(v.replace(/\s/g, ""))) return true;
  return v.split(/[\/,()\s]+/).some((tok) => set.has(tok));
}

function isWomens(p, rules) {
  const hay = ` ${p.title} ${p.product_type || ""} `.toLowerCase();
  if (/\bmen'?s?\b/.test(hay) || rules.skipWordsInTitle.some((w) => hay.includes(w))) return false;
  const tags = (Array.isArray(p.tags) ? p.tags : String(p.tags || "").split(",")).map((x) => x.trim().toLowerCase());
  const mens = tags.some((x) => /(^|[^a-z])(men|mens|men's|male)([^a-z]|$)/.test(x));
  const womens = tags.some((x) => /women|female|ladies/.test(x));
  return !(mens && !womens);
}

/** One Shopify product -> best qualifying sale variant, or null. */
export function shopifyCandidate(p, store, rules, person) {
  if (!isWomens(p, rules)) return null;
  const kind = classify(`${p.title} ${p.product_type || ""}`);
  if (!kind) return null;
  const options = (p.options || []).map((o) => String(o.name || o).toLowerCase());
  const sizeIdx = options.findIndex((o) => /size|größe|grösse|taille|talla/.test(o));
  const colorIdx = options.findIndex((o) => /colou?r|farbe|couleur/.test(o));
  const wanted = person.sizes[kind] || person.sizes.top;
  const avoid = rules.avoidWordsInColor;

  let best = null;
  for (const v of p.variants || []) {
    const price = Number(v.price);
    const was = Number(v.compare_at_price);
    if (!price || !was || was <= price || v.available === false) continue;
    const pct = Math.round((1 - price / was) * 100);
    if (pct < minDiscount(rules, kind) || was < rules.minOriginalPrice) continue;
    const size = sizeIdx >= 0 ? v[`option${sizeIdx + 1}`] : "One size";
    if (sizeIdx >= 0 && !sizeMatches(size, wanted)) continue;
    const color = colorIdx >= 0 ? v[`option${colorIdx + 1}`] : "";
    const colorHay = `${color} ${colorIdx >= 0 ? "" : p.title}`.toLowerCase();
    if (avoid.some((w) => colorHay.includes(w))) continue;
    if (!best || pct > best.pct) best = { price, was, pct, size, color, variantId: v.id };
  }
  if (!best) return null;

  const text = stripHtml(p.body_html || "");
  const tagText = Array.isArray(p.tags) ? p.tags.join(" ") : String(p.tags || "");
  const fiber = fiberInfo(`${text} ${tagText}`, rules, { allNatural: store.allNatural });
  const sizesOnSale = [
    ...new Set(
      (p.variants || [])
        .filter((v) => v.available !== false && Number(v.compare_at_price) > Number(v.price))
        .filter((v) => colorIdx < 0 || v[`option${colorIdx + 1}`] === best.color)
        .map((v) => (sizeIdx >= 0 ? v[`option${sizeIdx + 1}`] : "One size"))
    ),
  ];
  const image = (p.images?.[0]?.src || p.image?.src || "").replace(/^\/\//, "https://");
  const url = `https://${store.domain}/products/${p.handle}${best.variantId ? `?variant=${best.variantId}` : ""}`;
  return {
    source: "shopify",
    retailer: store.name,
    brand: p.vendor || store.name,
    title: p.title,
    kind,
    url,
    key: canonicalUrl(url),
    image,
    price: best.price,
    was: best.was,
    pct: best.pct,
    size: best.size,
    sizesOnSale,
    color: best.color,
    fiber: fiber?.label || null,
    naturalPct: fiber?.pct ?? null,
    description: text.slice(0, 500),
    finalSale: /final[\s_-]?sale/i.test(`${tagText} ${p.title} ${text}`),
    verified: true,
    domain: store.domain,
    handle: p.handle,
  };
}

async function scanShopify(store, rules, person) {
  const found = [];
  for (let page = 1; page <= (store.maxPages || 4); page++) {
    const data = await getJson(`https://${store.domain}/products.json?limit=250&page=${page}`);
    const products = data?.products || [];
    if (!data) log(`  ${store.name}: feed unavailable`);
    for (const p of products) {
      const c = shopifyCandidate(p, store, rules, person);
      if (c) found.push(c);
    }
    if (products.length < 250) break;
    await sleep(2500);
  }
  return found;
}

/** Fill in composition from the product page when the feed description doesn't say. */
async function enrichFiber(c, rules) {
  if (c.naturalPct != null) return c;
  try {
    const res = await fetchWithRetry(c.url);
    if (!res.ok) return c;
    const f = fiberInfo(stripHtml(await res.text()), rules, { percentOnly: true });
    if (f) Object.assign(c, { fiber: f.label, naturalPct: f.pct });
  } catch {
    /* leave unknown */
  }
  return c;
}

// ---------- OpenAI (Responses API) ----------

/** Background mode + polling: web searches can outlast Node fetch's 5-minute header timeout. */
async function openai(body) {
  const headers = { Authorization: `Bearer ${API_KEY}`, "Content-Type": "application/json" };
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers,
    body: JSON.stringify({ ...body, background: true }),
    signal: AbortSignal.timeout(60000),
  });
  let data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${JSON.stringify(data.error || data).slice(0, 400)}`);
  const deadline = Date.now() + 15 * 60000;
  while (data.status === "queued" || data.status === "in_progress") {
    if (Date.now() > deadline) throw new Error("OpenAI response timed out after 15 minutes");
    await sleep(5000);
    const poll = await fetch(`https://api.openai.com/v1/responses/${data.id}`, { headers, signal: AbortSignal.timeout(60000) });
    if (!poll.ok) continue;
    data = await poll.json();
  }
  if (data.status !== "completed") throw new Error(`OpenAI ${data.status}: ${JSON.stringify(data.error || data.incomplete_details || "").slice(0, 300)}`);
  for (const item of data.output || []) {
    if (item.type !== "message") continue;
    for (const part of item.content || []) if (part.type === "output_text") return part.text;
  }
  throw new Error("OpenAI returned no text");
}

function season(d = new Date()) {
  const m = d.getMonth() + 1;
  const order = ["winter", "spring", "summer", "fall"];
  const now = m <= 2 || m === 12 ? "winter" : m <= 5 ? "spring" : m <= 8 ? "summer" : "fall";
  return { now, next: order[(order.indexOf(now) + 1) % 4] };
}

function closetBrief(person, catalogue, rules) {
  const { now, next } = season();
  const items = catalogue?.items || [];
  const strong = items
    .filter((i) => i.rating >= 4)
    .map((i) => `${i.id} ${i.name} (${i.slot}, ${i.rating}★)`);
  const weak = items
    .filter((i) => i.rating >= 1 && i.rating <= 2 && i.slot !== "undershirt")
    .map((i) => `${i.id} ${i.name} (${i.rating}★): ${i.rating_reason || ""}`.slice(0, 220));
  return [
    `PERSON: ${person.name}. Color season: ${person.colorSeason}.`,
    `COLORS SHE WEARS: ${person.palette.love.join(", ")}.`,
    `COLORS TO AVOID: ${person.palette.avoid.join(", ")}.`,
    `BODY AND FIT: ${person.body}`,
    `LIFE: ${person.life}`,
    `SIZES: ${person.sizeNotes}`,
    person.shoes ? `SHOES: ${person.shoes}` : "",
    `SEASON: it is ${now} now; ${next} is next. Prefer pieces she can wear now or next season.`,
    `WISHLIST (real gaps, in priority order):\n- ${person.wishlist.join("\n- ")}`,
    weak.length ? `WEAK PIECES SHE WOULD LOVE TO REPLACE (a better version of the same job counts):\n- ${weak.join("\n- ")}` : "",
    strong.length ? `ALREADY OWNS AND LOVES (do not suggest near-duplicates; good pairing partners):\n- ${strong.join("\n- ")}` : "",
    `NON-NEGOTIABLES: at least ${rules.minDiscountPct}% off the original price (shoes: at least ${minDiscount(rules, "shoes")}%); at least ${rules.minNaturalPct}% natural fiber (${rules.naturalFibers.slice(0, 12).join(", ")}…); good-quality construction that lasts years; original price at least ${money(rules.minOriginalPrice)}.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

const SEARCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["deals"],
  properties: {
    deals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "brand", "retailer", "url", "image_url", "price", "original_price", "fiber", "color", "sizes_available", "kind", "final_sale"],
        properties: {
          title: { type: "string" },
          brand: { type: "string" },
          retailer: { type: "string" },
          url: { type: "string" },
          image_url: { type: ["string", "null"] },
          price: { type: "number" },
          original_price: { type: "number" },
          fiber: { type: "string" },
          color: { type: "string" },
          sizes_available: { type: "array", items: { type: "string" } },
          kind: { type: "string", enum: ["top", "bottom", "dress", "outerwear", "shoes"] },
          final_sale: { type: "boolean" },
        },
      },
    },
  },
};

async function searchWeb(person, brief, cfg) {
  const ws = cfg.webSearch;
  const prompt = `You are a ruthless personal shopper. Search the web right now for women's clothing and shoes on deep clearance for the person below.

${brief}

WHERE TO LOOK: brand and retailer sale, clearance, final-sale, outlet, and archive sections (for example ${ws.retailers.join(", ")}). New-with-tags resale counts if the discount is measured against the brand's original retail price.

RULES:
- Return only direct product pages you actually opened and saw today, with a current sale price at least ${cfg.rules.minDiscountPct}% below the original price shown on the page (shoes: at least ${minDiscount(cfg.rules, "shoes")}%).
- Her size must be in stock.
- Natural fiber composition must be stated on the page. Skip polyester, acrylic, nylon, viscose/rayon-dominant pieces.
- Skip anything that fights her colors or her fit rules, and anything cheap or fast-fashion quality.
- Never invent or guess a URL, price, or image. If unsure, leave it out.
- Up to ${ws.maxResults} results. An empty list is a fine answer.`;

  const body = {
    model: MODEL,
    reasoning: { effort: "medium" },
    tools: [{ type: "web_search" }],
    input: prompt,
    text: { format: { type: "json_schema", name: "deal_search", schema: SEARCH_SCHEMA, strict: true } },
  };
  let text;
  try {
    text = await openai(body);
  } catch (err) {
    if (!/web_search/.test(err.message)) throw err;
    text = await openai({ ...body, tools: [{ type: "web_search_preview" }] });
  }
  return JSON.parse(text).deals || [];
}

/** Confirm a search result is live and priced as claimed. Shopify pages get exact numbers. */
async function verifyWebDeal(d, cfg, person) {
  const rules = cfg.rules;
  const shop = d.url.match(/^(https?:\/\/[^/]+)\/(?:[a-z-]+\/)?(?:collections\/[^/]+\/)?products\/([^/?#]+)/i);
  if (shop) {
    const data = await getJson(`${shop[1]}/products/${shop[2]}.json`);
    if (data?.product) {
      const host = new URL(shop[1]).host;
      const c = shopifyCandidate(data.product, { name: d.retailer, domain: host }, rules, person);
      if (!c) return null;
      return { ...c, source: "web", fiber: c.fiber || d.fiber, naturalPct: c.naturalPct ?? null };
    }
  }

  const pct = Math.round((1 - d.price / d.original_price) * 100);
  if (!(pct >= minDiscount(rules, d.kind)) || d.original_price < rules.minOriginalPrice) return null;
  const fiber = fiberInfo(d.fiber, rules);
  const base = {
    source: "web",
    retailer: d.retailer,
    brand: d.brand,
    title: d.title,
    kind: d.kind,
    url: d.url,
    key: canonicalUrl(d.url),
    image: d.image_url || "",
    price: d.price,
    was: d.original_price,
    pct,
    size: d.sizes_available.join(", "),
    sizesOnSale: d.sizes_available,
    color: d.color,
    fiber: fiber?.label || d.fiber,
    naturalPct: fiber?.pct ?? null,
    description: "",
    finalSale: d.final_sale,
    verified: false,
  };

  let res;
  try {
    res = await fetchWithRetry(d.url, {}, 2);
  } catch {
    return base;
  }
  if (res.status === 404 || res.status === 410) return null;
  if (!res.ok) return base; // bot-blocked (403/503): keep, flagged as not double-checked
  const html = await res.text();
  const priceStrs = [d.price.toFixed(2), String(Math.round(d.price)), d.price.toFixed(2).replace(/\.00$/, "")];
  const pricedRight = priceStrs.some((p) => html.includes(`$${p}`) || html.includes(`"${p}"`) || html.includes(`"price":${p}`));
  if (!pricedRight) {
    log(`  dropped (price not on page): ${d.title} ${d.url}`);
    return null;
  }
  const og = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1];
  const page = fiberInfo(stripHtml(html), rules, { percentOnly: true });
  return {
    ...base,
    image: base.image || og || "",
    fiber: page?.label || base.fiber,
    naturalPct: page?.pct ?? base.naturalPct,
    verified: true,
  };
}

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["picks"],
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "score", "verdict", "job", "size_to_buy", "why", "pairs_with"],
        properties: {
          id: { type: "integer" },
          score: { type: "integer", minimum: 0, maximum: 10 },
          verdict: { type: "string", enum: ["buy", "skip"] },
          job: { type: "string" },
          size_to_buy: { type: "string" },
          why: { type: "string" },
          pairs_with: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

async function judge(candidates, brief, person, withImages = true) {
  const intro = `You are Alison, ${person.name}'s style coach (outfit formulas, capsule wardrobe, Soft Autumn, homestead mom). Judge each sale item below for her. Be ruthless: she only wants the RIGHT great deals, not just cheap ones.

${brief}

SCORING (0-10): 8+ only if ALL are true: (1) the color is clearly in her palette (look at the photo, not just the color name); (2) the cut follows her fit rules for her body today; (3) it is good quality and natural fiber; (4) it does a real job: fills a wishlist gap or is a clearly better version of a weak piece; (5) it is not a near-duplicate of something she already owns and loves; (6) it survives homestead life, and tops/dresses work for nursing; (7) shoes follow her SHOES rules (a heeled or narrow-toe shoe is a skip no matter the price). Anything else is "skip".

For each item return: job = which wishlist gap it fills or which weak piece (by name) it replaces; size_to_buy = the size from the available sizes that fits her, with any caveat; why = one or two warm, specific sentences in Alison's voice about why it works on her; pairs_with = 2-3 pieces she already owns (names from the loves list).`;

  const content = [{ type: "input_text", text: intro }];
  candidates.forEach((c, id) => {
    content.push({
      type: "input_text",
      text: `ITEM ${id}: ${c.brand} "${c.title}" (${c.kind}) at ${c.retailer}. ${money(c.price)}, was ${money(c.was)} (${c.pct}% off). Color: ${c.color || "see photo"}. Fiber: ${c.fiber || "unknown"}. Sizes on sale: ${(c.sizesOnSale || []).join(", ") || c.size}.${c.finalSale ? " FINAL SALE (no returns), so the fit must be a safe bet." : ""} ${c.description}`,
    });
    if (withImages && c.image) content.push({ type: "input_image", image_url: c.image, detail: "low" });
  });

  const body = {
    model: MODEL,
    reasoning: { effort: "medium" },
    input: [{ role: "user", content }],
    text: { format: { type: "json_schema", name: "deal_judgement", schema: JUDGE_SCHEMA, strict: true } },
  };
  try {
    return JSON.parse(await openai(body)).picks || [];
  } catch (err) {
    if (!withImages) throw err;
    log(`  judge with photos failed (${err.message.slice(0, 120)}); retrying without photos`);
    return judge(candidates, brief, person, false);
  }
}

const FIBER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["found", "label", "natural_pct"],
  properties: {
    found: { type: "boolean" },
    label: { type: "string" },
    natural_pct: { type: "integer", minimum: 0, maximum: 100 },
  },
};

/** Last resort for listings whose feed and page text don't state the material plainly. */
async function lookupFiber(c, rules) {
  const text = await openai({
    model: MODEL,
    reasoning: { effort: "low" },
    tools: [{ type: "web_search" }],
    input: `Open ${c.url} ("${c.brand} ${c.title}", color ${c.color || "any"}) and find its material composition as stated by the brand. For shoes, judge the upper (outer material); ignore sole and lining. Natural means: ${rules.naturalFibers.join(", ")}. Report found=false if the page doesn't say. natural_pct = percent of the main fabric (or upper) that is natural. label = short English composition, e.g. "smooth cowhide leather upper" or "55% linen, 45% cotton".`,
    text: { format: { type: "json_schema", name: "fiber", schema: FIBER_SCHEMA, strict: true } },
  });
  const f = JSON.parse(text);
  if (f.found) Object.assign(c, { fiber: `${f.label} (looked up)`, naturalPct: f.natural_pct });
  return c;
}

// ---------- memory + Slack ----------

async function loadSeen() {
  if (!SITE || !SECRET) return {};
  const res = await fetch(`${SITE}/.netlify/functions/deals-log`, { headers: { "x-job-secret": SECRET } });
  if (!res.ok) throw new Error(`deals-log ${res.status}`);
  return (await res.json()).seen || {};
}

async function recordPosted(deals) {
  if (!SITE || !SECRET) return;
  await fetch(`${SITE}/.netlify/functions/deals-log`, {
    method: "POST",
    headers: { "x-job-secret": SECRET, "Content-Type": "application/json" },
    body: JSON.stringify({
      deals: deals.map((d) => ({ key: d.key, price: d.price, was: d.was, pct: d.pct, title: d.title, brand: d.brand, url: d.url, image: d.image, person: d.person, job: d.job })),
    }),
  });
}

function wasSeen(c, seen, rules) {
  const s = seen[c.key];
  if (!s) return false;
  const ageDays = (Date.now() - new Date(s.date).getTime()) / 86400000;
  const cheaperNow = s.price && c.price <= s.price * 0.85;
  return ageDays < rules.repostAfterDays && !cheaperNow;
}

function slackBlocks(person, deals) {
  const hello = person.slackUserId ? `<@${person.slackUserId}> ` : "";
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${hello}*Deal find${deals.length > 1 ? "s" : ""}* · ${deals.length} piece${deals.length > 1 ? "s" : ""} worth your money. ${Math.min(...deals.map((d) => d.pct))}%+ off, natural fiber, your colors, your fit.`,
      },
    },
    { type: "divider" },
  ];
  for (const d of deals) {
    const lines = [
      `*<${d.url}|${d.brand}: ${d.title}>*`,
      `*${money(d.price)}* ~${money(d.was)}~ · *${d.pct}% off* at ${d.retailer}`,
      [d.color, d.fiber].filter(Boolean).join(" · "),
      `*Job:* ${d.job}`,
      `*Size:* ${d.sizeToBuy}`,
      d.why,
      d.pairsWith?.length ? `_Pairs with:_ ${d.pairsWith.join(", ")}` : "",
      d.finalSale ? "_Final sale, no returns: check the size chart first._" : "",
      d.verified ? "" : "_Price came from Alison's search; the store blocked a double-check._",
    ].filter(Boolean);
    const section = { type: "section", text: { type: "mrkdwn", text: lines.join("\n").slice(0, 2900) } };
    if (/^https:\/\//.test(d.image)) section.accessory = { type: "image", image_url: d.image, alt_text: d.title.slice(0, 100) };
    blocks.push(section, { type: "divider" });
  }
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "Clearance sizes vanish fast. Only buy it if it has a job in the capsule." }],
  });
  return blocks;
}

async function postToSlack(person, deals) {
  const text = `Alison found ${deals.length} deal${deals.length > 1 ? "s" : ""}: ${deals.map((d) => `${d.title} ${d.pct}% off`).join("; ")}`;
  const payload = {
    channel: SLACK_CHANNEL || person.slackChannel,
    text,
    blocks: slackBlocks(person, deals),
    unfurl_links: false,
    unfurl_media: false,
  };
  let res = await slackCall(payload);
  if (!res.ok && /invalid_blocks|downloading image/.test(res.error || "")) {
    payload.blocks = payload.blocks.map(({ accessory, ...b }) => b);
    res = await slackCall(payload);
  }
  if (!res.ok) throw new Error(`Slack chat.postMessage failed: ${res.error}`);
}

async function slackCall(payload) {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: { Authorization: `Bearer ${SLACK_TOKEN}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

// ---------- main ----------

async function huntFor(person, cfg, catalogue, seen) {
  const rules = cfg.rules;
  const brief = closetBrief(person, person.usesCatalogue ? catalogue : null, rules);
  let pool = [];

  if (!ARGS.has("--no-shopify")) {
    const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).toLowerCase();
    for (const store of cfg.shopifyStores.filter((s) => !only || s.name.toLowerCase() === only)) {
      try {
        const found = await scanShopify(store, rules, person);
        log(`  ${store.name}: ${found.length} on deep sale in size/color`);
        pool.push(...found);
      } catch (err) {
        log(`  ${store.name}: ${err.message}`);
      }
      await sleep(3000);
    }
    for (const c of pool.filter((c) => c.naturalPct == null).slice(0, 30)) {
      await enrichFiber(c, rules);
      await sleep(1500);
    }
  }

  if (cfg.webSearch?.enabled && API_KEY && !ARGS.has("--no-web")) {
    try {
      const raw = await searchWeb(person, brief, cfg);
      log(`  web search: ${raw.length} leads`);
      for (const d of raw) {
        const c = await verifyWebDeal(d, cfg, person).catch(() => null);
        if (c) pool.push(c);
      }
    } catch (err) {
      log(`  web search failed: ${err.message}`);
    }
  }

  if (API_KEY) {
    const unknown = pool.filter((c) => c.naturalPct == null && !wasSeen(c, seen, rules)).slice(0, 8);
    for (const c of unknown) await lookupFiber(c, rules).catch((err) => log(`  fiber lookup failed: ${err.message.slice(0, 120)}`));
  }

  const byKey = new Map();
  for (const c of pool) {
    if (c.naturalPct == null || c.naturalPct < rules.minNaturalPct) continue;
    if (wasSeen(c, seen, rules)) continue;
    if (!byKey.has(c.key) || byKey.get(c.key).pct < c.pct) byKey.set(c.key, c);
  }
  const candidates = [...byKey.values()].sort((a, b) => b.pct - a.pct).slice(0, 30);
  log(`  ${pool.length} found, ${candidates.length} pass the hard rules and are new`);
  if (!candidates.length) return [];

  if (!API_KEY) {
    log("  (no OPENAI_API_KEY: showing rule-passing candidates without Alison's judgement)");
    for (const c of candidates.slice(0, 15)) log(`   - ${c.pct}% ${money(c.price)}/${money(c.was)} ${c.brand}: ${c.title} [${c.color}] ${c.size} · ${c.fiber} · ${c.url}`);
    return [];
  }

  const picks = await judge(candidates, brief, person);
  for (const p of picks) {
    const c = candidates[p.id];
    if (c && !(p.verdict === "buy" && p.score >= rules.minJudgeScore)) log(`   skip ${p.score}/10 ${c.pct}% ${c.brand}: ${c.title} — ${p.why}`);
  }
  return picks
    .filter((p) => p.verdict === "buy" && p.score >= rules.minJudgeScore && candidates[p.id])
    .sort((a, b) => b.score - a.score || candidates[b.id].pct - candidates[a.id].pct)
    .slice(0, rules.maxDealsPerPost)
    .map((p) => ({ ...candidates[p.id], person: person.id, score: p.score, job: p.job, sizeToBuy: p.size_to_buy, why: p.why, pairsWith: p.pairs_with }));
}

async function main() {
  const cfg = JSON.parse(await readFile(new URL("data/deal-hunter.json", ROOT), "utf8"));
  const catalogue = JSON.parse(await readFile(new URL("data/catalogue.json", ROOT), "utf8"));
  if (!DRY && !SLACK_TOKEN) throw new Error("Need SLACK_BOT_TOKEN (Alison's bot token) or use --dry-run");
  const seen = await loadSeen().catch((err) => {
    log(`Memory unavailable (${err.message}); continuing without dedupe`);
    return {};
  });

  for (const person of cfg.people) {
    log(`Hunting for ${person.name}…`);
    const deals = await huntFor(person, cfg, catalogue, seen);
    if (!deals.length) {
      log(`  nothing worth sending ${person.name} today`);
      continue;
    }
    for (const d of deals) log(`  ✓ ${d.score}/10 ${d.pct}% ${d.brand}: ${d.title} — ${d.job}`);
    if (DRY) continue;
    if (!SLACK_CHANNEL && !person.slackChannel) {
      log(`  no slackChannel for ${person.name}; not posting`);
      continue;
    }
    await postToSlack(person, deals);
    await recordPosted(deals);
    log(`  posted ${deals.length} to Slack`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
