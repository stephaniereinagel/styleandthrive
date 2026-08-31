# Alison — Methods

Public teaching synthesized from GYPO / Outfit Formulas interviews, blog, and book *structure* (not the book's text). Use these as operating rules. When Stephanie's life conflicts with a generic staple list, Stephanie's life wins.

## The big metaphor

**Meal planning for your closet.**

You already have ingredients. What's missing is the recipe. A weekly outfit menu is a meal plan: fewer decisions, more combinations, leftover pieces that actually get eaten (worn).

## 1. Closet first (always)

1. **Clean out.** You cannot know what you need until you know what you have. Most of us wear ~20% of the closet; the rest is decision fatigue on hangers.
2. **Keep what you actually wear, what still fits the body you have, and what matches this life** — not the fantasy job, not the old size, not "someday."
3. **Shop the closet** before any store. Check the list off with what you own.
4. **Fill gaps with a written list.** Walk into a store (or a tab) the way you should walk into a grocery store: not hungry, with a recipe.
5. **Nothing new earns a hanger unless it pairs 4–5 ways** with what you already own.

Gap-list questions: *Do I already own this job? Will it mix with my staples? Can I wash it? Will I still want it in 12 weeks? Does it fight Soft Autumn or my pear waist?*

## 2. The outfit formula

A formula is a **slot list**, not a shopping link.

```
[bottom or dress] + [top, if needed] + [optional topper] + [shoes] + [one add-on]
```

- Formulas are customizable for climate: sweatshirt → tee; jacket → vest; boots → sandals.
- You do not need the exact piece in a photo. You need the *job* of the piece (dark bottom, white/light top, solid topper, bright shoe…).
- Same formula can read preppy, boho, sporty, romantic, or edgy by swapping the *character* of each slot (navy cardigan vs. moto vs. hoodie vs. ruffle cardi vs. kimono).

### Filling the slots — neutrals, color, print

Every piece in `wardrobe/data/catalogue.json` is tagged with **`slot`** (top / bottom / both / undershirt / topper / outerwear / shoes / accessory) and **`character`** (Neutral / Print / Color). Read those fields; don't recategorize from memory.

**Weekly menus (locked Aug 31, 2026):** each season has **21 unique outfits**. A unique outfit is the set of *base* IDs — top, bottom, both, topper, accessory. Shoes and outerwear may repeat. **No base item within 3 days** (Saturday → not again until Tuesday). The 21-day loop wraps: week-3 Sunday still needs 3 days before week-1 Monday. Source of truth: `wardrobe/scripts/outfits.py` then `rebuild_menus.py`.

**Fit from her photo (Aug 31, 2026):** high-rise she already tucks, full bust, shoulders ≈ hips, long legs. Mark the waist (belt the boxy knit), skim the hip, draw the eye up (V-neck, open layer). Skip extra shoulder volume as the default (puff / off-shoulder). The wide-leg high-rise jeans in that photo are what she actually wears — don't fight them.

The skeleton stays the same. These three decide *what character* each slot gets.

- **Neutrals** are the pantry. Most of the outfit. They mix with everything so mornings stay easy.
- **Color** is flavor. One Soft Autumn story per outfit, not a rainbow.
- **Print** is the fun slot. Default is **one print**. Everything else stays solid.

**Stephanie's mixers (neutrals):** camel, oatmeal, cream, cognac, cocoa, olive, denim. Olive counts as a neutral *here* — dirt-hiding, pairs with almost her whole closet. Black is not a mixer for her.

**Stephanie's flavor (Soft Autumn):** dusty rose, terracotta, mustard/rust, muted florals, warm navy that's actually soft. Demote: true black, cool grey, tomato-true red, silver, high-contrast cool navy/white graphics.

**The count (so she can stop wondering):**

| | Default | Hard cap | Skip |
|---|---|---|---|
| **Prints** | 0 or 1 | 2 only if they share a color (extra credit) | 3 prints |
| **Flavor colors** | 0 or 1 family (repeat it freely) | 2 muted Soft Autumn solids, and only if they already live together in a print you own | 3 separate brights |
| **Neutrals** | The rest. Usually 2–4 pieces. | No max | An outfit with *zero* mixer |

That's the **1 + 1 + the rest** rule: one print *or* none, one color family *or* none, everything else a mixer.

- A floral dress counts as **one print**, not five colors. Then steal *one* flower color for a solid.
- Repeating camel (cardi + shoes) is one neutral, used twice. That's the sandwich, not "too much."
- Whole outfit can be 2–3 colors total if you count neutrals: olive + camel + dusty rose. That's plenty.
- Print **and** a loud color pop is two fun slots. Save that for Playful Thursday. Other days: pick one.

**How to pair without thinking:**

1. **All-neutral** is a finished outfit. Add a sandwich (top/topper matches shoes) or one add-on.
2. **One color + neutrals.** Dusty-rose tank + olive pants + camel cardi. Done.
3. **One print + solids pulled from the print.** Floral maxi? Repeat one flower color in the topper or shoe. Do not add a second competing print.
4. **Playful day only:** the print *or* a color pop is the one fun slot. Thursday, not every day.
5. **Leopard / muted animal** can act like a neutral if the rest is calm Soft Autumn solids.
6. **Print + print** is extra credit (start with two that share a color). Not Tuesday-with-four-kids.

**Stephanie's layering (hers, not a magazine's):**

- **Yes:** jacket (utility / moto) over a dress or a knit. Open cardi over a tee, tank, tunic, or dress.
- **No:** sweater or sweatshirt over a dress. Cardigan over a sweater, sweatshirt, or hoodie.
- A dress is finished with shoes + optional jacket or open cardi. Do not put a second knit on top.
- A sweater *is* the top. Pair it with pants, a skirt, or overalls — not with another knit.

Pear note: put the print or the brighter color **up** (top, necklace, earrings) so the eye goes up. One-and-done floral dress is the exception — the dress *is* the print, add a solid jacket.

**Stephanie's Style & Thrive themes are formulas with a mood:**

| Theme | Formula job |
|---|---|
| Practical | Sturdy bottom or chore-friendly dress + washable top + utility/jacket + shoes she can walk the property in |
| Cozy | Soft knit + easy bottom or dress + cardigan + soft shoe |
| Feminine | Waist or drape (wrap, smock, midi/maxi) + one pretty add-on (earring, belt, shoe) |
| Playful | One fun slot (print, color pop, overalls) + everything else calm |
| Polished | Clean lines + one structured topper (moto, utility, cardigan) + shoes that could do dinner |

## 3. Casual Outfit Builder Grid

How she gets dressed on ordinary days:

1. **Category 1 — Bottom** (or a dress that counts as 1+2)
2. **Category 2 — Top**
3. **Category 3 — Topper (optional)** — cardigan, denim jacket, moto, utility, vest, hoodie
4. **Category 4 — At least one finisher** — shoes always count; necklace, scarf, earrings, belt, bag

- Home day: 1 + 2 + one thing from 4 (usually shoes). That's *enough*.
- Out-of-the-house: add a topper and/or a necklace. Instantly "I meant this."
- She is adamant: **the outfit isn't finished until there are shoes on.** Even at home, if the day needs a brain.

**Fast finishers she teaches:**

- **Necklace formula** — top + bottom + long or statement necklace. Easiest "put together" trick.
- **Scarf as the starting point** — pull a print, build neutrals around it.
- **Leopard is a neutral** — a little print that plays with almost anything.
- **Bright shoe on an all-neutral outfit** — one pop, done.
- **Denim jacket or cardigan year-round** — she has stashed a cardi in her bag over shorts.

## 4. Sandwich method

A balanced outfit without thinking:

**Match the color of the top (or topper) to the shoes, and let the bottom (or middle) be the filling.**

Example: camel cardigan + olive pants + camel shoes. Or dusty-rose top + jeans + dusty-rose or blush shoe.

For Stephanie, sandwich with Soft Autumn "bread": camel, cognac, olive, dusty rose, terracotta, oatmeal — not black-and-white contrast.

## 5. 333 method (when the week is fried)

From the closet, pick **3 tops, 3 bottoms, 3 pairs of shoes**. Mix only those.

Purpose: train the eye to see combinations she already owns. Nine times out of ten, "I have nothing to wear" means "I haven't practiced pairing."

Use 333 for a laundry-crisis week, travel, or the first week of a new season capsule. Then return to the full weekly menu.

## 6. Capsule architecture

Her programs (publicly described):

- **Staples first** — classic mix-and-match pieces that work more than one season.
- **A few seasonal trends** — so it doesn't feel dead, not so it requires a new personality.
- **A shopping list** (~40-ish clothing/footwear staples in her Closet Staples builder, plus accessories) — *check off, don't copy*.
- **A season of daily formulas** (her app/email used to send a day's outfit; Style & Thrive does this as weekly rotating menus).
- **SAHM / work-from-home builders** — closest to homestead life: utility over office polish.
- **Work-wear and dress-it-up** capsules exist for church, dinner, events — a small "dress it up" layer, not a second entire closet.

Reuse pieces across seasons. That's the budget trick. One good camel cardigan should appear in spring, fall, and winter menus.

**Her staple *jobs* (adapt, don't import Dallas defaults):**

- Dark or dirt-hiding bottoms (jeans, olive or brown pants)
- One or two easy dresses that wash
- White or light tee / tank that she will actually wear
- Stripes *if she doesn't already own fifteen*
- Soft sweater or two
- Cardigan in a workhorse neutral
- Denim or utility jacket
- One "personality" jacket (moto)
- Washable everyday shoes + one nicer pair
- A belt that actually gets used
- One bag that can hold a life

Black is *her* frequent staple. It is **not** Stephanie's. Swap black → cocoa, olive, navy-that's-really-soft, cognac.

## 7. Personal style (three steps, no quiz spiral)

1. **Gather intel.** Save outfits she is drawn to without explaining why. Patterns will show.
2. **Look backward.** What did she feel like herself in — not what was trendy.
3. **Comfort + confidence.** If it isn't both, it isn't her style. Lifestyle vetoes fantasy (heels vs. pasture).

Style types she uses as *flavors*, not boxes: preppy, boho, sporty, romantic, edgy. Stephanie's existing week names — Soft & Rooted, Homestead Easy, Feminine Everyday — already *are* her three-word-adjacent style. Keep them.

## 8. Body shape — proportion, not punishment

Measure shoulders, bust, waist, hips if useful. Four broad shapes (names interchangeable):

| Shape | Clue | Aim |
|---|---|---|
| Triangle / pear | Hips wider than shoulders | Draw the eye up and to the waist. Waist-length toppers, defined or softly marked waist, bottoms that skim (straight, bootcut, A-line). Public Alison teaching often starts here. |
| Inverted triangle / apple | Shoulders or bust wider than hips | Soften the top; add interest near hips; longer toppers. |
| Rectangle / athletic | Similar measurements, less waist | Create a waist (tuck, belt, structured jacket). |
| Hourglass / curvy | Shoulders ≈ hips, defined waist | Keep the waist; don't box it out. |

Rules she repeats:

- It's about **proportion**.
- Sub-shapes are fine. Highlight what she *loves*.
- If she loves a piece that "breaks" a rule and she feels great — wear it.
- She spent years wishing she were a rectangle. Stephanie's 8/31/26 photo reads more **balanced / soft rectangle** (shoulders ≈ hips) with a full bust and a high waist she already tucks. Same job: mark the waist, skim the hip, eye goes up. Don't hang a "classic pear" label on her if the photo says otherwise.

**Homestead, postpartum edition (her body, not a quiz):**

- Yes: V-necks, waist-length jackets, the thin brown belt on boxy knits, A-line and tiered dresses, straight or clean wide-leg, wrap/smock/drawstring, moto that hits the waist, open layers.
- Careful: extra volume at the hip *and* at the shoulder (puff / off-shoulder as default), clingy sheaths, harsh black, anything that requires sucking in until dinner.
- Postpartum / "no waist today": flowy midis, wide-leg or pull-on, linen/cotton that moves, one dress that is a uniform. Do not default to shapeless sacks. Do not force the old skinny-waist silhouettes.

## 9. Color

She includes color analysis as a book extra and has partnered with color people — but she **encourages going rogue**. The capsule must follow *her* coordination rules, not a stranger's brights.

For Style & Thrive, **Soft Autumn is locked.** Olive, camel, cognac, dusty rose, terracotta, oatmeal, warm navy. Cool grey, true black/white graphics, tomato-true red, silver metallics — demote.

## 10. Master-class (only after the basics work)

Once formulas are easy: break them on purpose. Vintage + blazer. Print + print (start with two). Personality in the add-on, not in 12 new tops. This is extra credit, not Tuesday morning.

## 11. Pretty time

The origin habit: **schedule getting ready** the way you schedule lunch. Not a spa day. Shower, clothes, shoes. Ten minutes that say *I'm worth a finished outfit.* If the day is on fire, use the 333 or a one-and-done dress. Skipping "because no one sees me" is how the rut starts.

## Sources (public)

- alisonlumbatis.com — current letters; "I Stopped Dressing for the Body I Used to Have" (July 2026)
- getyourprettyon.com — About, Outfit Builder Grid, body shape, Style Challenges FAQ, One Formula / Five Styles, Closet Staples
- Interviews: Voyage Dallas; CanvasRebel (2022); Elizabeth Rider podcast
- Book *positioning* (Harvest House / outfitformulasbook.com): closet-full-nothing-to-wear, four seasons of ideas, shopping lists, color extra, packing list
- Social teaching: sandwich method; 333 method
