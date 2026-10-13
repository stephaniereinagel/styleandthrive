# Style & Thrive

Stephanie's clothing capsule app — Soft Autumn · pear · homestead mom of 5.

Inspired by the weekly-menu pattern of [Nourish & Flourish](https://nourishandflourish.netlify.app), adapted for outfits. Dusty rose / rust UI (not forest green) so it feels distinct.

**Season calendar:** each season starts on the **first Monday** of March, June, September, and December.

**Daily picks (live):** at **4am America/Chicago** a Netlify function reads local weather (Open-Meteo) + Google Calendar (secret iCal URL), picks an outfit from the current seasonal capsule, and generates an AI try-on photo. Tops / bottoms / toppers / dresses wait **2 days** and skip the **same weekday next week**. Outerwear and shoes may repeat. The 21-outfit menus in `data/menus.json` are the fallback until a pick exists.

## Quick start

From this folder:

```bash
npm install
python3 -m http.server 8766
```

Then open [http://localhost:8766/](http://localhost:8766/)

Local static server does **not** run Netlify functions. Deploy to Netlify (or `netlify dev`) for weather, calendar, Pick now, and try-on photos.

**Live:** [style-and-thrive.netlify.app](https://style-and-thrive.netlify.app/)

## What's here

| Path | Purpose |
|---|---|
| `data/catalogue.json` | Full piece catalogue with ratings, seasons, themes |
| `data/menus.json` | Three weekly outfit menus + day themes (fallback) |
| `catalogue.md` | Human-readable catalogue + gap analysis |
| `seasons/*-capsule.jpg` | Consolidated season boards |
| `images/source/` | Full-size JPEGs converted from HEIC |
| `images/thumbs/` | Thumbnails for the app |
| `app/` | Mirror of the mobile-style web app |
| `netlify/functions/` | `daily-select`, `today`, `week`, `settings`, `image`, `deals-log` |
| `data/deal-hunter.json` | Deal hunt settings: sizes, palette, wishlist, brands, thresholds |
| `scripts/deal-hunt.mjs` | Daily deal hunt (GitHub Actions → Slack) |
| `netlify/lib/` | Picker, weather, iCal, try-on, Blobs store |
| `.github/workflows/daily-outfit.yml` | Backup 4am cron via GitHub Actions |

## Settings (in the app)

1. Paste Google Calendar **secret iCal** URL
2. Confirm location (default Gravette, AR)
3. Upload 1–2 full-body **reference photos** for try-on
4. Optional household PIN (gates calendar events + photos)
5. Tap **Pick now** to test

## Netlify env vars

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | `gpt-image-2` try-on photos (falls back to 1.5 / 1) |
| `DAILY_JOB_SECRET` | Shared secret for scheduled `daily-select` + GitHub Action |

GitHub Action secrets (backup cron): `STYLE_THRIVE_URL`, `DAILY_JOB_SECRET`.

Reference photos and daily try-ons live in **Netlify Blobs** — never commit them to git. Try-on uses **gpt-image-2** (with hanger photos of the day's pieces). Because Netlify's edge times out around 30s, photo generation runs on **GitHub Actions** (`tryon-worker.yml`, every 5 minutes) via `tryon-pack` / `tryon-save`.

## Alison's deal hunt (Slack)

Once a day around midday CT, a GitHub Action (`.github/workflows/deal-hunt.yml` → `scripts/deal-hunt.mjs`) looks for **70%+ off, natural-fiber, good-quality** pieces in Stephanie's size and colors that fill a capsule gap or replace a weak (≤2★) piece. Alison posts at most 3 to the family Slack channel. On days when nothing qualifies, it posts nothing.

How it decides:

1. **Brand sale feeds.** It reads the public product feed of each Shopify brand in `data/deal-hunter.json` (Tradlands, Faherty, Nisolo, Christy Dawn…). Prices, discounts, and in-stock sizes are exact.
2. **Web search.** An OpenAI web search covers bigger retailers (J.Crew, Madewell, Boden, Eileen Fisher, Nordstrom Rack, new-with-tags resale…). Each link is re-opened to confirm it's live and the price is on the page.
3. **Hard rules in code.** At least 70% off, original price at least $60, at least 90% natural fiber, her size in stock, no black/grey/silver colorways, women's only, and not already sent in the last 45 days unless the price dropped 15% or more.
4. **Alison judges.** She looks at the photos against the closet brief (palette, body-today fit rules, wishlist, weak pieces, loved pieces) and only scores 8/10 or higher get posted, each with its job, the size to buy, and what it pairs with.

Change sizes, the wishlist, brands, or thresholds in `data/deal-hunter.json`. To add a family member later, add another entry to `people` (with `usesCatalogue: false` until they have a catalogue) and a `slackUserId` so the post tags them.

Test without posting: `node scripts/deal-hunt.mjs --dry-run` (add `--no-web` or `--only=Faherty`). Without `OPENAI_API_KEY` it lists the rule-passing finds and skips Alison's judging. On GitHub: **Actions → Alison's deal hunt → Run workflow** with `dry_run: true`.

GitHub Action secrets: `OPENAI_API_KEY`, `STYLE_THRIVE_URL`, `DAILY_JOB_SECRET` (same as try-on), plus `SLACK_BOT_TOKEN` (Lydia's `xoxb-` token) and `SLACK_DEALS_CHANNEL` (the Team Reinagel Chat channel ID, starts with `C`). Sent deals are remembered in Netlify Blobs via `/.netlify/functions/deals-log`. For the posts to say "Alison · Style & Thrive" instead of "Lydia," the Lydia app needs the `chat:write.customize` scope (already in `family-concierge/slack-manifest.yml`, reinstall the app once).

## Rating scale

- **0** — Get rid of it
- **1** — Wear only if necessary
- **2** — Meh filler
- **3** — Solid usable
- **4** — Strong staple
- **5** — Best overall / hero

## Profile inputs

- Color analysis: **Soft Autumn**
- Body type: **Pear**
- Lifestyle: NW Arkansas homestead, farm stand, five kids, church, weekday solo parenting

## Consult Alison

**Alison** is a digital twin of Alison Lumbatis for this project. Say her name in chat, or work in `wardrobe/` files.

- Playbook: [`wardrobe/alison/`](alison/README.md)
- Agent rule: `.cursor/rules/agent-style-confidence.mdc`

## Everyday-style experts (Aug 2026)

Asked for a fashion expert for *everyday people*: flattering, practical, minimal effort.

- **Best fit: Alison Lumbatis** — style-confidence teacher (not runway). Started helping moms out of the yoga-pants rut; now known for *outfit formulas*, the 333 mix-and-match method (3 tops / 3 bottoms / 3 shoes), and a small staple closet. Book + *Outfit Formulas* app. Closest match to Style & Thrive’s “weekly menu” idea. [alisonlumbatis.com](https://alisonlumbatis.com/)
- **Also useful: Allison Bornstein** — *Wear It Well* and the three-word method. More “personal style compass” than daily formulas; strong on postpartum/maternity when the body and life are in flux.
- **Also useful: Anuschka Rees** — *The Curated Closet*. Builds a wardrobe around *your* life, not trends. Less focused on “flattering rules.”
