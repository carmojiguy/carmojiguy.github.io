#!/usr/bin/env python3
"""Photo ghosts for the website slots that do not already have one.

Each new guide starts from a CC0 / CC-BY / CC-BY-SA / public-domain photo.
The subject is masked (BiRefNet, or a crop / polygon when the cutout cannot
separate it). The green is an x-ray: bright edge lines and a silhouette
stroke over a dark, mostly transparent body, in the original ghosts' green.
The 12 original PNGs are never written.
"""
import json
import os
import re
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from rembg import new_session, remove

OUT = "/workspace/ghosts"
UA = "GMstudioGhosts/1.0 (dealer photo guides; contact shawn@myloan.ca)"
# crop is (left, top, right, bottom) as fractions of the source.
# ellipse is (cx, cy, rx, ry) in the same fractions, applied after the crop.
# fill means the crop itself is the subject when BiRefNet cannot separate it.
SLOTS = {
    "roof": {
        "title": "File:Mercedes-Benz G63 AMG V8 BITURBO SUV (50703492437).jpg",
        "note": "Modern SUV, high front three-quarter.",
    },
    "headlight": {"title": "File:2018 Dodge Grand Caravan SE in silver - detail of light - front left.jpg"},
    "wheel": {"title": "File:20-inch wheel of Nissan FAIRLADY Z (Z34) Version ST, 2022.jpg"},
    "taillight": {"title": "File:2018 Dodge Grand Caravan SE in silver - detail of light - rear right.jpg"},
    "badge": {
        "title": "File:2021 Volkswagen Golf hatchback in Pure White, rear three-quarter view showing tailgate and VW badge.jpg",
        "crop": (0.40, 0.30, 0.62, 0.55),
        "fill": True,
        "note": "Tailgate roundel and GOLF script, cropped off the car.",
    },
    "engine": {
        "title": "File:2026 Chevrolet Sonic engine bay.jpg",
        "note": "Front-on bay. Hoses and show lighting are in the source.",
    },
    "jamb": {"title": "File:Tire and Loading Information.jpg"},
    "gauges": {
        "title": "File:Tesla Model S Instrument Cluster Speedometer.jpg",
        "fill": True,
        "note": "Modern cluster, face-on. The crop is the cluster.",
    },
    "steering": {
        "title": "File:Steering Wheel Closeup - 2013 Volvo S60 T5 AWD (8388958639).jpg",
        "note": "Full modern wheel, front-on.",
    },
    "screen": {
        "title": "File:360-degree surround-view parking camera display on an infotainment screen.jpg",
        "fill": True,
        "note": "The photograph is the screen. BiRefNet kept only a sliver, so the frame is the display.",
    },
    "backup": {"title": "File:2017 Honda Ridgeline Multi-View Rear Camera Display.jpg"},
    "climate": {
        "title": "File:2006 Honda Ridgeline RTS-head unit and climate control interface.jpg",
        "crop": (0.08, 0.76, 0.92, 0.96),
        "fill": True,
        "note": "Centre HVAC controls, face-on, cropped off the radio. The stack is a 2006 Ridgeline, not a current touchscreen.",
    },
    "sunroof": {
        "title": "File:Nissan-Presage axis-u30 1998-sunroof open.jpg",
        "crop": (0.02, 0.00, 0.98, 0.55),
        "note": "Open sunroof seen from inside the cabin. It is a 1998 Presage, and the camera is aimed up and back rather than straight up at a modern roof.",
    },
    "headliner": {
        "title": "File:Dome light Citroen C3.jpg",
        "note": "Looking up at the dome light and headliner.",
    },
    "rearseat": {
        "title": "File:Car rear seats.jpg",
        "fill": True,
        "note": "The photograph is the rear bench. BiRefNet kept a fragment, so the crop is the seats.",
    },
    "legroom": {
        "title": "File:Honda Odyssey Rear Seats.jpg",
        "crop": (0.02, 0.18, 0.98, 0.98),
        "fill": True,
        "note": "Rear seat and leg space. Cropped in so the window is not the subject.",
    },
    "passeat": {
        "title": 'File:Toyota ROOMY X"S" passenger seat lift-up seat vehicle B-type (DBA-M900A-VTPBAM) left.jpg',
        "note": "Front passenger seat seen through the open door.",
    },
    "cargo": {"title": "File:2021 Toyota GR Yaris 1.6 GXPA16R trunk (20211117).jpg"},
    "folded": {
        "title": "File:Rear Seats Folded - 2015 GMC Yukon Denali (14304123949).jpg",
        "note": "Modern SUV cargo area, rear seats folded, from the open hatch.",
    },
    "keys": {
        "title": "File:SUBARU FORESTER (SK) KEY FOB FRONT.jpg",
        "note": "Modern smart key fob. No tag.",
    },
    "bedside": {
        "title": "File:Ford F-150 Canteen, left side.png",
        "note": "True side profile. The bed is a canteen body, not an open pickup box.",
    },
    "bedtail": {"title": "File:Lincoln Blackwood bed open.jpg"},
    "bedhitch": {
        "title": "File:Spray-on bedliner.jpg",
        "note": "Bed floor and liner. No hitch is in the frame.",
    },
    "sliding": {
        "title": "File:Honda Stepwgn (Portchester, Hampshire -England).jpg",
        "note": "The sliding door is shut.",
    },
    "thirdrow": {
        "title": "File:Honda Mobilio i-VTEC 2014 Third Row Seat.jpg",
        "note": "Third-row bench. The camera is behind the second row, not standing in the side door.",
    },
}


def strip_html(value):
    text = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", text).strip()


def commons_meta(titles):
    found = {}
    batch = list(titles)
    for i in range(0, len(batch), 8):
        chunk = batch[i:i + 8]
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
        with urllib.request.urlopen(req, timeout=90) as resp:
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
    with urllib.request.urlopen(req, timeout=120) as resp:
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


def sobel(lum):
    base = Image.fromarray(np.clip(lum, 0, 255).astype(np.uint8))
    kx = ImageFilter.Kernel((3, 3), [-1, 0, 1, -2, 0, 2, -1, 0, 1], scale=1, offset=128)
    ky = ImageFilter.Kernel((3, 3), [-1, -2, -1, 0, 0, 0, 1, 2, 1], scale=1, offset=128)
    gx = np.array(base.filter(kx)).astype(np.float32) - 128
    gy = np.array(base.filter(ky)).astype(np.float32) - 128
    return np.sqrt(gx * gx + gy * gy)


def hologram(im):
    """Bright edge lines and a silhouette over a dark transparent body.

    Green ratios match the original ghosts (R = 0.264 G, B = 0.418 G).
    Body green sits near the dark end of those files. Edge cores stay under
    the blown-out cap so the opaque median is not a spike at 255.
    """
    rgba = np.array(im.convert("RGBA")).astype(np.float32)
    rgb = rgba[:, :, :3]
    a = rgba[:, :, 3] / 255.0
    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    soft = np.array(
        Image.fromarray(np.clip(lum, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.2))
    ).astype(np.float32)
    detail = np.clip(lum + (lum - soft) * 1.7, 0, 255)
    mag = sobel(detail)
    mask = a > 0.22
    if int(mask.sum()) < 80:
        mask = a > 0.05
    if mask.any():
        p_lo, p_hi = np.percentile(mag[mask], [68, 93])
    else:
        p_lo, p_hi = 20.0, 80.0
    edge = np.clip((mag - p_lo) / max(8.0, p_hi - p_lo), 0, 1) * 1.15
    edge = np.clip(edge, 0, 1) * (a > 0.12)
    edge = np.array(
        Image.fromarray(np.clip(edge * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))
    ).astype(np.float32) / 255.0
    solid = Image.fromarray(np.clip((a > 0.30) * 255, 0, 255).astype(np.uint8))
    dil = np.array(solid.filter(ImageFilter.MaxFilter(7))).astype(np.float32) / 255.0
    ero = np.array(solid.filter(ImageFilter.MinFilter(3))).astype(np.float32) / 255.0
    sil = np.clip(dil - ero, 0, 1)
    line = np.maximum(edge, sil * 0.95)
    glow = np.array(
        Image.fromarray(np.clip(line * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.1))
    ).astype(np.float32) / 255.0
    if mask.any():
        p5, p95 = np.percentile(detail[mask], [8, 92])
    else:
        p5, p95 = 20.0, 200.0
    tone = np.clip((detail - p5) / max(12.0, p95 - p5), 0, 1)
    body_g = 46 + tone * (92 - 46)
    hot = np.clip(148 + line * 58, 0, 230)
    weight = np.clip(line * 0.90 + glow * 0.22, 0, 1)
    green = np.clip(body_g * (1 - weight) + hot * weight + glow * 12, 0, 236)
    alpha = 0.32 * (0.40 + 0.60 * tone) * (a > 0.16) + glow * 0.38 + line * 0.72
    alpha = np.clip(alpha, 0, 1)
    alpha = np.where((a < 0.06) & (glow < 0.06), 0, alpha)
    out = np.zeros_like(rgba)
    out[:, :, 0] = green * 0.264
    out[:, :, 1] = green
    out[:, :, 2] = green * 0.418
    out[:, :, 3] = alpha * 255
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def trim(im, pad=8):
    alpha = np.array(im.split()[-1])
    ys, xs = np.where(alpha > 10)
    if len(xs) == 0:
        return im
    x0, x1 = max(0, int(xs.min()) - pad), min(im.width, int(xs.max()) + pad)
    y0, y1 = max(0, int(ys.min()) - pad), min(im.height, int(ys.max()) + pad)
    return im.crop((x0, y0, x1 + 1, y1 + 1))


def ellipse_mask(size, ell):
    cx, cy, rx, ry = ell
    w, h = size
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).ellipse(
        [(cx - rx) * w, (cy - ry) * h, (cx + rx) * w, (cy + ry) * h],
        fill=255,
    )
    return mask.filter(ImageFilter.GaussianBlur(1.6))


def polygon_mask(size, points):
    w, h = size
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).polygon([(x * w, y * h) for x, y in points], fill=255)
    return mask.filter(ImageFilter.GaussianBlur(1.2))


def with_alpha(rgb, mask):
    out = rgb.convert("RGBA")
    out.putalpha(mask)
    return out


def subject_crop_mask(size):
    """The crop is the object. Feather only a few pixels so the edge can glow."""
    h, w = size[1], size[0]
    yy, xx = np.mgrid[0:h, 0:w]
    edge = np.minimum(np.minimum(xx, w - 1 - xx), np.minimum(yy, h - 1 - yy))
    feather = np.clip(edge / 8.0, 0, 1)
    return Image.fromarray(np.clip(feather * 255, 0, 255).astype(np.uint8))


def cutout(im, session, spec):
    src = limit_long(im.convert("RGB"), 1280)
    if spec.get("poly"):
        return with_alpha(src, polygon_mask(src.size, spec["poly"])), "polygon"
    if spec.get("ellipse"):
        return with_alpha(src, ellipse_mask(src.size, spec["ellipse"])), "ellipse"
    cut = remove(src, session=session).convert("RGBA")
    alpha = np.array(cut.split()[-1])
    frac = float((alpha > 20).mean())
    if 0.05 <= frac <= 0.93:
        return cut, "birefnet"
    if spec.get("fill"):
        return with_alpha(src, subject_crop_mask(src.size)), "crop"
    # A failed cut stays a failed cut. Do not paint a rectangle over a room.
    return cut, "birefnet-thin"


def covers_frame(im):
    alpha = np.array(im.split()[-1])
    ys, xs = np.where(alpha > 30)
    if len(xs) == 0:
        return True
    pad = 0.03
    return (
        xs.min() < im.width * pad
        and xs.max() > im.width * (1 - pad)
        and ys.min() < im.height * pad
        and ys.max() > im.height * (1 - pad)
    )


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
        info = meta.get(spec["title"])
        if not info or not info.get("url"):
            raise SystemExit("missing " + spec["title"])
        lic = info["lic"].upper()
        if "NC" in lic or "ND" in lic:
            raise SystemExit("license " + key + " " + info["lic"])
        dest = "/tmp/ghost-src/" + key + ".img"
        stamp = dest + ".title"
        if (not os.path.exists(dest) or os.path.getsize(dest) < 1000
                or not os.path.exists(stamp) or open(stamp).read() != spec["title"]):
            print("download", key, flush=True)
            fetch(info["url"], dest)
            open(stamp, "w").write(spec["title"])
        im = crop_frac(Image.open(dest), spec.get("crop"))
        print("cut", key, im.size, flush=True)
        cut, how = cutout(im, session, spec)
        ghost = trim(hologram(cut))
        ghost = limit_long(ghost, 900)
        path = os.path.join(OUT, key + ".png")
        ghost.save(path, "PNG", optimize=True)
        boxed = covers_frame(ghost)
        print(" ", key, ghost.size, how, "FRAME" if boxed else "masked", os.path.getsize(path), flush=True)
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
        try:
            prev = {row["file"]: row for row in json.load(open(blob))}
        except Exception:
            prev = {}
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
        "Each new file is a licensed photograph, masked to the subject. BiRefNet",
        "general-lite removes the background when it can. A crop or a drawn",
        "mask is used when the subject fills the frame (a cluster, a badge, a",
        "control panel). The picture is never left as a feathered rectangle of",
        "a whole room.",
        "",
        "The green is an x-ray of that cutout. Sobel edges plus a silhouette",
        "stroke are the hot core, with a short glow. The body is a dark green",
        "at low opacity (R = 0.264 G, B = 0.418 G, the original ghost colour).",
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
