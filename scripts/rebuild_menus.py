#!/usr/bin/env python3
"""Add new pieces, extend seasons, rebuild all 21-day menus, validate."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from outfits import FALL, SPRING, SUMMER, WINTER

ROOT = Path(__file__).resolve().parents[1]
CAT = ROOT / "data" / "catalogue.json"
MENUS = ROOT / "data" / "menus.json"

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
THEMES = ["Practical", "Cozy", "Feminine", "Playful", "Polished", "Practical", "Feminine"]
WEEK_NAMES = ["Soft & Rooted", "Homestead Easy", "Feminine Everyday"]
REPEATABLE = {"outerwear", "shoes"}
KNITS = {
    "IMG_0100", "IMG_0110", "IMG_0151", "IMG_0152", "IMG_0099",
    "IMG_0150", "IMG_0142", "IMG_0153", "IMG_0157", "IMG_0172", "IMG_0098",
}

NEW_ITEMS = [
    {
        "id": "NEW_BELT",
        "name": "Thin brown belt",
        "category": "accessory",
        "subcategory": "belt",
        "colors": ["brown", "cognac", "tan"],
        "pattern": "solid",
        "description": "Thin brown/cognac belt purchased Aug 2026. Marks the high waist on jeans, olive pants, and boxy knits.",
        "rating": 4,
        "rating_reason": "The missing waist tool. Soft Autumn brown; use on high-rise bottoms and t-shirt dresses. Photo 8/31: she already tucks — this finishes it.",
        "seasons": ["spring", "summer", "fall", "winter"],
        "themes": ["practical", "polished", "feminine", "cozy"],
        "soft_autumn_fit": "excellent",
        "image": "images/thumbs/NEW_BELT.svg",
        "image_full": "images/source/NEW_BELT.svg",
        "in_capsule": True,
        "is_staple": True,
        "slot": "accessory",
        "character": "Neutral",
        "user_added": True,
        "source": "purchased",
    },
    {
        "id": "NEW_FLANNEL",
        "name": "Rust and black flannel",
        "category": "top",
        "subcategory": "flannel shirt",
        "colors": ["rust", "black"],
        "pattern": "plaid",
        "description": "Rust/black flannel purchased Aug 2026. Wear open as a topper over a tee or tank — not buttoned into a box, not over a sweater.",
        "rating": 3,
        "rating_reason": "Rust is Soft Autumn; black in the plaid is a ding. Open it for a vertical line on a broader-shoulder, high-waist frame. Print slot.",
        "seasons": ["spring", "fall", "winter"],
        "themes": ["practical", "cozy", "playful"],
        "soft_autumn_fit": "fair",
        "image": "images/thumbs/NEW_FLANNEL.svg",
        "image_full": "images/source/NEW_FLANNEL.svg",
        "in_capsule": True,
        "is_staple": False,
        "slot": "topper",
        "character": "Print",
        "user_added": True,
        "source": "purchased",
    },
]

# Extra season tags so winter/summer can actually make 21 outfits
SEASON_ADDS = {
    "IMG_0100": ["winter"],
    "IMG_0110": ["winter"],
    "IMG_0151": ["winter"],
    "IMG_0152": ["winter"],
    "IMG_0099": ["winter"],
    "IMG_0150": ["winter"],
    "IMG_0142": ["winter"],
    "IMG_0159": ["winter"],
    "IMG_0101": ["summer"],
    "IMG_0088": ["summer"],
    "IMG_0149": ["summer"],
    "IMG_0155": ["summer"],
    "IMG_0147": ["summer"],
}


def pack(season_label, focus_list, days_outfits):
    menus = []
    for w in range(3):
        chunk = days_outfits[w * 7:(w + 1) * 7]
        days = {}
        for i, day in enumerate(DAYS):
            entry = dict(chunk[i])
            entry["theme"] = THEMES[i]
            days[day] = entry
        menus.append({
            "id": f"week{w+1}",
            "name": WEEK_NAMES[w],
            "rotation_index": w,
            "focus": focus_list[w],
            "days": days,
        })
    return menus


def base_ids(pieces, by_id):
    out = []
    for pid in pieces:
        slot = by_id[pid]["slot"]
        if slot not in REPEATABLE:
            out.append(pid)
    return out


def validate(name, outfits, by_id):
    issues = []
    bases = []
    for idx, entry in enumerate(outfits):
        for pid in entry["pieces"]:
            if pid not in by_id:
                issues.append(f"d{idx} missing {pid}")
        slots = [by_id[p]["slot"] for p in entry["pieces"]]
        if not any(s in ("bottom", "both") for s in slots):
            issues.append(f"d{idx} no cover: {entry['outfit'][:60]}")
        if "shoes" not in slots:
            issues.append(f"d{idx} no shoes")
        knits = [p for p in entry["pieces"] if p in KNITS]
        dresses = [p for p in entry["pieces"] if by_id[p]["slot"] == "both" and by_id[p].get("category") == "dress"]
        if knits and dresses:
            issues.append(f"d{idx} sweater+dress")
        if "IMG_0147" in entry["pieces"] and knits:
            issues.append(f"d{idx} cardi+sweater")
        chars = [by_id[p]["character"] for p in entry["pieces"] if by_id[p]["slot"] not in REPEATABLE]
        if chars.count("Print") > 1:
            issues.append(f"d{idx} 2 prints")
        if chars.count("Print") and chars.count("Color") and THEMES[idx % 7] != "Playful":
            issues.append(f"d{idx} print+color off Thu")
        bases.append(frozenset(base_ids(entry["pieces"], by_id)))
    if len(set(bases)) != 21:
        # show dupes
        seen = {}
        for i, b in enumerate(bases):
            seen.setdefault(b, []).append(i)
        dups = {tuple(v) for v in seen.values() if len(v) > 1}
        issues.append(f"unique bases {len(set(bases))}/21 dups={dups}")
    last = {}
    for idx, entry in enumerate(outfits):
        for pid in base_ids(entry["pieces"], by_id):
            if pid in last and (idx - last[pid]) < 3:
                issues.append(f"d{idx} {pid} {by_id[pid]['name']} only {idx-last[pid]}d after d{last[pid]}")
            last[pid] = idx
    # wrap
    for pid, first_last in list(last.items()):
        wears = [i for i, e in enumerate(outfits) if pid in base_ids(e["pieces"], by_id)]
        if len(wears) >= 2:
            gap = (wears[0] + 21) - wears[-1]
            if gap < 3:
                issues.append(f"wrap {pid} {by_id[pid]['name']} gap {gap} (d{wears[-1]}→d{wears[0]})")
        elif len(wears) == 1:
            pass
    return issues


def main():
    cat = json.loads(CAT.read_text())
    existing = {i["id"] for i in cat["items"]}
    for item in NEW_ITEMS:
        if item["id"] in existing:
            cat["items"] = [i for i in cat["items"] if i["id"] != item["id"]]
        cat["items"].append(item)
    for tid, extras in SEASON_ADDS.items():
        for i in cat["items"]:
            if i["id"] == tid:
                seas = list(i.get("seasons") or [])
                for s in extras:
                    if s not in seas:
                        seas.append(s)
                i["seasons"] = seas
    by_id = {i["id"]: i for i in cat["items"]}
    cat["stats"]["total"] = len(cat["items"])
    cat["stats"]["by_rating"] = {}
    for i in cat["items"]:
        cat["stats"]["by_rating"][str(i["rating"])] = cat["stats"]["by_rating"].get(str(i["rating"]), 0) + 1
    cat["stats"]["by_season"] = {
        s: sum(1 for i in cat["items"] if i["rating"] > 0 and s in (i.get("seasons") or []))
        for s in ("spring", "summer", "fall", "winter")
    }
    cat["profile"]["body_type"] = "high-waist rectangle / full bust (photo 8/31/26); belt and tuck; skip extra shoulder volume"
    cat["profile"]["formula_slots"] = [
        "top", "bottom", "both", "undershirt", "topper", "outerwear", "shoes", "accessory"
    ]

    menus = json.loads(MENUS.read_text())
    menus["rotation_note"] = (
        "21 unique outfits per season. Base items (top / bottom / both / topper / accessory) "
        "need 3 days before reuse (Saturday → Tuesday). Outerwear and shoes may repeat. "
        "No sweater-over-dress. No cardigan-over-sweater. High waist + belt when the cut is boxy."
    )
    note = menus["rotation_note"]
    menus["seasons"]["spring"]["menus"] = pack(
        "spring",
        ["Olive, dusty rose, belt the waffle", "Dresses + open flannel", "V-necks and high-rise"],
        SPRING,
    )
    menus["seasons"]["summer"]["menus"] = pack(
        "summer",
        ["Shorts, tanks, belt the high waist", "Wraps and heat-friendly layers", "Overalls + tee-dress with belt"],
        SUMMER,
    )
    menus["seasons"]["fall"]["menus"] = pack(
        "fall",
        ["Mustard, rust, terracotta + belt", "Knits stand alone", "Flannel open, no knit-on-knit"],
        FALL,
    )
    menus["seasons"]["winter"]["menus"] = pack(
        "winter",
        ["Belt the boxy knits", "Velvet wrap + skirt days", "Open flannel over overalls"],
        WINTER,
    )
    for s in menus["seasons"].values():
        s["formula_note"] = note

    results = {
        "SPRING": validate("spring", SPRING, by_id),
        "SUMMER": validate("summer", SUMMER, by_id),
        "FALL": validate("fall", FALL, by_id),
        "WINTER": validate("winter", WINTER, by_id),
    }
    failed = False
    for k, v in results.items():
        print(k, v or "OK")
        if v:
            failed = True
    if failed:
        raise SystemExit("validation failed — not writing")
    CAT.write_text(json.dumps(cat, indent=2, ensure_ascii=False) + "\n")
    MENUS.write_text(json.dumps(menus, indent=2, ensure_ascii=False) + "\n")
    print("wrote catalogue + menus")


if __name__ == "__main__":
    main()
