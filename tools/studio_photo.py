#!/usr/bin/env python3
"""Photographic G&M studio plates and proof composites.

Direction A is a real empty cyclorama (Poly Haven, CC0), graded to a clean
white or light-grey cove. Direction B is a real photo studio (Poly Haven,
CC0) with the lights and the room left in the frame. Cars are cutouts seated
large on the floor, colour-matched, with a floor reflection, contact shadow,
and the studio reflected in the glass.

There is no diffusion relight model here: this machine has no GPU. The match
is photographic colour transfer, a light-direction gradient taken from the
plate, and the reflection/shadow work above.
"""
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
from render_gm_studio import wordmark

OUT = "/workspace/backgrounds/gm-studio"
PROOF = "/tmp/studio-final"
CYC = "/tmp/studio-src/ph/cyc-pano.jpg"
PS = "/tmp/studio-src/ph/ps01-pano.jpg"
CUTS = {
    "rav4-front": ("/tmp/gm-proof2/rav4-front-cut.png", "qfront"),
    "rav4-side": ("/tmp/gm-proof2/rav4-side-cut.png", "side"),
    "rav4-rear": ("/tmp/gm-proof2/rav4-rear-cut.png", "rear"),
    "camry-front": ("/tmp/gm-proof2/camry-front-cut.png", "qfront"),
}
os.makedirs(OUT, exist_ok=True)
os.makedirs(PROOF, exist_ok=True)


def project(pano, out_w, out_h, yaw, pitch, fov):
    """Equirectangular panorama to a pinhole view. yaw/pitch/fov in degrees."""
    height, width = pano.shape[:2]
    fov_r = np.deg2rad(fov)
    fx = (out_w / 2) / np.tan(fov_r / 2)
    xs = np.arange(out_w, dtype=np.float32)
    ys = np.arange(out_h, dtype=np.float32)
    x, y = np.meshgrid(xs, ys)
    cx, cy = (out_w - 1) / 2, (out_h - 1) / 2
    dx = (x - cx) / fx
    dy = (y - cy) / fx
    dz = np.ones_like(dx)
    norm = np.sqrt(dx * dx + dy * dy + dz * dz)
    rx, ry, rz = dx / norm, -dy / norm, dz / norm
    p = np.deg2rad(pitch)
    cp, sp = np.cos(p), np.sin(p)
    ry2 = ry * cp - rz * sp
    rz2 = ry * sp + rz * cp
    yaw_r = np.deg2rad(yaw)
    cyw, syw = np.cos(yaw_r), np.sin(yaw_r)
    rx3 = rx * cyw + rz2 * syw
    rz3 = -rx * syw + rz2 * cyw
    ry3 = ry2
    lon = np.arctan2(rx3, rz3)
    lat = np.arcsin(np.clip(ry3, -1, 1))
    u = (lon / (2 * np.pi) + 0.5) * (width - 1)
    v = (0.5 - lat / np.pi) * (height - 1)
    u0 = np.floor(u).astype(np.int32) % width
    v0 = np.clip(np.floor(v).astype(np.int32), 0, height - 1)
    u1 = (u0 + 1) % width
    v1 = np.clip(v0 + 1, 0, height - 1)
    fu = (u - np.floor(u))[..., None]
    fv = (v - np.floor(v))[..., None]
    out = (
        pano[v0, u0].astype(np.float32) * (1 - fu) * (1 - fv)
        + pano[v0, u1].astype(np.float32) * fu * (1 - fv)
        + pano[v1, u0].astype(np.float32) * (1 - fu) * fv
        + pano[v1, u1].astype(np.float32) * fu * fv
    )
    return np.clip(out, 0, 255).astype(np.uint8)


def grade_cove(src, key):
    """Lift the real cyclorama toward a clean high-key wall. Keep its shading."""
    arr = src.astype(np.float32)
    mean = arr.mean(axis=(0, 1), keepdims=True)
    # The cove is already almost even. Compress what variation it has so the
    # wall stays photographic without blotches.
    flat = (arr - mean) * 0.50 + key
    # The photographed cove is almost one tone. Drop the floor so a white car
    # sits on a ground plane instead of disappearing into the wall.
    h = arr.shape[0]
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    floor = np.clip((y - 0.56) / 0.40, 0, 1)
    floor = floor * floor * (3 - 2 * floor)
    flat = flat - floor * 26
    return np.clip(flat, 0, 255).astype(np.uint8)


def turntable_seam(src):
    """A faint full-width seam so the cove floor reads as a large turntable.

    The fill stays the photographed floor. Only the edge is drawn, and it is
    a few levels darker than the photo, not a separate grey disc.
    """
    h, w = src.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    cx, cy = w * 0.50, h * 0.86
    rx, ry = w * 0.495, h * 0.20
    d = np.sqrt(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2)
    ring = np.exp(-((d - 1.0) ** 2) / (2 * 0.012 ** 2))
    ring = ring * (yy > h * 0.55)
    out = src.astype(np.float32) - ring[..., None] * 16
    return np.clip(out, 0, 255).astype(np.uint8)


def grade_room(src):
    """Keep the studio's lights. Open the shadows enough to sell a car."""
    arr = src.astype(np.float32)
    # Gentle lift of the dark floor, leave the highlights.
    lifted = arr * 0.88 + 14
    h = lifted.shape[0]
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    # Keep the ceiling lights. Darken the floor toward polished epoxy.
    floor = np.clip((y - 0.52) / 0.42, 0, 1)
    floor = floor * floor * (3 - 2 * floor)
    lifted = lifted * (1 - floor * 0.42)
    return np.clip(lifted, 0, 255).astype(np.uint8)


def trap(im, top_scale=0.90):
    w, h = im.size
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    src = im.convert("RGBA")
    for y in range(h):
        t = y / max(1, h - 1)
        scale = top_scale + (1 - top_scale) * t
        nw = max(1, int(round(w * scale)))
        row = src.crop((0, y, w, y + 1)).resize((nw, 1), Image.Resampling.BILINEAR)
        out.paste(row, ((w - nw) // 2, y), row)
    return out


def place_mark(plate, kind):
    im = Image.fromarray(plate).convert("RGBA")
    w, h = im.size
    if kind == "cove":
        mark = wordmark((28, 30, 34, 255), (78, 82, 88, 255), max(64, int(w * 0.046)))
        max_w = int(w * 0.22)
    else:
        # Lit sign on the back wall. White letters, red bar, a soft shadow.
        mark = wordmark((248, 248, 250, 255), (220, 222, 226, 255), max(64, int(w * 0.042)))
        mark = trap(mark, 0.88)
        max_w = int(w * 0.26)
    if mark.width > max_w:
        nh = int(mark.height * max_w / mark.width)
        mark = mark.resize((max_w, max(1, nh)), Image.Resampling.LANCZOS)
    # Pick up a little of the wall so the sign is not a sticker.
    wall = np.array(im.crop((w // 2 - 20, int(h * 0.16), w // 2 + 20, int(h * 0.22))))
    wall_m = wall[:, :, :3].mean() / 255.0
    mp = np.array(mark).astype(np.float32)
    if kind == "room" and wall_m < 0.45:
        pass
    elif kind == "cove":
        mp[:, :, :3] *= 0.92 + 0.08 * wall_m
    shadow = Image.new("RGBA", mark.size, (0, 0, 0, 0))
    sh = mark.split()[-1].point(lambda p: min(255, int(p * 0.45)))
    shadow.paste((0, 0, 0, 255), mask=sh)
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(2, mark.width // 80)))
    x = (w - mark.width) // 2
    y = int(h * (0.045 if kind == "cove" else 0.16))
    im.alpha_composite(shadow, (x, y + max(3, mark.height // 18)))
    im.alpha_composite(Image.fromarray(np.clip(mp, 0, 255).astype(np.uint8), "RGBA"), (x, y))
    return np.array(im.convert("RGB"))


def make_plates(cyc, room):
    specs = {
        "white": ("cove", np.array([214, 216, 218], np.float32), 180, 18, 66),
        "silver": ("cove", np.array([206, 208, 211], np.float32), 180, 18, 66),
        "warm": ("cove", np.array([220, 214, 204], np.float32), 180, 18, 66),
        "charcoal": ("room", None, 28, 8, 72),
    }
    plates = {}
    for name, (kind, key, yaw, pitch, fov) in specs.items():
        for tag, w, h, fov_adj in (("4x3", 3200, 2400, 0), ("16x9", 3200, 1800, 8)):
            src_pano = cyc if kind == "cove" else room
            view = project(src_pano, w, h, yaw, pitch, fov + fov_adj)
            if kind == "cove":
                view = grade_cove(view, key)
                view = turntable_seam(view)
            else:
                view = grade_room(view)
            view = place_mark(view, kind)
            path = os.path.join(OUT, f"{name}-{tag}.jpg")
            Image.fromarray(view).save(path, "JPEG", quality=92, optimize=True, subsampling=1)
            print("plate", path, os.path.getsize(path), flush=True)
            if tag == "4x3":
                plates[name] = view
    return plates


def harmonize(car, plate):
    """Move the car's colour toward the room without repainting it."""
    rgba = np.array(car).astype(np.float32)
    rgb = rgba[:, :, :3]
    a = rgba[:, :, 3:4] / 255.0
    opaque = a[:, :, 0] > 0.5
    if opaque.sum() < 50:
        return car
    # Room colour behind the body, not the floor.
    ph, pw = plate.shape[:2]
    room = plate[int(ph * 0.28):int(ph * 0.48), int(pw * 0.2):int(pw * 0.8)].astype(np.float32)
    room_mean = room.mean(axis=(0, 1))
    car_mean = rgb[opaque].mean(axis=0)
    # A light wrap from the wall, stronger in the shadows.
    lum = rgb.mean(axis=2, keepdims=True)
    shade = np.clip(1.15 - lum / 180.0, 0, 1)
    cast = (room_mean - room_mean.mean()) * 0.55
    rgb = rgb + cast * shade * 0.85
    # Overhead light: the roof and hood are a little brighter, matching a softbox.
    yy = np.linspace(1.06, 0.93, rgb.shape[0], dtype=np.float32)[:, None, None]
    # Horizontal falloff copied from the plate's wall.
    wall_row = plate[int(ph * 0.34)].astype(np.float32).mean(axis=1)
    wall_row = wall_row / max(1.0, wall_row.mean())
    xs = np.linspace(0, pw - 1, rgb.shape[1]).astype(np.int32)
    xx = wall_row[xs][None, :, None]
    xx = 0.94 + 0.06 * np.clip(xx, 0.7, 1.3)
    rgb = rgb * yy * xx
    # Soft studio contrast. Whites stay white.
    rgb = (rgb - car_mean) * 0.94 + car_mean
    rgb = rgb + 4
    rgba[:, :, :3] = np.clip(rgb, 0, 255)
    return Image.fromarray(rgba.astype(np.uint8), "RGBA")


def crisp_edge(car):
    """A thin light rim so the cutout reads against a light wall."""
    rgba = np.array(car)
    alpha = rgba[:, :, 3]
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    dil = cv2.dilate(alpha, kernel)
    ero = cv2.erode(alpha, kernel)
    rim = np.clip(dil.astype(np.int16) - ero.astype(np.int16), 0, 255).astype(np.float32) / 255.0
    rgb = rgba[:, :, :3].astype(np.float32)
    rgb = np.clip(rgb + rim[..., None] * 36, 0, 255)
    rgba[:, :, :3] = rgb.astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def glass(car, plate_rgb, left, top):
    """Reflect a blurred piece of the room into the open windows."""
    rgba = np.array(car).astype(np.float32)
    h, w = rgba.shape[:2]
    ph, pw = plate_rgb.shape[:2]
    # Sample the plate over the car, biased up toward the softboxes.
    x0 = int(np.clip(left, 0, pw - 2))
    y0 = int(np.clip(top - h * 0.15, 0, ph - 2))
    x1 = int(np.clip(x0 + w, x0 + 2, pw))
    y1 = int(np.clip(y0 + h, y0 + 2, ph))
    patch = plate_rgb[y0:y1, x0:x1]
    if patch.size == 0:
        return car
    refl = Image.fromarray(patch).resize((w, h), Image.Resampling.BILINEAR)
    refl = refl.filter(ImageFilter.GaussianBlur(radius=max(8, w // 40)))
    rr = np.array(refl).astype(np.float32)
    alpha = rgba[:, :, 3] / 255.0
    # Open glass is the transparent upper body, inside the silhouette.
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    glass_m = (alpha < 0.18) & (yy < 0.72)
    # A softbox strip: brighter across the upper glass.
    strip = np.exp(-((yy - 0.28) ** 2) / 0.02) * 0.35
    rr = np.clip(rr + strip[..., None] * 80, 0, 255)
    # Paint only where the cutout is open.
    g = glass_m.astype(np.float32)[..., None]
    rgba[:, :, :3] = rgba[:, :, :3] * (1 - g) + rr * g
    rgba[:, :, 3] = np.where(glass_m, 210, rgba[:, :, 3])
    return Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")


def composite(plate, car, profile, gloss):
    rgb = plate if isinstance(plate, np.ndarray) else np.array(plate)
    h, w = rgb.shape[:2]
    car = harmonize(car, rgb)
    alpha = np.array(car.split()[-1])
    ys, xs = np.where(alpha > 40)
    if len(xs) == 0:
        return Image.fromarray(rgb)
    bw = xs.max() - xs.min() + 1
    body_cx = float(xs.mean())
    seat_y = float(ys.max())
    frac = {"qfront": 0.88, "side": 0.90, "front": 0.86, "rear": 0.86}.get(profile, 0.88)
    scale = (w * frac) / max(bw, 1)
    contact = h * 0.80
    roof_limit = h * 0.11
    if contact - seat_y * scale < roof_limit:
        scale = (contact - roof_limit) / max(seat_y, 1)
    tw = max(2, int(round(car.width * scale)))
    th = max(2, int(round(car.height * scale)))
    car_r = car.resize((tw, th), Image.Resampling.LANCZOS)
    car_r = crisp_edge(car_r)
    left = int(round(w * 0.50 - body_cx * scale))
    top = int(round(contact - seat_y * scale))
    car_r = glass(car_r, rgb, left, top)

    canvas = Image.fromarray(rgb).convert("RGBA")
    # Contact shadow and a wider ambient shadow on the floor.
    sh = Image.new("L", canvas.size, 0)
    draw = ImageDraw.Draw(sh)
    a = np.array(car_r.split()[-1])
    cols = np.where(a.max(axis=0) > 40)[0]
    if len(cols):
        span = cols.max() - cols.min()
        cx = left + int(cols.mean())
        rw = max(20, int(span * scale * 0.0 + span * 0.55))
        # span is already in car_r pixels
        rw = max(30, int((cols.max() - cols.min()) * 0.48))
        rh = max(8, int(h * 0.018))
        draw.ellipse([cx - rw, int(contact) - rh, cx + rw, int(contact) + rh], fill=180)
        draw.ellipse([cx - int(rw * 1.15), int(contact) - rh * 2, cx + int(rw * 1.15), int(contact) + int(rh * 3.2)], fill=80)
    shadow = sh.filter(ImageFilter.GaussianBlur(radius=max(10, int(h * 0.012))))
    sp = np.zeros((h, w, 4), np.uint8)
    darkness = np.array(shadow).astype(np.float32) / 255.0
    sp[:, :, 3] = np.clip(darkness * (150 if gloss < 0.5 else 190), 0, 255).astype(np.uint8)
    canvas = Image.alpha_composite(canvas, Image.fromarray(sp, "RGBA"))

    # Floor reflection: flipped, blurred, fading, stronger at the contact.
    keep = max(12, int(th * 0.22))
    band = car_r.crop((0, th - keep, tw, th)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    band = band.filter(ImageFilter.GaussianBlur(radius=2.2))
    bp = np.array(band).astype(np.float32)
    fade = np.linspace(gloss, 0.0, keep, dtype=np.float32)[:, None]
    # Fresnel-ish: the near floor (top of the flipped band) holds more of the car.
    fade = fade ** 0.85
    bp[:, :, 3] *= fade
    refl = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    refl.paste(Image.fromarray(np.clip(bp, 0, 255).astype(np.uint8), "RGBA"), (left, int(contact) - 1))
    # Stay on the floor, full width, not inside a small disc.
    rp = np.array(refl)
    floor = np.linspace(0, 1, h, dtype=np.float32)[:, None] > (contact / h - 0.01)
    rp[:, :, 3] = (rp[:, :, 3].astype(np.float32) * floor).astype(np.uint8)
    canvas = Image.alpha_composite(canvas, Image.fromarray(rp, "RGBA"))
    canvas.paste(car_r, (left, top), car_r)
    return canvas.convert("RGB")


def main():
    print("load panos", flush=True)
    cyc = np.array(Image.open(CYC))
    room = np.array(Image.open(PS))
    plates = make_plates(cyc, room)
    # Proofs at full plate resolution, then a contact sheet.
    cells = []
    for name, (path, profile) in CUTS.items():
        car = Image.open(path).convert("RGBA")
        row = []
        for variant, gloss in (("white", 0.40), ("charcoal", 0.55)):
            comp = composite(plates[variant], car, profile, gloss)
            dest = os.path.join(PROOF, f"{name}-{variant}.jpg")
            comp.save(dest, "JPEG", quality=92, subsampling=1)
            print("comp", dest, comp.size, os.path.getsize(dest), flush=True)
            row.append(comp.resize((960, 720), Image.Resampling.LANCZOS))
        cells.append((name, row))
    pad, label = 14, 32
    cw, ch = 960, 720
    sheet = Image.new("RGB", (pad + 2 * (cw + pad), pad + len(cells) * (ch + label + pad)), (12, 12, 12))
    draw = ImageDraw.Draw(sheet)
    from PIL import ImageFont
    font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 22)
    heads = ["A  clean white cove", "B  photo studio"]
    for r, (name, row) in enumerate(cells):
        for c, im in enumerate(row):
            x = pad + c * (cw + pad)
            y = pad + r * (ch + label + pad)
            sheet.paste(im, (x, y + label))
            draw.text((x, y + 4), f"{name}  ·  {heads[c]}", fill=(240, 240, 240), font=font)
    sheet_path = os.path.join(PROOF, "both-directions.jpg")
    sheet.save(sheet_path, quality=88)
    print("sheet", sheet_path, sheet.size)


if __name__ == "__main__":
    main()
