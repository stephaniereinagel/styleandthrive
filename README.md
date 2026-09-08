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
| `netlify/functions/` | `daily-select`, `today`, `week`, `settings`, `image` |
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
| `OPENAI_API_KEY` | `gpt-image-1` try-on photos |
| `DAILY_JOB_SECRET` | Shared secret for scheduled `daily-select` + GitHub Action |

GitHub Action secrets (backup cron): `STYLE_THRIVE_URL`, `DAILY_JOB_SECRET`.

Reference photos and daily try-ons live in **Netlify Blobs** — never commit them to git.

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
