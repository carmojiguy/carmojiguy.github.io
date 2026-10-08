#!/usr/bin/env python3
"""Composite a BiRefNet cutout onto a Cycles turntable plate.

Proof only. It does not touch the live app and it does not call a paid API.

Order:
  - denoise the plate with standalone OIDN when the binary is present
  - draw one constant-width turntable circle
  - rotate the cutout so the two tyre contacts are level
  - neutralise white balance to the studio wall and lift to high-key
  - replace window glass (holes and opaque outdoor glass) with a dark
    studio gradient and a softbox highlight
  - lay a broad softbox band on the upper body and the hood
  - choke the silhouette by 1 px and kill the fringe
  - tight contact shadow per tyre, plus a wider body occlusion
  - a mirrored, faded reflection of the whole lower car, clipped to the disc
  - a small G&M wordmark
"""
import importlib.util
import json
import os
import shutil
import subprocess
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OIDN_CANDIDATES = [
    os.environ.get("OIDN_BIN", ""),
    "/tmp/oidn/oidn-2.3.3.x86_64.linux/bin/oidnDenoise",
    "oidnDenoise",
]


def load_wordmark():
    path = os.path.join(ROOT, "tools", "render_gm_studio.py")
    spec = importlib.util.spec_from_file_location("render_gm_studio", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.wordmark


wordmark = load_wordmark()


def find_oidn():
    for cand in OIDN_CANDIDATES:
        if not cand:
            continue
        if os.path.isfile(cand) and os.access(cand, os.X_OK):
            return cand
        found = shutil.which(cand)
        if found:
            return found
    return None


def write_pfm(path, rgb):
    img = rgb.astype(np.float32)
    if img.max() > 1.5:
        img = img / 255.0
    h, w = img.shape[:2]
    with open(path, "wb") as f:
        f.write(b"PF\n")
        f.write(f"{w} {h}\n".encode())
        f.write(b"-1.0\n")
        f.write(np.ascontiguousarray(np.flipud(img), dtype="<f4").tobytes())


def read_pfm(path):
    with open(path, "rb") as f:
        magic = f.readline().decode().strip()
        if magic != "PF":
            raise ValueError("expected PF, got " + magic)
        wh = f.readline().decode().split()
        w, h = int(wh[0]), int(wh[1])
        scale = float(f.readline().decode().strip())
        endian = "<f4" if scale < 0 else ">f4"
        data = np.frombuffer(f.read(), dtype=endian).copy()
    img = data.reshape((h, w, 3))
    return np.flipud(img)


def oidn_rgb(rgb, oidn):
    """LDR sRGB denoise. Returns uint8 RGB."""
    src = "/tmp/gm-oidn-in.pfm"
    dst = "/tmp/gm-oidn-out.pfm"
    write_pfm(src, rgb)
    cmd = [oidn, "--ldr", src, "--srgb", "-q", "high", "-o", dst]
    subprocess.check_call(cmd, stdout=subprocess.DEVNULL)
    out = read_pfm(dst)
    return np.clip(out * 255.0, 0, 255).astype(np.uint8)


def smooth_plate(rgb, oidn):
    if oidn:
        try:
            return oidn_rgb(rgb, oidn)
        except Exception as exc:
            print("oidn failed", exc)
    return cv2.bilateralFilter(rgb, d=7, sigmaColor=12, sigmaSpace=7)


def stroke_circle(rgb, ellipse, width):
    im = Image.fromarray(rgb, "RGB").convert("RGBA")
    overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    cx, cy, rx, ry = ellipse["cx"], ellipse["cy"], ellipse["rx"], ellipse["ry"]
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], outline=(96, 100, 104, 255), width=width)
    return np.asarray(Image.alpha_composite(im, overlay).convert("RGB"))


def ellipse_mask(h, w, ellipse, grow=1.0):
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy, rx, ry = ellipse["cx"], ellipse["cy"], ellipse["rx"] * grow, ellipse["ry"] * grow
    return ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0


def exterior_mask(alpha):
    holes = (alpha < 12).astype(np.uint8)
    flood = holes.copy()
    ff = np.zeros((holes.shape[0] + 2, holes.shape[1] + 2), np.uint8)
    cv2.floodFill(flood, ff, (0, 0), 2)
    return flood == 2


def bbox_of(mask):
    ys, xs = np.where(mask)
    if len(ys) == 0:
        return None
    return int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())


def paint_color(rgb, alpha):
    """Median door colour. Skips the cabin, the tyres, and saturated lamps."""
    opaque = alpha > 180
    box = bbox_of(opaque)
    if box is None:
        return None
    y0, y1, x0, x1 = box
    span_y = max(1, y1 - y0)
    span_x = max(1, x1 - x0)
    band = np.zeros(opaque.shape, bool)
    band[y0 + int(span_y * 0.50) : y0 + int(span_y * 0.78), x0 + int(span_x * 0.12) : x1 - int(span_x * 0.12)] = True
    m = opaque & band
    if m.sum() < 40:
        m = opaque
    pix = rgb[m].astype(np.float32)
    lum = pix.mean(1)
    chroma = pix.max(1) - pix.min(1)
    keep = (lum >= np.percentile(lum, 30)) & (chroma <= np.percentile(chroma, 75) + 6)
    if keep.sum() < 30:
        keep = np.ones(len(pix), bool)
    return np.median(pix[keep], axis=0)


def studio_grade(rgba, wall_rgb):
    """Match highlight chromaticity to the wall, then lift and compress."""
    rgb = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3]
    m = alpha > 180
    if m.sum() < 50:
        return rgba
    pix = rgb[m]
    lum = pix.mean(1)
    chroma = pix.max(1) - pix.min(1)
    hi = (lum >= np.percentile(lum, 72)) & (chroma < 36)
    if hi.sum() < 25:
        hi = lum >= np.percentile(lum, 82)
    illum = np.maximum(np.median(pix[hi], axis=0), 1.0)
    wall = np.asarray(wall_rgb, np.float32)
    target = wall / max(1.0, float(wall.mean())) * float(illum.mean())
    gain = np.clip(target / illum, 0.72, 1.40)
    rgb = rgb * gain
    y = np.clip(rgb / 255.0, 0, 1.6)
    shadow = np.clip(1.0 - y * 1.7, 0, 1)
    y = y + shadow * 0.065
    over = np.maximum(y - 0.78, 0)
    y = y / (1.0 + 0.35 * over)
    y = np.power(np.clip(y, 0, 1), 0.92)
    # Light paint still reads darker than the high-key wall. Lift it,
    # with a shoulder so the brightest panels do not clip to a flat white.
    p90 = float(np.percentile(y[m], 90))
    if p90 > 0.60:
        gain = float(np.clip(0.90 / p90, 1.0, 1.20))
        y = np.clip(y * gain, 0, 1)
        shoulder = np.maximum(y - 0.90, 0)
        y = y - shoulder * 0.40
    out = rgba.copy()
    out[:, :, :3] = np.clip(y * 255.0, 0, 255).astype(np.uint8)
    return out


def glass_mask(rgb, alpha):
    """Cabin glass, including opaque glass that still shows trees or sky."""
    opaque = alpha > 140
    box = bbox_of(opaque)
    if box is None:
        return np.zeros(alpha.shape, bool), None
    y0, y1, x0, x1 = box
    span_y = max(1, y1 - y0)
    span_x = max(1, x1 - x0)
    paint = paint_color(rgb, alpha)
    if paint is None:
        return np.zeros(alpha.shape, bool), None
    cabin = np.zeros(alpha.shape, bool)
    # Stop above the hood. A deeper cabin paints sky reflections on the bonnet as glass.
    cabin[y0 : y0 + int(span_y * 0.47), x0 + int(span_x * 0.03) : x1 - int(span_x * 0.03)] = True
    pix = rgb.astype(np.float32)
    lum = pix.mean(axis=2)
    dist = np.linalg.norm(pix - paint, axis=2)
    lum_dist = np.abs(lum - float(paint.mean()))
    cool = ((pix[:, :, 1] + pix[:, :, 2]) * 0.5 - pix[:, :, 0]) > 4.0
    brighter = lum > float(paint.mean()) + 26.0
    darker = lum + 28.0 < float(paint.mean())
    outside = exterior_mask(alpha)
    holes = (alpha < 80) & ~outside & cabin
    not_paint = opaque & cabin & ((dist > 22.0) | (lum_dist > 34.0)) & (cool | brighter | darker)
    candidate = holes | not_paint
    n, labels, stats, cents = cv2.connectedComponentsWithStats(candidate.astype(np.uint8), 8)
    car_area = max(1, int(opaque.sum()))
    mask = np.zeros(alpha.shape, bool)
    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        cy = float(cents[i][1])
        if area < car_area * 0.008:
            continue
        if cy > y0 + span_y * 0.45:
            continue
        mask[labels == i] = True
    if mask.any():
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        closed = cv2.morphologyEx(mask.astype(np.uint8) * 255, cv2.MORPH_CLOSE, kernel)
        closed = cv2.dilate(closed, np.ones((3, 3), np.uint8), iterations=1)
        mask = (closed > 0) & (alpha > 0) & ~outside
        # The grille and the bumper are dark and neutral. They are not glass.
        yy = np.arange(alpha.shape[0])[:, None]
        lower = yy > (y0 + span_y * 0.48)
        dark_neutral = (lum < 48.0) & (dist < 16.0)
        mask &= ~(lower & dark_neutral)
    return mask, paint


def paint_glass(rgba, mask):
    if not mask.any():
        return rgba
    h, w = rgba.shape[:2]
    ys, xs = np.where(mask)
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    yy, xx = np.mgrid[0:h, 0:w]
    t = (yy - y0) / max(1, y1 - y0)
    top = np.array([14, 18, 24], np.float32)
    bot = np.array([36, 42, 50], np.float32)
    col = top * (1.0 - t[:, :, None]) + bot * t[:, :, None]
    cy = y0 + (y1 - y0) * 0.28
    cx = (x0 + x1) * 0.5
    sy = max(6.0, (y1 - y0) * 0.16)
    sx = max(8.0, (x1 - x0) * 0.28)
    blob = np.exp(-0.5 * (((yy - cy) / sy) ** 2 + ((xx - cx) / sx) ** 2))
    col = col + blob[:, :, None] * np.array([48, 54, 62], np.float32)
    out = rgba.copy()
    out[:, :, :3][mask] = np.clip(col[mask], 0, 255).astype(np.uint8)
    out[:, :, 3][mask] = np.maximum(rgba[:, :, 3][mask], 235)
    return out


def kill_outdoor_cast(rgba, paint, glass):
    """Pull green/blue outdoor reflections on the paint back to the body colour."""
    if paint is None:
        return rgba
    rgb = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3]
    lum = rgb.mean(axis=2, keepdims=True)
    ratio = paint / max(1.0, float(paint.mean()))
    neutral = lum * ratio
    chroma = rgb - lum
    paint_c = paint - float(paint.mean())
    dist = np.linalg.norm(chroma - paint_c, axis=2)
    cool = ((rgb[:, :, 1] + rgb[:, :, 2]) * 0.5 - rgb[:, :, 0]) > 6.0
    w = np.clip((dist - 8.0) / 16.0, 0, 1)
    body = (alpha > 150) & ~glass & cool
    w = w * body
    mixed = rgb * (1.0 - w[:, :, None]) + neutral * w[:, :, None]
    out = rgba.copy()
    out[:, :, :3] = np.clip(mixed, 0, 255).astype(np.uint8)
    return out


def add_softbox(rgba, glass, paint):
    rgb = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3]
    body = (alpha > 150) & ~glass
    box = bbox_of(body)
    if box is None:
        return rgba
    y0, y1, x0, x1 = box
    span = max(1, y1 - y0)
    yy = np.arange(rgba.shape[0])[:, None]
    t = (yy - y0) / float(span)
    shoulder = np.exp(-0.5 * ((t - 0.20) / 0.075) ** 2)
    hood = np.exp(-0.5 * ((t - 0.40) / 0.11) ** 2)
    paint_lum = 160.0 if paint is None else float(np.mean(paint))
    # White paint needs a few levels to read; dark paint needs more.
    gain = 16.0 + (1.0 - paint_lum / 255.0) * 28.0
    add = gain * (0.70 * shoulder + 0.45 * hood)
    add = add * body
    rgb = rgb + add[:, :, None]
    out = rgba.copy()
    out[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return out


def choke(rgba, px=1):
    """Eat 1 px of silhouette and repaint that edge from the interior."""
    alpha = rgba[:, :, 3]
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    eroded = alpha
    for _ in range(max(1, px)):
        eroded = cv2.erode(eroded, kernel, iterations=1)
    out = rgba.copy()
    edge = (eroded > 20) & (cv2.erode((eroded > 20).astype(np.uint8), kernel, iterations=1) == 0)
    if edge.any():
        painted = cv2.inpaint(out[:, :, :3], edge.astype(np.uint8) * 255, 2, cv2.INPAINT_TELEA)
        out[:, :, :3] = painted
    # Hard matte. A partial-alpha rim is the halo.
    out[:, :, 3] = np.where(eroded > 20, 255, 0).astype(np.uint8)
    return out


def relight_cutout(rgba, wall_rgb):
    graded = studio_grade(rgba, wall_rgb)
    rgb = graded[:, :, :3]
    alpha = graded[:, :, 3]
    mask, paint = glass_mask(rgb, alpha)
    graded = kill_outdoor_cast(graded, paint, mask)
    graded = paint_glass(graded, mask)
    graded = add_softbox(graded, mask, paint)
    return graded, mask


def bottom_profile(alpha, thresh=128):
    h, w = alpha.shape
    bottom = np.full(w, -1, np.int32)
    cols = np.where(alpha.max(axis=0) > thresh)[0]
    for x in cols:
        ys = np.where(alpha[:, x] > thresh)[0]
        if len(ys):
            bottom[x] = ys[-1]
    return bottom


def _valley_peaks(bottom, min_dist, prom=10):
    """Local low points of the silhouette (high y), with a real dip on both sides."""
    w = len(bottom)
    xs = np.where(bottom >= 0)[0]
    if len(xs) < 10:
        return []
    filled = np.interp(np.arange(w), xs, bottom[xs].astype(np.float32))
    smooth = np.convolve(filled, np.ones(9) / 9.0, mode="same")
    found = []
    for i in range(14, w - 14):
        if not (smooth[i] >= smooth[i - 1] and smooth[i] >= smooth[i + 1]):
            continue
        left = smooth[max(0, i - 110) : i]
        right = smooth[i + 1 : i + 111]
        if len(left) < 5 or len(right) < 5:
            continue
        prominence = min(float(smooth[i] - left.min()), float(smooth[i] - right.min()))
        if prominence < prom:
            continue
        y = int(bottom[i]) if bottom[i] >= 0 else int(smooth[i])
        found.append([i, y, prominence])
    found.sort(key=lambda item: -item[2])
    kept = []
    for peak in found:
        if all(abs(peak[0] - other[0]) >= min_dist for other in kept):
            kept.append(peak)
    kept.sort()
    return kept


def tire_contacts(alpha):
    """Left and right tyre bottoms.

    Valleys closer than a quarter of the car are the same wheel or a bumper
    lip. Keep the lower of those, then use the outer pair.
    """
    bottom = bottom_profile(alpha, thresh=80)
    w = len(bottom)
    peaks = _valley_peaks(bottom, max(24, int(w * 0.18)), prom=10)
    if len(peaks) < 2:
        xs = np.where(bottom >= 0)[0]
        if len(xs) < 8:
            return [(0, alpha.shape[0] // 2), (w - 1, alpha.shape[0] // 2)]
        return [(int(xs[0]), int(bottom[xs[0]])), (int(xs[-1]), int(bottom[xs[-1]]))]
    merged = []
    for peak in peaks:
        if merged and abs(peak[0] - merged[-1][0]) < w * 0.24:
            if peak[1] > merged[-1][1]:
                merged[-1] = peak
        else:
            merged.append(peak)
    if len(merged) < 2:
        merged = peaks
    left, right = merged[0], merged[-1]
    return [(int(left[0]), int(left[1])), (int(right[0]), int(right[1]))]


def level_tires(rgba):
    """Rotate so the two tyre contacts share a y. PIL's positive angle is the
    direction that lifts a low right-hand tyre (measured, not assumed)."""
    total = 0.0
    prev = 1e9
    for _ in range(3):
        (x0, y0), (x1, y1) = tire_contacts(rgba[:, :, 3])
        dx = float(x1 - x0)
        if abs(dx) < 8:
            break
        ang = float(np.degrees(np.arctan2(y1 - y0, dx)))
        if abs(ang) < 0.2 or abs(ang) > abs(prev) + 0.15:
            break
        prev = ang
        rgba = np.asarray(
            Image.fromarray(rgba, "RGBA").rotate(
                ang, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0)
            )
        )
        total += ang
    return rgba, total


def clip_hanging_shadow(rgba, contacts):
    alpha = rgba[:, :, 3]
    h, w = alpha.shape
    (x0, y0), (x1, y1) = contacts
    if x1 == x0:
        return rgba
    t = (np.arange(w) - x0) / float(x1 - x0)
    line = y0 + t * (y1 - y0)
    out = rgba.copy()
    for x in range(w):
        y_line = int(line[x])
        if y_line < 1 or y_line >= h - 2:
            continue
        col = alpha[:, x]
        if col[min(h - 1, y_line)] < 40:
            out[y_line + 1 :, x, 3] = 0
            continue
        yy = y_line
        while yy + 1 < h and col[yy + 1] > 40:
            yy += 1
        if yy + 1 < h:
            out[yy + 1 :, x, 3] = 0
    return out


def place(plate, car, ground_y, width_frac=0.88):
    """Scale the car and put both tyre bottoms on ground_y."""
    h, w = plate.shape[:2]
    rgba = car
    alpha = rgba[:, :, 3]
    ys, xs = np.where(alpha > 20)
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    rgba = rgba[y0 : y1 + 1, x0 : x1 + 1]
    rgba, angle = level_tires(rgba)
    contacts = tire_contacts(rgba[:, :, 3])
    rgba = clip_hanging_shadow(rgba, contacts)
    contacts = tire_contacts(rgba[:, :, 3])
    ch, cw = rgba.shape[:2]
    scale = (w * width_frac) / float(cw)
    roof_limit = h * 0.15
    tire_y = float(np.mean([c[1] for c in contacts]))
    roof_at = ground_y - (tire_y - 0) * scale
    # roof is y=0 in the trimmed image only if the trim included it.
    # The top of the trimmed image is the roof.
    roof_px = 0.0
    # contacts are in trimmed coords; roof is 0 after the bbox trim above,
    # then level_tires may have added padding. Use the min opaque y.
    opaque_y = np.where(rgba[:, :, 3] > 20)[0]
    roof_px = float(opaque_y.min()) if len(opaque_y) else 0.0
    roof_at = ground_y - (tire_y - roof_px) * scale
    if roof_at < roof_limit and tire_y > roof_px:
        scale *= (ground_y - roof_limit) / max(1.0, ground_y - roof_at)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    resized = np.asarray(Image.fromarray(rgba, "RGBA").resize((nw, nh), Image.Resampling.LANCZOS))
    contacts_s = [(c[0] * scale, c[1] * scale) for c in contacts]
    tire_y = float(np.mean([c[1] for c in contacts_s]))
    left = int(round(w * 0.5 - nw * 0.5))
    top = int(round(ground_y - tire_y))
    layer = np.zeros((h, w, 4), np.uint8)
    src_x0 = max(0, -left)
    src_y0 = max(0, -top)
    dst_x0 = max(0, left)
    dst_y0 = max(0, top)
    src_x1 = min(nw, w - left)
    src_y1 = min(nh, h - top)
    if src_x1 > src_x0 and src_y1 > src_y0:
        layer[dst_y0 : dst_y0 + (src_y1 - src_y0), dst_x0 : dst_x0 + (src_x1 - src_x0)] = resized[
            src_y0:src_y1, src_x0:src_x1
        ]
    placed = [(c[0] + left, c[1] + top) for c in contacts_s]
    return layer, placed, angle


def paint_shadows(plate, contacts, ellipse):
    h, w = plate.shape[:2]
    shade = np.zeros((h, w), np.float32)
    yy, xx = np.mgrid[0:h, 0:w]
    for x, y in contacts:
        # Tight, dark contact just in front of the tread.
        dx = (xx - x) / (w * 0.022)
        dy = (yy - (y + h * 0.004)) / (h * 0.007)
        shade = np.maximum(shade, 0.92 * np.exp(-(dx ** 2 + dy ** 2)))
    if len(contacts) >= 2:
        x0, y0 = contacts[0]
        x1, y1 = contacts[1]
        cx = 0.5 * (x0 + x1)
        cy = 0.5 * (y0 + y1) + h * 0.004
        half = max(40.0, abs(x1 - x0) * 0.62)
        dx = (xx - cx) / half
        dy = (yy - cy) / (h * 0.055)
        shade = np.maximum(shade, 0.42 * np.exp(-(dx ** 2 * 0.85 + dy ** 2)))
    shade = np.clip(shade, 0, 0.90)
    shade *= ellipse_mask(h, w, ellipse, grow=1.02)
    out = plate.astype(np.float32)
    out *= 1.0 - shade[:, :, None]
    return np.clip(out, 0, 255).astype(np.uint8)


def add_reflection(plate, layer, contacts, ellipse):
    """Mirror the whole lower car. No vertical squash. Fade it off the disc."""
    h, w = plate.shape[:2]
    alpha = layer[:, :, 3]
    ys = np.where(alpha > 40)[0]
    if len(ys) < 30:
        return plate
    top = int(ys.min())
    contact_y = int(round(float(np.mean([c[1] for c in contacts]))))
    contact_y = int(np.clip(contact_y, top + 8, h - 2))
    y_cut = top + int((contact_y - top) * 0.38)
    band = layer[y_cut:contact_y]
    if band.shape[0] < 8:
        return plate
    flipped = np.flipud(band)
    nh = flipped.shape[0]
    refl = np.zeros_like(layer)
    y1 = min(h, contact_y + nh)
    refl[contact_y:y1] = flipped[: y1 - contact_y]
    yy = np.arange(h, dtype=np.float32)
    dist = np.clip((yy - contact_y) / max(8.0, float(y1 - contact_y)), 0, 1)
    fade = (1.0 - dist) ** 1.05
    fade[:contact_y] = 0
    inside = ellipse_mask(h, w, ellipse, grow=0.985).astype(np.float32)
    strength = 0.55 * fade[:, None] * inside
    blurred = np.asarray(Image.fromarray(refl, "RGBA").filter(ImageFilter.GaussianBlur(radius=2.6)))
    src = blurred[:, :, :3].astype(np.float32)
    sa = (blurred[:, :, 3].astype(np.float32) / 255.0) * strength
    out = plate.astype(np.float32)
    out = out * (1.0 - sa[:, :, None]) + src * sa[:, :, None]
    return np.clip(out, 0, 255).astype(np.uint8)


def composite_car(plate_rgb, ellipse, ground_y, cut_path, wall_rgb, debug_path=None):
    car = np.asarray(Image.open(cut_path).convert("RGBA"))
    car, mask = relight_cutout(car, wall_rgb)
    if debug_path:
        os.makedirs(os.path.dirname(debug_path), exist_ok=True)
        vis = car[:, :, :3].copy()
        vis[mask] = (0, 180, 255)
        Image.fromarray(vis, "RGB").save(debug_path, quality=85)
    layer, contacts, angle = place(plate_rgb, car, ground_y)
    # Choke after the rotate and the resize, so the matte has no black fringe.
    layer = choke(layer, px=1)
    out = paint_shadows(plate_rgb, contacts, ellipse)
    out = add_reflection(out, layer, contacts, ellipse)
    base = Image.fromarray(out, "RGB").convert("RGBA")
    over = Image.fromarray(layer, "RGBA")
    merged = np.asarray(Image.alpha_composite(base, over).convert("RGB"))
    return merged, contacts, angle, float(mask.mean())


def add_mark(rgb):
    h, w = rgb.shape[:2]
    mark = wordmark((32, 36, 42, 255), (70, 74, 80, 255), int(w * 0.052))
    max_w = int(w * 0.20)
    if mark.width > max_w:
        nh = int(mark.height * max_w / mark.width)
        mark = mark.resize((max_w, nh), Image.Resampling.LANCZOS)
    im = Image.fromarray(rgb, "RGB").convert("RGBA")
    im.alpha_composite(mark, ((w - mark.width) // 2, int(h * 0.035)))
    return np.asarray(im.convert("RGB"))


def prepare_plate(meta_plate, oidn):
    rgb = np.asarray(Image.open(meta_plate["file"]).convert("RGB"))
    rgb = smooth_plate(rgb, oidn)
    h, w = rgb.shape[:2]
    inside = ellipse_mask(h, w, meta_plate["ellipse"], grow=0.985)
    rgb = rgb.astype(np.float32)
    rgb[inside] *= 0.96
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    width = max(4, int(round(h * 0.006)))
    rgb = stroke_circle(rgb, meta_plate["ellipse"], width)
    wall = rgb[: int(h * 0.12), int(w * 0.2) : int(w * 0.8)].mean(axis=(0, 1))
    return rgb, wall


def main():
    plate_dir = sys.argv[1] if len(sys.argv) > 1 else "/tmp/gm-spyne13"
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "/tmp/gm-spyne13/out"
    os.makedirs(out_dir, exist_ok=True)
    meta = json.load(open(os.path.join(plate_dir, "plates.json")))
    oidn = find_oidn()
    print("oidn", oidn)
    jobs = [
        ("rav4-front", "/tmp/gm-proof2/rav4-front-cut.png", "h070"),
        ("rav4-side", "/tmp/gm-proof2/rav4-side-cut.png", "h140"),
        ("rav4-rear", "/tmp/gm-proof2/rav4-rear-cut.png", "h070"),
        ("accord-grey", "/tmp/gm-cars/accord-grey-cut.png", "h070"),
        ("camry-black", "/tmp/gm-cars/camry-black-cut.png", "h070"),
    ]
    prepared = {}
    results = []
    for name, cut, key in jobs:
        if not os.path.isfile(cut):
            print("missing cut", cut)
            continue
        if key not in meta["plates"]:
            key = next(iter(meta["plates"]))
        if key not in prepared:
            prepared[key] = prepare_plate(meta["plates"][key], oidn)
        plate, wall = prepared[key]
        info = meta["plates"][key]
        ellipse = info["ellipse"]
        ground_y = ellipse["cy"] + ellipse["ry"] * 0.42
        ground_y = min(ground_y, ellipse["cy"] + ellipse["ry"] - plate.shape[0] * 0.055)
        debug = os.path.join(out_dir, "debug", f"{name}-glass.jpg")
        merged, contacts, angle, glass_frac = composite_car(
            plate, ellipse, ground_y, cut, wall, debug_path=debug
        )
        merged = add_mark(merged)
        path = os.path.join(out_dir, f"{name}.jpg")
        Image.fromarray(merged, "RGB").save(path, "JPEG", quality=92, subsampling=1)
        h, w = merged.shape[:2]
        ys, xs = np.where(np.asarray(Image.open(cut).convert("RGBA"))[:, :, 3] > 20)
        # width from the placed alpha: recompute from how much of the row is car-coloured
        print(
            "wrote",
            path,
            merged.shape,
            "tires",
            [(round(c[0] / w, 3), round(c[1] / h, 3)) for c in contacts],
            "dYpx",
            round(contacts[0][1] - contacts[1][1], 2),
            "rot",
            round(angle, 2),
            "glass",
            round(glass_frac, 4),
            "wall",
            [round(float(c), 1) for c in wall],
        )
        results.append(path)
    return results


if __name__ == "__main__":
    main()
