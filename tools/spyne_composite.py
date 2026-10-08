#!/usr/bin/env python3
"""Composite a BiRefNet cutout onto a Cycles turntable plate.

Proof only. It does not touch the live app and it does not call a paid API.

Order:
  - denoise the plate with standalone OIDN when the binary is present
  - draw one constant-width turntable circle
  - rotate the cutout so the two tyre contacts are level
  - neutralise white balance to the studio wall and lift to high-key
  - replace only real window glass with a dark studio gradient
  - lift light paint toward the wall and lay a soft softbox on the paint
  - on a dark car, damp outdoor speculars instead of guessing at the glass
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
    """Door colour. A bright roof means the paint is the bright cluster.

    The lower door includes black cladding. A single median of that band is
    the cladding, and the white panels then fail every "is this paint" test.
    """
    opaque = alpha > 180
    box = bbox_of(opaque)
    if box is None:
        return None
    y0, y1, x0, x1 = box
    span_y = max(1, y1 - y0)
    span_x = max(1, x1 - x0)
    lum_img = rgb.astype(np.float32).mean(axis=2)
    roof = np.zeros(opaque.shape, bool)
    roof[y0 : y0 + max(2, int(span_y * 0.08)), x0 : x1 + 1] = True
    roof_pix = lum_img[opaque & roof]
    roof_med = float(np.median(roof_pix)) if roof_pix.size > 20 else 0.0
    band = np.zeros(opaque.shape, bool)
    band[y0 + int(span_y * 0.34) : y0 + int(span_y * 0.58), x0 + int(span_x * 0.18) : x1 - int(span_x * 0.18)] = True
    m = opaque & band
    if int(m.sum()) < 40:
        m = opaque
    pix = rgb[m].astype(np.float32)
    lum = pix.mean(1)
    if roof_med >= 165:
        lo = max(120.0, float(np.percentile(lum, 45)))
        hi = float(np.percentile(lum, 90))
        keep = (lum >= lo) & (lum <= hi + 1.0)
    else:
        keep = lum <= np.percentile(lum, 35)
    if int(keep.sum()) < 20:
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
    out = rgba.copy()
    out[:, :, :3] = np.clip(y * 255.0, 0, 255).astype(np.uint8)
    return out


def glass_mask(rgb, alpha):
    """Side windows, windshield and rear glass, following the window opening.

    A column counts only when a bright roof drops into a dark opening and
    the body colour comes back at the beltline. The mask is thrown away when
    the roof is dark, the area is outside 2–25% of the car, the roof or the
    hood is inside it, or a long stretch of glass was missed. Original glass
    is better than a fill that covers the roof.
    """
    opaque = alpha > 140
    h, w = alpha.shape
    empty = np.zeros((h, w), bool)
    box = bbox_of(opaque)
    if box is None:
        return empty
    y0, y1, x0, x1 = box
    span = max(1, y1 - y0)
    lum = rgb.astype(np.float32).mean(axis=2)
    smooth = cv2.GaussianBlur(lum, (1, 5), 0)
    roof_rows = slice(y0, y0 + max(2, int(span * 0.08)))
    roof_sel = opaque[roof_rows, x0 : x1 + 1]
    roof_pix = lum[roof_rows, x0 : x1 + 1][roof_sel]
    roof_med = float(np.median(roof_pix)) if roof_pix.size > 30 else 0.0
    if roof_med < 158:
        print("  window skip dark-roof", round(roof_med, 1))
        return empty

    search_hi = y0 + int(span * 0.50)
    roof_zone_hi = y0 + int(span * 0.20)
    belt_y = np.full(w, -1, np.int32)
    roof_y = np.full(w, -1, np.int32)
    for x in range(x0, x1 + 1):
        ys = np.where(opaque[y0:search_hi, x])[0] + y0
        if ys.size < 16:
            continue
        seg = smooth[ys, x]
        zone = ys <= roof_zone_hi
        if int(zone.sum()) < 4:
            continue
        roof = float(np.percentile(seg[zone], 90))
        if roof < 175:
            continue
        near = np.where(zone & (seg >= roof - 14))[0]
        if near.size < 2:
            continue
        ri = int(near[-1])
        trough = float(seg[ri])
        ti = ri
        end = None
        for j in range(ri + 1, len(seg)):
            if seg[j] < trough:
                trough = float(seg[j])
                ti = j
            if j > ti + 3 and trough < roof - 42 and seg[j] > roof - 28:
                ahead = seg[j : min(len(seg), j + 10)]
                if ahead.size >= 6 and float(np.median(ahead)) > roof - 36:
                    end = j
                    break
        if end is None:
            continue
        length = int(ys[end] - ys[ri])
        if length < int(span * 0.06) or length > int(span * 0.36):
            continue
        belt_y[x] = int(ys[end])
        roof_y[x] = int(ys[ri])

    seeds = np.where(belt_y >= 0)[0]
    if seeds.size < 12:
        print("  window skip few-seeds", int(seeds.size))
        return empty

    belt_s = belt_y.astype(np.float32)
    roof_s = roof_y.astype(np.float32)
    for _ in range(8):
        for x in range(x0 + 2, x1 - 1):
            if belt_y[x] < 0:
                continue
            nb = belt_y[max(x0, x - 14) : min(x1, x + 15)]
            nb = nb[nb >= 0]
            if nb.size < 5:
                continue
            med = float(np.median(nb))
            if belt_y[x] < med - span * 0.06:
                belt_s[x] = med
                rn = roof_y[max(x0, x - 14) : min(x1, x + 15)]
                rn = rn[rn >= 0]
                if rn.size:
                    roof_s[x] = float(np.median(rn))

    xs_known = np.where(belt_s > 0)[0]
    belt_i = np.interp(np.arange(w), xs_known, belt_s[xs_known])
    roof_line = np.interp(np.arange(w), xs_known, roof_s[xs_known])
    raw = np.zeros((h, w), np.uint8)
    seed_set = set(int(v) for v in xs_known.tolist())
    for x in range(int(xs_known[0]), int(xs_known[-1]) + 1):
        prev = xs_known[xs_known <= x]
        nxt = xs_known[xs_known >= x]
        if prev.size == 0 or nxt.size == 0:
            continue
        if int(nxt[0] - prev[-1]) > 80 and x not in seed_set:
            continue
        ry = int(round(roof_line[x])) + 2
        by = int(round(belt_i[x])) - 2
        if by - ry < int(span * 0.05):
            continue
        ry = max(ry, y0 + 2)
        by = min(by, search_hi - 1)
        op = opaque[ry:by, x]
        if int(op.sum()) < 8:
            continue
        med = float(np.median(smooth[ry:by, x][op]))
        below = opaque[by : min(h, by + 8), x]
        if int(below.sum()) < 3:
            continue
        belt_lum = float(np.median(smooth[by : min(h, by + 8), x][below]))
        if med > belt_lum - 22:
            continue
        if med > roof_med - 8:
            continue
        raw[ry:by, x][op] = 255

    if raw.max() == 0:
        print("  window skip empty")
        return empty
    closed = cv2.morphologyEx(raw, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)))
    eroded = cv2.erode((opaque.astype(np.uint8) * 255), np.ones((3, 3), np.uint8), 1)
    closed = cv2.bitwise_and(closed, eroded)
    closed[y0 + int(span * 0.46) :, :] = 0
    n, labels, stats, cents = cv2.connectedComponentsWithStats((closed > 0).astype(np.uint8), 8)
    car = max(1, int(opaque.sum()))
    mask = np.zeros((h, w), bool)
    for i in range(1, n):
        area = int(stats[i, cv2.CC_STAT_AREA])
        top = int(stats[i, cv2.CC_STAT_TOP])
        height = int(stats[i, cv2.CC_STAT_HEIGHT])
        cy = float(cents[i][1])
        if area < car * 0.004 or area > car * 0.20:
            continue
        if top <= y0 + 1:
            continue
        if height < span * 0.05 or height > span * 0.40:
            continue
        if cy > y0 + span * 0.42:
            continue
        comp = labels == i
        if float(np.median(lum[comp])) > roof_med - 10:
            continue
        mask[comp] = True
    frac = float(mask.sum()) / car
    if frac < 0.02 or frac > 0.25 or not mask.any():
        print("  window skip confidence", round(frac, 4))
        return empty
    leak = int(mask[y0 : y0 + max(2, int(span * 0.045)), x0 : x1 + 1].sum())
    if leak > mask.sum() * 0.02:
        print("  window skip roof-leak", leak)
        return empty
    ys, xs = np.where(mask)
    band0, band1 = int(ys.min()), int(ys.max())
    dark_run = 0
    worst = 0
    for x in range(int(xs.min()), int(xs.max()) + 1):
        if mask[:, x].any():
            dark_run = 0
            continue
        op = opaque[band0:band1, x]
        if int(op.sum()) < 8:
            dark_run = 0
            continue
        med = float(np.median(smooth[band0:band1, x][op]))
        if med < roof_med - 50:
            dark_run += 1
            worst = max(worst, dark_run)
        else:
            dark_run = 0
    if worst > 130:
        print("  window skip incomplete", worst)
        return empty
    print(
        "  window ok",
        "frac",
        round(frac, 4),
        "bbox",
        (int(ys.min()), int(ys.max()), int(xs.min()), int(xs.max())),
        "roof",
        round(roof_med, 1),
    )
    return mask


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


def body_paint(rgb, alpha, glass, paint):
    """Painted panels only. Glass, tyres, cladding and lamps stay out."""
    body = (alpha > 160) & ~glass
    if paint is None:
        return body
    pix = rgb.astype(np.float32)
    dist = np.linalg.norm(pix - paint.reshape(1, 1, 3), axis=2)
    lum = pix.mean(axis=2)
    paint_lum = float(np.mean(paint))
    if paint_lum > 140:
        return body & (dist < 58) & (lum > paint_lum - 75)
    return body & (dist < 70) & (lum < paint_lum + 50)


def lift_white(rgba, glass, paint):
    """Bring light paint up near the wall, with a shoulder so it does not clip."""
    if paint is None or float(np.mean(paint)) < 180:
        return rgba
    rgb = rgba[:, :, :3].astype(np.float32)
    body = body_paint(rgb, rgba[:, :, 3], glass, paint)
    if int(body.sum()) < 80:
        return rgba
    lum = rgb.mean(axis=2)
    p90 = float(np.percentile(lum[body], 90))
    target = 228.0
    if p90 >= target - 1:
        return rgba
    gain = float(np.clip(target / max(1.0, p90), 1.0, 1.50))
    out = rgb.copy()
    lifted = rgb[body] * gain
    ll = lifted.mean(axis=1)
    over = np.maximum(ll - 232.0, 0.0)
    lifted = lifted * ((ll - over * 0.75) / np.maximum(ll, 1.0))[:, None]
    out[body] = np.clip(lifted, 0, 240)
    rgba = rgba.copy()
    rgba[:, :, :3] = out.astype(np.uint8)
    return rgba


def damp_speculars(rgba, glass, paint):
    """On a dark car, replace outdoor sparkles with the low-frequency body."""
    if paint is not None and float(np.mean(paint)) > 130:
        return rgba
    rgb = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3]
    blur = cv2.GaussianBlur(rgb, (0, 0), 7)
    lum = rgb.mean(axis=2)
    blum = blur.mean(axis=2)
    spec = (lum > blum + 18) & (lum > 95) & (alpha > 150) & ~glass
    if not spec.any():
        return rgba
    out = rgb.copy()
    out[spec] = blur[spec]
    rgba = rgba.copy()
    rgba[:, :, :3] = np.clip(out, 0, 255).astype(np.uint8)
    return rgba


def add_softbox(rgba, glass, paint):
    """A broad, soft band on the upper paint. It does not touch the glass."""
    rgb = rgba[:, :, :3].astype(np.float32)
    body = body_paint(rgb, rgba[:, :, 3], glass, paint)
    box = bbox_of(body)
    if box is None:
        return rgba
    y0, y1, x0, x1 = box
    span = max(1, y1 - y0)
    width = max(1, x1 - x0)
    yy = np.arange(rgba.shape[0])[:, None]
    xx = np.arange(rgba.shape[1])[None, :]
    t = (yy - y0) / float(span)
    u = (xx - x0) / float(width)
    band = np.exp(-0.5 * ((t - 0.22) / 0.11) ** 2)
    across = np.exp(-0.5 * ((u - 0.42) / 0.40) ** 2)
    paint_lum = 180.0 if paint is None else float(np.mean(paint))
    gain = 8.0 if paint_lum > 140 else 18.0
    add = (gain * band * across) * body
    rgb = rgb + add[:, :, None]
    out = rgba.copy()
    cap = 240 if paint_lum > 140 else 255
    out[:, :, :3] = np.clip(rgb, 0, cap).astype(np.uint8)
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
    # Window shape is measured on the original photo. The grade that follows
    # changes brightness and would move the beltline.
    mask = glass_mask(rgba[:, :, :3], rgba[:, :, 3])
    graded = studio_grade(rgba, wall_rgb)
    paint = paint_color(graded[:, :, :3], graded[:, :, 3])
    graded = kill_outdoor_cast(graded, paint, mask)
    graded = paint_glass(graded, mask)
    graded = damp_speculars(graded, mask, paint)
    graded = lift_white(graded, mask, paint)
    graded = add_softbox(graded, mask, paint)
    graded = cap_white(graded)
    return graded, mask


def cap_white(rgba):
    """Pull clipped neutral highlights back to the wall. Coloured lamps stay."""
    rgb = rgba[:, :, :3].astype(np.float32)
    lum = rgb.mean(axis=2)
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    hot = (lum > 236.0) & (chroma < 16.0) & (rgba[:, :, 3] > 140)
    if not hot.any():
        return rgba
    scale = (232.0 / np.maximum(lum, 1.0))[:, :, None]
    out = rgb.copy()
    out[hot] = rgb[hot] * scale[hot]
    rgba = rgba.copy()
    rgba[:, :, :3] = np.clip(out, 0, 255).astype(np.uint8)
    return rgba


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
    # Lanczos ringing on that resize pushes white paint past the cap.
    layer = choke(layer, px=1)
    layer = cap_white(layer)
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
