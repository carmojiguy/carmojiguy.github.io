#!/usr/bin/env python3
"""Photo ghosts for the website slots that do not already have one.

Each new guide starts from a CC0 / CC-BY / CC-BY-SA / public-domain photo,
is cut out with BiRefNet, then coloured with the same green the original
ghosts use: shaded fill, a hot silhouette, and a short alpha fringe.
The 12 original PNGs are never written.
"""
import json
import os
import re
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

OUT = "/workspace/ghosts"
UA = "GMstudioGhosts/1.0 (dealer photo guides; contact shawn@myloan.ca)"
LOCAL = "/workspace/photos/test-rav4"

# Remote files are fetched from Wikimedia Commons. Local files are already
# in the repo with credits in photos/test-rav4/CREDITS.txt.
# crop is (left, top, right, bottom) as fractions of the source.
SLOTS = {
    "roof": {"title": "File:EG2Tv-001 head car roof.jpg"},
    "headlight": {"title": "File:2018 Dodge Grand Caravan SE in silver - detail of light - front left.jpg"},
    "wheel": {"title": "File:20-inch wheel of Nissan FAIRLADY Z (Z34) Version ST, 2022.jpg"},
    "taillight": {"title": "File:2018 Dodge Grand Caravan SE in silver - detail of light - rear right.jpg"},
    "badge": {"title": "File:Emblem of Toyota 2000GT.JPG",
              "note": "Close-up of a Toyota emblem. It is the classic 2000GT badge, not a modern trunk badge."},
    "engine": {"title": "File:Engine bay of Toyota All New Land Cruiser FJ during GIIAS 2026 in Bandung 20260911 183023.jpg"},
    "jamb": {"title": "File:Tire and Loading Information.jpg"},
    "gauges": {"local": f"{LOCAL}/dash.jpg", "crop": (0.04, 0.04, 0.62, 0.50),
               "note": "Instrument cluster cropped from the licensed RAV4 Adventure cockpit."},
    "steering": {"title": "File:Audi Q5 steering wheel closeup.jpg"},
    "screen": {"title": "File:360-degree surround-view parking camera display on an infotainment screen.jpg"},
    "backup": {"title": "File:2017 Honda Ridgeline Multi-View Rear Camera Display.jpg"},
    "climate": {"local": f"{LOCAL}/dash.jpg", "crop": (0.28, 0.50, 0.74, 0.70),
                "note": "Climate-control row under the screen, cropped from the RAV4 cockpit."},
    "sunroof": {"title": "File:Genesis G90 RS4 SDS Galaxy Black Modern Gray Two-tone News Paper Crown (36).jpg",
                "force": "feather",
                "note": "Full interior frame kept so the glass roof is not cut away."},
    "headliner": {"title": "File:2010 Honda Odyssey EX-L Minivan Interior.jpg", "crop": (0.0, 0.0, 1.0, 0.46),
                  "force": "feather",
                  "note": "Ceiling band of the Odyssey cabin, kept as a feathered frame."},
    "rearseat": {"title": "File:Car rear seats.jpg"},
    "legroom": {"title": "File:Honda Odyssey Rear Seats.jpg"},
    "passeat": {"title": "File:2021 Chrysler Pacifica interior.jpg"},
    "cargo": {"title": "File:2021 Toyota GR Yaris 1.6 GXPA16R trunk (20211117).jpg"},
    "folded": {"title": "File:1988 Toyota Tarago (YR21R) DX van 5 (rear cabin with folded seats).jpg"},
    "keys": {"title": "File:Car Keys.jpg"},
    "bedside": {"title": "File:2021 Ford F-150 Double Cab.jpg"},
    "bedtail": {"title": "File:Lincoln Blackwood bed open.jpg"},
    "bedhitch": {"title": "File:Spray-on bedliner.jpg"},
    "sliding": {"title": "File:Honda Stepwgn (Portchester, Hampshire -England).jpg"},
    "thirdrow": {"title": "File:Honda Mobilio i-VTEC 2014 Third Row Seat.jpg"},
}

LOCAL_CREDIT = {
    f"{LOCAL}/rear.jpg": {
        "title": "File:2021 Toyota RAV4 XLE AWD, rear right, 05-24-2026.jpg",
        "lic": "CC BY-SA 4.0",
        "artist": "MercurySable99",
        "page": "https://commons.wikimedia.org/wiki/File:2021_Toyota_RAV4_XLE_AWD,_rear_right,_05-24-2026.jpg",
    },
    f"{LOCAL}/dash.jpg": {
        "title": "File:The interior of Toyota RAV4 Adventure (6BA-MXAA54-ANXVB).jpg",
        "lic": "CC BY-SA 4.0",
        "artist": "Tokumeigakarinoaoshima",
        "page": "https://commons.wikimedia.org/wiki/File:The_interior_of_Toyota_RAV4_Adventure_(6BA-MXAA54-ANXVB).jpg",
    },
}


def strip_html(value):
    text = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", text).strip()


def commons_meta(titles):
    found = {}
    batch = list(titles)
    for i in range(0, len(batch), 12):
        chunk = batch[i:i + 12]
        params = urllib.parse.urlencode({
            "action": "query", "format": "json",
            "titles": "|".join(chunk),
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|mime|size",
        })
        req = urllib.request.Request(
            "https://commons.wikimedia.org/w/api.php?" + params,
            headers={"User-Agent": UA},
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode())
        for page in (data.get("query") or {}).get("pages", {}).values():
            title = page.get("title")
            info = (page.get("imageinfo") or [None])[0]
            if not title or not info:
                continue
            meta = info.get("extmetadata") or {}
            found[title] = {
                "title": title,
                "url": info.get("url"),
                "page": info.get("descriptionurl"),
                "lic": (meta.get("LicenseShortName") or {}).get("value") or "",
                "artist": strip_html((meta.get("Artist") or {}).get("value") or ""),
            }
    return found


def fetch(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as resp:
        data = resp.read()
    open(dest, "wb").write(data)


def limit_long(im, long_side):
    w, h = im.size
    m = max(w, h)
    if m <= long_side:
        return im
    s = long_side / m
    return im.resize((max(2, int(w * s)), max(2, int(h * s))), Image.Resampling.LANCZOS)


def crop_frac(im, box):
    if not box:
        return im
    w, h = im.size
    l, t, r, b = box
    return im.crop((int(w * l), int(h * t), int(w * r), int(h * b)))


def green_glow(im):
    """Match the original ghosts: core ~#43FE6A ratios, shaded fill, hot edge."""
    rgba = np.array(im.convert("RGBA")).astype(np.float32)
    rgb = rgba[:, :, :3]
    a = rgba[:, :, 3] / 255.0
    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    soft = np.array(Image.fromarray(np.clip(lum, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))).astype(np.float32)
    lum2 = np.clip(lum + (lum - soft) * 1.25, 0, 255)
    solid = a > 0.45
    if solid.sum() > 80:
        p5, p95 = np.percentile(lum2[solid], [8, 92])
    else:
        p5, p95 = 30.0, 210.0
    t = np.clip((lum2 - p5) / max(12.0, p95 - p5), 0, 1) ** 0.9
    # Opaque originals sit around G 118 / 170 / 230. Keep the midtones there.
    g = 114 + t * 120
    mask = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    eroded = np.array(mask.filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255.0
    rim = np.clip(a - eroded, 0, 1)
    g = np.clip(g + rim * 55, 0, 255)
    glow_r = max(1.8, min(im.size) * 0.007)
    glow = np.array(mask.filter(ImageFilter.GaussianBlur(radius=glow_r))).astype(np.float32) / 255.0
    alpha = np.where(a > 0.6, np.maximum(a, 0.98), np.clip(glow * 0.9, 0, 0.8))
    g = np.where(a < 0.6, np.maximum(g, 150), g)
    out = np.zeros_like(rgba)
    out[:, :, 0] = g * 0.264
    out[:, :, 1] = g
    out[:, :, 2] = g * 0.418
    out[:, :, 3] = np.where(alpha * 255 < 8, 0, alpha * 255)
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def trim(im, pad=8):
    a = np.array(im.split()[-1])
    ys, xs = np.where(a > 10)
    if len(xs) == 0:
        return im
    x0, x1 = max(0, int(xs.min()) - pad), min(im.width, int(xs.max()) + pad)
    y0, y1 = max(0, int(ys.min()) - pad), min(im.height, int(ys.max()) + pad)
    return im.crop((x0, y0, x1 + 1, y1 + 1))


def cutout(im, session, force=None):
    src = limit_long(im.convert("RGB"), 1280)
    if force == "feather":
        yy, xx = np.mgrid[0:src.height, 0:src.width]
        edge = np.minimum(np.minimum(xx, src.width - 1 - xx), np.minimum(yy, src.height - 1 - yy))
        feather = np.clip(edge / 18.0, 0, 1)
        out = src.convert("RGBA")
        out.putalpha(Image.fromarray(np.clip(feather * 255, 0, 255).astype(np.uint8)))
        return out, "feather"
    cut = remove(src, session=session).convert("RGBA")
    a = np.array(cut.split()[-1])
    frac = float((a > 20).mean())
    # A full-bleed interior has no outdoor background. Keep it, with a soft edge.
    if frac < 0.08 or frac > 0.93:
        soft = Image.new("L", src.size, 0)
        # Feather the border so the ghost does not end in a hard rectangle.
        yy, xx = np.mgrid[0:src.height, 0:src.width]
        edge = np.minimum(np.minimum(xx, src.width - 1 - xx), np.minimum(yy, src.height - 1 - yy))
        feather = np.clip(edge / 18.0, 0, 1)
        alpha = Image.fromarray(np.clip(feather * 255, 0, 255).astype(np.uint8))
        out = src.convert("RGBA")
        out.putalpha(alpha)
        return out, "feather"
    return cut, "birefnet"


def main():
    import sys
    only = sys.argv[1:]
    os.makedirs("/tmp/ghost-src", exist_ok=True)
    titles = [s["title"] for k, s in SLOTS.items() if "title" in s and (not only or k in only)]
    meta = commons_meta(titles)
    session = new_session("birefnet-general-lite")
    credits = []
    for key, spec in SLOTS.items():
        if only and key not in only:
            continue
        if "local" in spec:
            im = Image.open(spec["local"])
            info = dict(LOCAL_CREDIT[spec["local"]])
        else:
            info = meta.get(spec["title"])
            if not info or not info.get("url"):
                raise SystemExit("missing " + spec["title"])
            dest = "/tmp/ghost-src/" + key + ".jpg"
            if not os.path.exists(dest) or os.path.getsize(dest) < 1000:
                print("download", key, flush=True)
                fetch(info["url"], dest)
            im = Image.open(dest)
        im = crop_frac(im, spec.get("crop"))
        print("cut", key, im.size, flush=True)
        cut, how = cutout(im, session, spec.get("force"))
        ghost = trim(green_glow(cut))
        ghost = limit_long(ghost, 900)
        path = os.path.join(OUT, key + ".png")
        ghost.save(path, "PNG", optimize=True)
        print(" ", key, ghost.size, how, os.path.getsize(path), flush=True)
        credits.append({
            "file": key + ".png",
            "title": info["title"],
            "license": info["lic"],
            "artist": info["artist"],
            "page": info["page"],
            "cutout": how,
            "note": spec.get("note", ""),
        })
    blob = "/tmp/ghost-src/credits.json"
    prev = {}
    if os.path.exists(blob):
        prev = {row["file"]: row for row in json.load(open(blob))}
    for row in credits:
        prev[row["file"]] = row
    ordered = [prev[key + ".png"] for key in SLOTS if key + ".png" in prev]
    json.dump(ordered, open(blob, "w"), indent=2)
    write_credits(ordered)


def write_credits(rows):
    lines = [
        "New photo ghosts",
        "================",
        "",
        "These are the guides added for website slots that did not already have",
        "one. The original twelve PNGs (qfront, front, driver, dash, console,",
        "qrear, rear, tire, door, and the passenger flips of qfront, driver and",
        "qrear) are untouched.",
        "",
        "Each new file is a licensed photograph. The background was removed with",
        "BiRefNet-general-lite when the subject could be separated from the",
        "scene. A full-bleed interior that had no outdoor background kept a",
        "feathered edge instead of an empty cut. The green is the same treatment",
        "as the originals: luminance mapped into their green (R = 0.264 G,",
        "B = 0.418 G), shaded fill, a brighter silhouette, and a short glow.",
        "",
        "Regenerate with tools/photo_ghosts.py.",
        "",
    ]
    for row in rows:
        lines.append(row["file"])
        lines.append(f"  {row['title']}")
        lines.append(f"  {row['license']}")
        lines.append(f"  {row['artist']}")
        lines.append(f"  {row['page']}")
        lines.append(f"  cutout: {row['cutout']}")
        if row["note"]:
            lines.append(f"  {row['note']}")
        lines.append("")
    path = os.path.join(OUT, "CREDITS.txt")
    open(path, "w").write("\n".join(lines))
    print("credits", path)


if __name__ == "__main__":
    main()
