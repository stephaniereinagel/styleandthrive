#!/usr/bin/env python3
"""Add formula slot + character to every catalogue piece."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAT = ROOT / "data" / "catalogue.json"

# slot: top | bottom | both | undershirt | topper | outerwear | shoes | other
# character: Neutral | Print | Color
TAGS = {
    "IMG_0049": ("bottom", "Neutral"),
    "IMG_0084": ("outerwear", "Print"),
    "IMG_0085": ("both", "Print"),
    "IMG_0086": ("both", "Neutral"),
    "IMG_0087": ("both", "Color"),
    "IMG_0088": ("both", "Neutral"),
    "IMG_0089": ("both", "Color"),
    "IMG_0090": ("both", "Print"),
    "IMG_0091": ("top", "Color"),
    "IMG_0092": ("top", "Print"),
    "IMG_0094": ("top", "Color"),
    "IMG_0095": ("top", "Color"),
    "IMG_0096": ("top", "Print"),
    "IMG_0097": ("top", "Neutral"),
    "IMG_0098": ("top", "Print"),
    "IMG_0099": ("top", "Neutral"),
    "IMG_0100": ("top", "Color"),
    "IMG_0101": ("bottom", "Neutral"),
    "IMG_0102": ("top", "Print"),
    "IMG_0103": ("top", "Print"),
    "IMG_0104": ("undershirt", "Print"),
    "IMG_0105": ("top", "Neutral"),
    "IMG_0106": ("undershirt", "Neutral"),
    "IMG_0107": ("top", "Color"),
    "IMG_0108": ("top", "Neutral"),
    "IMG_0109": ("both", "Neutral"),
    "IMG_0110": ("top", "Color"),
    "IMG_0111": ("top", "Neutral"),
    "IMG_0112": ("both", "Print"),
    "IMG_0114": ("other", "Neutral"),
    "IMG_0115": ("both", "Print"),
    "IMG_0116": ("both", "Neutral"),
    "IMG_0117": ("both", "Neutral"),
    "IMG_0118": ("both", "Neutral"),
    "IMG_0119": ("both", "Color"),
    "IMG_0120": ("bottom", "Print"),
    "IMG_0121": ("both", "Print"),
    "IMG_0122": ("both", "Neutral"),
    "IMG_0123": ("both", "Print"),
    "IMG_0124": ("both", "Color"),
    "IMG_0125": ("both", "Color"),
    "IMG_0126": ("both", "Color"),
    "IMG_0127": ("both", "Neutral"),
    "IMG_0128": ("both", "Print"),
    "IMG_0129": ("both", "Neutral"),
    "IMG_0130": ("top", "Neutral"),
    "IMG_0131": ("top", "Color"),
    "IMG_0132": ("bottom", "Print"),
    "IMG_0133": ("top", "Print"),
    "IMG_0134": ("top", "Print"),
    "IMG_0135": ("top", "Color"),
    "IMG_0136": ("top", "Print"),
    "IMG_0137": ("top", "Neutral"),
    "IMG_0138": ("top", "Print"),
    "IMG_0139": ("top", "Neutral"),
    "IMG_0140": ("undershirt", "Neutral"),
    "IMG_0141": ("undershirt", "Neutral"),
    "IMG_0142": ("top", "Print"),
    "IMG_0144": ("undershirt", "Neutral"),
    "IMG_0145": ("undershirt", "Neutral"),
    "IMG_0146": ("undershirt", "Neutral"),
    "IMG_0147": ("topper", "Neutral"),
    "IMG_0148": ("top", "Print"),
    "IMG_0149": ("top", "Color"),
    "IMG_0150": ("top", "Print"),
    "IMG_0151": ("top", "Neutral"),
    "IMG_0152": ("top", "Neutral"),
    "IMG_0153": ("top", "Color"),
    "IMG_0154": ("top", "Neutral"),
    "IMG_0155": ("outerwear", "Neutral"),
    "IMG_0156": ("bottom", "Color"),
    "IMG_0157": ("top", "Color"),
    "IMG_0158": ("bottom", "Neutral"),
    "IMG_0159": ("top", "Print"),
    "IMG_0160": ("undershirt", "Print"),
    "IMG_0161": ("outerwear", "Neutral"),
    "IMG_0162": ("outerwear", "Print"),
    "IMG_0163": ("bottom", "Neutral"),
    "IMG_0164": ("bottom", "Neutral"),
    "IMG_0165": ("both", "Print"),
    "IMG_0166": ("both", "Neutral"),
    "IMG_0167": ("top", "Print"),
    "IMG_0168": ("outerwear", "Neutral"),
    "IMG_0169": ("shoes", "Neutral"),
    "IMG_0170": ("shoes", "Neutral"),
    "IMG_0172": ("top", "Neutral"),
    "IMG_0174": ("shoes", "Neutral"),
}

SLOT_ORDER = ["top", "bottom", "both", "undershirt", "topper", "outerwear", "shoes", "other"]


def main():
    data = json.loads(CAT.read_text())
    missing = []
    for item in data["items"]:
        tid = item["id"]
        if tid not in TAGS:
            missing.append(tid)
            continue
        slot, character = TAGS[tid]
        item["slot"] = slot
        item["character"] = character
    if missing:
        raise SystemExit(f"Untagged IDs: {missing}")
    extra = set(TAGS) - {i["id"] for i in data["items"]}
    if extra:
        raise SystemExit(f"Tags for unknown IDs: {sorted(extra)}")

    data["profile"]["formula_slots"] = SLOT_ORDER[:-1]
    data["profile"]["formula_characters"] = ["Neutral", "Print", "Color"]
    data["stats"]["by_slot"] = {
        s: sum(1 for i in data["items"] if i.get("slot") == s) for s in SLOT_ORDER
    }
    data["stats"]["by_character"] = {
        c: sum(1 for i in data["items"] if i.get("character") == c)
        for c in ("Neutral", "Print", "Color")
    }

    CAT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    print("Tagged", len(data["items"]), "pieces")
    print("by_slot", data["stats"]["by_slot"])
    print("by_character", data["stats"]["by_character"])


if __name__ == "__main__":
    main()
