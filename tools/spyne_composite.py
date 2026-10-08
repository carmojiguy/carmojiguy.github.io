#!/usr/bin/env python3
"""Composite a BiRefNet cutout onto a Cycles turntable plate.

Proof only. It does not touch the live app and it does not call a paid API.

Order:
  - denoise the plate with standalone OIDN when the binary is present
  - draw one constant-width turntable circle
  - keep only the subject car: BiRefNet intersected with its part masks
  - smooth the lower silhouette and strip a bright edge fringe
  - put the wheel-mask bottoms on the floor
  - take low-frequency shading from a local IC-Light fbc pass
  - segment windows with a car-parts model and blend a smoky tint
  - choke the silhouette by 1 px
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


def _parts_model():
    """YOLO26 car-parts segmenter. Glass classes come from the model, not from brightness."""
    global _PARTS
    if _PARTS is not None:
        return _PARTS
    import urllib.request
    dest = "/tmp/gm-models/parts_segmentation.pt"
    os.makedirs("/tmp/gm-models", exist_ok=True)
    if not os.path.isfile(dest) or os.path.getsize(dest) < 1_000_000:
        url = "https://huggingface.co/mitbersh/car-parts-segmentation/resolve/main/parts_segmentation.pt"
        print("  downloading car-parts weights")
        urllib.request.urlretrieve(url, dest)
    from ultralytics import YOLO
    _PARTS = YOLO(dest)
    return _PARTS


_PARTS = None


def _fill_poly(h, w, poly):
    layer = np.zeros((h, w), np.uint8)
    if poly is None or len(poly) < 3:
        return layer
    cv2.fillPoly(layer, [np.asarray(poly, np.int32)], 255)
    return layer


def glass_mask(rgb, alpha):
    """Windshield, side windows, quarter windows and rear glass from a car-parts model.

    The weights are mitbersh/car-parts-segmentation (YOLO26-s, 33 classes,
    including windshield, front-window, back-window and back-windshield).
    Roof, hood and mirror predictions from the same model are subtracted so
    the glass cannot cover those parts. There is no brightness test.
    """
    h, w = rgb.shape[:2]
    empty = np.zeros((h, w), bool)
    opaque = alpha > 80
    if int(opaque.sum()) < 500:
        return empty
    # The segmenter expects a car on a background, not a transparent cutout.
    plate = np.full((h, w, 3), 224, np.uint8)
    a = (alpha.astype(np.float32) / 255.0)[:, :, None]
    plate = (rgb.astype(np.float32) * a + plate.astype(np.float32) * (1.0 - a)).astype(np.uint8)
    model = _parts_model()
    res = model.predict(plate, conf=0.40, imgsz=768, verbose=False, retina_masks=True)[0]
    if res.masks is None or res.boxes is None or len(res.boxes) == 0:
        print("  window model found nothing")
        return empty
    glass = np.zeros((h, w), np.uint8)
    block = np.zeros((h, w), np.uint8)
    names = []
    for i, cls in enumerate(res.boxes.cls.cpu().numpy().astype(int)):
        name = str(model.names[int(cls)]).lower()
        conf = float(res.boxes.conf[i])
        layer = _fill_poly(h, w, res.masks.xy[i])
        if any(k in name for k in ("window", "windshield", "glass")):
            glass = np.maximum(glass, layer)
            names.append(f"{name}:{conf:.2f}")
        elif any(k in name for k in ("roof", "hood", "mirror", "fender")):
            block = np.maximum(block, layer)
    glass[block > 0] = 0
    glass[alpha < 80] = 0
    mask = glass > 0
    car = max(1, int((alpha > 140).sum()))
    frac = float(mask.sum()) / car
    print("  window model", ", ".join(names), "frac", round(frac, 4))
    if frac > 0.32:
        print("  window model rejected, area", round(frac, 3))
        return empty
    return mask


def blend_glass(rgba, original, mask):
    """Smoky studio tint. Keeps a little of the dark interior, kills sky and trees.

    The mask edge is feathered by about 1–2 px. The fill is a vertical
    gradient plus one soft streak, mixed with roughly 16% of the original
    glass after its highlights have been crushed.
    """
    if mask is None or not np.any(mask):
        return rgba
    h, w = rgba.shape[:2]
    soft = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 1.15)
    soft = np.clip(soft, 0, 1)
    ys, xs = np.where(mask)
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    yy = np.arange(h, dtype=np.float32)[:, None]
    xx = np.arange(w, dtype=np.float32)[None, :]
    t = np.clip((yy - y0) / max(1.0, float(y1 - y0)), 0, 1)
    u = np.clip((xx - x0) / max(1.0, float(x1 - x0)), 0, 1)
    top = np.array([14, 18, 24], np.float32)
    bot = np.array([34, 40, 48], np.float32)
    tint = top * (1.0 - t[:, :, None]) + bot * t[:, :, None]
    streak = np.exp(-0.5 * ((t - 0.30) / 0.14) ** 2) * np.exp(-0.5 * ((u - 0.48) / 0.42) ** 2)
    tint = tint + streak[:, :, None] * np.array([42, 48, 56], np.float32)
    orig = original[:, :, :3].astype(np.float32)
    lum = orig.mean(axis=2, keepdims=True) / 255.0
    crush = lum / (1.0 + 3.4 * np.maximum(lum - 0.22, 0))
    detail = orig * (crush / np.maximum(lum, 1e-3))
    mixed = tint * 0.84 + detail * 0.16
    base = rgba[:, :, :3].astype(np.float32)
    a = soft[:, :, None]
    out = base * (1.0 - a) + mixed * a
    rgba = rgba.copy()
    rgba[:, :, :3] = np.clip(out, 0, 255).astype(np.uint8)
    rgba[:, :, 3] = np.maximum(rgba[:, :, 3], np.clip(soft * 255.0, 0, 255).astype(np.uint8))
    return rgba


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


def _part_layers(rgb, alpha, conf):
    """Part masks from the car-parts model. The cutout is composited on grey first."""
    h, w = rgb.shape[:2]
    if int((alpha > 40).sum()) < 500:
        return []
    plate = np.full((h, w, 3), 224, np.uint8)
    a = (alpha.astype(np.float32) / 255.0)[:, :, None]
    plate = (rgb.astype(np.float32) * a + plate.astype(np.float32) * (1.0 - a)).astype(np.uint8)
    model = _parts_model()
    res = model.predict(plate, conf=conf, imgsz=768, verbose=False, retina_masks=True)[0]
    if res.masks is None or res.boxes is None or len(res.boxes) == 0:
        return []
    layers = []
    for i, cls in enumerate(res.boxes.cls.cpu().numpy().astype(int)):
        name = str(model.names[int(cls)]).lower()
        poly = res.masks.xy[i]
        layer = _fill_poly(h, w, poly)
        x0, y0, x1, y1 = [float(v) for v in res.boxes.xyxy[i].cpu().numpy()]
        layers.append((name, float(res.boxes.conf[i]), layer, y0, y1, x0, x1))
    return layers


def keep_subject(rgba):
    """Keep the subject car. Intersect BiRefNet with that car's parts.

    The subject is the part cluster of the car in frame. When a second roof
    sits well above that cluster (the hatchback parked behind the Camry),
    that roof is not part of the subject. Alpha outside the dilated subject
    is cleared, including the other car's windows, spoiler and the white
    stripe. A car with one roof is left intact apart from distant specks.
    """
    alpha = rgba[:, :, 3]
    h, w = alpha.shape
    layers = _part_layers(rgba[:, :, :3], alpha, conf=0.25)
    if not layers:
        print("  subject parts: none, matte unchanged")
        return rgba
    roofs = [item for item in layers if item[0] == "roof"]
    wheels = np.zeros((h, w), np.uint8)
    for name, conf, layer, y0, y1, x0, x1 in layers:
        if "wheel" in name:
            wheels = np.maximum(wheels, layer)
    foreign = np.zeros((h, w), np.uint8)
    if len(roofs) >= 2:
        lowest = max(item[3] for item in roofs)
        gap = max(40.0, 0.04 * h)
        for name, conf, layer, y0, y1, x0, x1 in roofs:
            if lowest - y0 > gap:
                foreign = np.maximum(foreign, layer)
                print("  foreign roof", round(y0, 1), "below the subject roof", round(lowest, 1))
    subject = np.zeros((h, w), np.uint8)
    for name, conf, layer, y0, y1, x0, x1 in layers:
        if foreign is not None and np.array_equal(layer, foreign):
            continue
        # A roof already copied into `foreign` still has its own layer object.
        if len(roofs) >= 2 and name == "roof":
            lowest = max(item[3] for item in roofs)
            if lowest - y0 > max(40.0, 0.04 * h):
                continue
        subject = np.maximum(subject, layer)
    if int(subject.sum()) < 500:
        print("  subject parts empty, matte unchanged")
        return rgba
    n, lab, stats, _ = cv2.connectedComponentsWithStats((subject > 0).astype(np.uint8), 8)
    if n > 2:
        areas = stats[1:, cv2.CC_STAT_AREA]
        keep = 1 + int(np.argmax(areas))
        # A wheel that does not touch the body mask is its own component.
        # Dropping it punches a hole through the arch. Wheels always stay.
        kept = lab == keep
        for i in range(1, n):
            if i == keep:
                continue
            comp = lab == i
            if wheels is not None and np.any(comp & (wheels > 0)):
                kept |= comp
        subject = np.where(kept, subject, 0).astype(np.uint8)
    subject = np.maximum(subject, wheels)
    rad = max(10, int(round(w * 0.014)))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (rad * 2 + 1, rad * 2 + 1))
    dil = cv2.dilate(subject, kernel)
    if int(foreign.max()) > 0:
        top = np.full(w, np.nan, np.float32)
        cols = np.where(subject.max(axis=0) > 0)[0]
        for x in cols:
            ys = np.where(subject[:, x] > 0)[0]
            if len(ys):
                top[x] = float(ys[0])
        known = np.where(~np.isnan(top))[0]
        if len(known) > 8:
            filled = np.interp(np.arange(w), known, top[known])
            roof_line = np.convolve(filled, np.ones(41, np.float32) / 41.0, mode="same")
            margin = max(6.0, 0.008 * h)
            yy = np.arange(h, dtype=np.float32)[:, None]
            dil[yy < (roof_line[None, :] - margin)] = 0
    keep = dil > 0
    removed = int(((alpha > 20) & ~keep).sum())
    out = rgba.copy()
    out[~keep, 3] = 0
    out[out[:, :, 3] < 8, :3] = 0
    print("  subject intersect removed", removed, "px, dilate", rad)
    return out


def _contour_average(pts, win):
    pad = win // 2
    kernel = np.ones(win, np.float32) / float(win)
    xs = np.concatenate([pts[-pad:, 0], pts[:, 0], pts[:pad, 0]])
    ys = np.concatenate([pts[-pad:, 1], pts[:, 1], pts[:pad, 1]])
    sx = np.convolve(xs, kernel, mode="valid")
    sy = np.convolve(ys, kernel, mode="valid")
    return np.stack([sx, sy], axis=1)


def smooth_silhouette(rgba):
    """Round the outer contour. The lower body uses a wider average than the roof.

    The roof stays on the short window so the crown is not pulled flat. The
    rocker, the lower doors and the rear corner use a 17-point average so
    3–5 px stairs disappear. New edge pixels take the interior colour. They
    are not inpainted, because the transparent pixels still hold the white lot.
    """
    alpha = rgba[:, :, 3]
    h, w = alpha.shape
    solid = (alpha > 140).astype(np.uint8)
    ff = (solid == 0).astype(np.uint8).copy()
    flood_mask = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(ff, flood_mask, (0, 0), 2)
    car = (ff != 2).astype(np.uint8)
    if int(car.sum()) < 500:
        return rgba
    cnts, _ = cv2.findContours(car, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
    if not cnts:
        return rgba
    cnt = max(cnts, key=cv2.contourArea)
    pts = cnt[:, 0, :].astype(np.float32)
    if len(pts) < 48:
        return rgba
    high = _contour_average(pts, 9)
    low = _contour_average(pts, 17)
    box = bbox_of(car > 0)
    y0, y1 = (0, h) if box is None else (box[0], box[1])
    span = max(1.0, float(y1 - y0))
    t = np.clip((pts[:, 1] - (y0 + 0.52 * span)) / (0.12 * span), 0.0, 1.0)
    smooth = (high * (1.0 - t)[:, None] + low * t[:, None]).astype(np.int32)
    mask = np.zeros((h, w), np.uint8)
    cv2.fillPoly(mask, [smooth], 255)
    soft = cv2.GaussianBlur(mask, (0, 0), 0.8)
    rgb = rgba[:, :, :3].astype(np.float32)
    interior = cv2.erode((alpha > 160).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=2)
    weight = interior.astype(np.float32)
    color = cv2.GaussianBlur(rgb * weight[:, :, None], (0, 0), 2.0)
    den = cv2.GaussianBlur(weight, (0, 0), 2.0)
    color = color / np.maximum(den[:, :, None], 1e-3)
    new_edge = (soft > 20) & (alpha < 40)
    rgb_out = rgb.copy()
    if new_edge.any():
        rgb_out[new_edge] = color[new_edge]
    out = rgba.copy()
    out[:, :, :3] = np.clip(rgb_out, 0, 255).astype(np.uint8)
    out[:, :, 3] = soft
    out[soft < 8, :3] = 0
    return out


def defringe(rgba):
    """Replace a bright halo on the outer 3 px with the colour just inside.

    White paint is already close to its interior, so it is left alone. The
    white speckles on the RAV4's black cladding are not.
    """
    alpha = rgba[:, :, 3]
    rgb = rgba[:, :, :3].astype(np.float32)
    interior = cv2.erode((alpha > 180).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=2)
    weight = interior.astype(np.float32)
    num = cv2.GaussianBlur(rgb * weight[:, :, None], (0, 0), 2.2)
    den = cv2.GaussianBlur(weight, (0, 0), 2.2)
    color = num / np.maximum(den[:, :, None], 1e-3)
    dist = cv2.distanceTransform((interior == 0).astype(np.uint8), cv2.DIST_L2, 3)
    band = (alpha > 8) & (dist > 0) & (dist < 5.0)
    lum_e = rgb.mean(axis=2)
    lum_i = color.mean(axis=2)
    hot = band & (lum_e > lum_i + 26.0) & (lum_e > 150.0)
    out = rgba.copy()
    if hot.any():
        painted = rgb.copy()
        painted[hot] = color[hot]
        out[:, :, :3] = np.clip(painted, 0, 255).astype(np.uint8)
    print("  defringe", int(hot.sum()))
    return out


def _biref_session():
    global _BIREF
    if _BIREF is not None:
        return _BIREF
    from rembg import new_session
    _BIREF = new_session("birefnet-general-lite")
    return _BIREF


_BIREF = None


def recut_biref(src_path, fallback):
    """BiRefNet at a longer side of about 2000. Keep the old cut if it disagrees."""
    if not src_path or not os.path.isfile(src_path):
        return fallback
    from rembg import remove
    src = Image.open(src_path).convert("RGB")
    scale = 2000.0 / float(max(src.size))
    if scale < 1.0:
        src_in = src.resize((int(src.width * scale), int(src.height * scale)), Image.Resampling.LANCZOS)
    else:
        src_in = src
    cut = remove(src_in, session=_biref_session()).convert("RGBA")
    new = np.asarray(cut)
    old = fallback
    def core(arr):
        a = arr[:, :, 3] > 140
        if int(a.sum()) < 800:
            return None
        pix = arr[:, :, :3][a].astype(np.float32)
        return float(pix.mean()), int(a.sum())
    cn, co = core(new), core(old)
    if cn is None or co is None:
        print("  biref empty, kept the old cut")
        return old
    if abs(cn[0] - co[0]) > 45:
        print("  biref paint", round(cn[0], 1), "vs old", round(co[0], 1), "- kept the old cut")
        return old
    print("  biref recut", cut.size, "mean", round(cn[0], 1))
    return new


def relight_paint(rgba, glass, paint):
    """Compress outdoor shading on the paint. Glass, lamps and tyres stay.

    High-frequency detail (panel gaps, character lines) is kept. The broad
    sky gradient is pulled toward an even, slightly top-lit body colour.
    """
    rgb = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3]
    h, w = rgb.shape[:2]
    protect = cv2.dilate(
        glass.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    ) > 0
    opaque = alpha > 150
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    lamp = opaque & (r > g + 28) & (r > b + 28) & (r > 60) & ~protect
    box = bbox_of(opaque)
    tyre = np.zeros(opaque.shape, bool)
    if box is not None:
        y0, y1, _, _ = box
        span = max(1, y1 - y0)
        yy = np.arange(h)[:, None]
        tyre = (yy > y0 + 0.78 * span) & (rgb.mean(axis=2) < 48) & opaque
    body = opaque & ~protect & ~lamp & ~tyre
    if paint is not None and float(np.mean(paint)) > 150:
        dist = np.linalg.norm(rgb - np.asarray(paint, np.float32).reshape(1, 1, 3), axis=2)
        body = body & ((dist < 78) | (rgb.mean(axis=2) > float(np.mean(paint)) - 45))
    if int(body.sum()) < 120:
        return rgba
    sigma = max(12.0, 0.045 * min(h, w))
    low = cv2.GaussianBlur(rgb, (0, 0), sigma)
    detail = rgb - low
    pv = np.array([40, 40, 42] if paint is None else paint, np.float32)
    lum = float(pv.mean())
    if lum > 160:
        top_c = np.minimum(pv * 1.02 + 3.0, 228)
        bot_c = pv * 0.97
        mix, detail_gain = 0.58, 0.90
    elif lum > 95:
        top_c = np.minimum(pv * 1.04 + 2.0, 200)
        bot_c = pv * 0.93
        mix, detail_gain = 0.68, 0.82
    else:
        top_c = np.clip(pv * 0.55 + 22.0, 18, 42)
        bot_c = np.clip(pv * 0.45 + 10.0, 10, 28)
        mix, detail_gain = 0.84, 0.62
    if box is None:
        t = np.linspace(0, 1, h).astype(np.float32)
    else:
        y0, y1, _, _ = box
        t = np.clip((np.arange(h) - y0) / float(max(1, y1 - y0)), 0, 1).astype(np.float32)
    target = top_c * (1.0 - t)[:, None, None] + bot_c * t[:, None, None]
    out = low * (1.0 - mix) + target * mix + detail * detail_gain
    rgb2 = rgb.copy()
    rgb2[body] = np.clip(out[body], 0, 236)
    rgba = rgba.copy()
    rgba[:, :, :3] = rgb2.astype(np.uint8)
    return rgba


def clean_tail_lamps(rgba):
    """Repaint tail lamps as clean red lenses. Outdoor reflections in the lens go."""
    alpha = rgba[:, :, 3]
    rgb = rgba[:, :, :3]
    h, w = rgb.shape[:2]
    if int((alpha > 80).sum()) < 500:
        return rgba
    plate = np.full((h, w, 3), 224, np.uint8)
    a = (alpha.astype(np.float32) / 255.0)[:, :, None]
    plate = (rgb.astype(np.float32) * a + plate.astype(np.float32) * (1.0 - a)).astype(np.uint8)
    model = _parts_model()
    res = model.predict(plate, conf=0.35, imgsz=768, verbose=False, retina_masks=True)[0]
    if res.masks is None or res.boxes is None:
        return rgba
    lamp = np.zeros((h, w), np.uint8)
    for i, cls in enumerate(res.boxes.cls.cpu().numpy().astype(int)):
        name = str(model.names[int(cls)]).lower()
        if "tail" not in name:
            continue
        lamp = np.maximum(lamp, _fill_poly(h, w, res.masks.xy[i]))
    lamp = cv2.erode(lamp, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3)))
    m = (lamp > 0) & (alpha > 80)
    if int(m.sum()) < 40:
        return rgba
    work = rgb.astype(np.float32)
    lum = work.mean(axis=2)
    detail = (lum - cv2.GaussianBlur(lum, (0, 0), 5))[:, :, None]
    ys, xs = np.where(m)
    y0, y1 = int(ys.min()), int(ys.max())
    t = np.clip((np.arange(h) - y0) / float(max(1, y1 - y0)), 0, 1).astype(np.float32)
    hi = np.array([186, 22, 18], np.float32)
    lo = np.array([118, 12, 12], np.float32)
    col = hi * (1.0 - t)[:, None, None] + lo * t[:, None, None]
    # One soft highlight inside the lens, not a picture of the lot.
    mid = 0.35
    streak = np.exp(-0.5 * ((t - mid) / 0.18) ** 2)
    col = col + streak[:, None, None] * np.array([28, 6, 4], np.float32)
    painted = col + detail * 0.28
    out = rgba.copy()
    out[:, :, :3][m] = np.clip(painted[m], 0, 230).astype(np.uint8)
    print("  tail lamps", int(m.sum()))
    return out


def add_softbox(rgba, glass, paint):
    """One long soft horizontal reflection along the shoulder. Paint only."""
    rgb = rgba[:, :, :3].astype(np.float32)
    body = body_paint(rgb, rgba[:, :, 3], glass, paint)
    box = bbox_of(body)
    if box is None:
        return rgba
    h, w = rgb.shape[:2]
    y0, y1, x0, x1 = box
    belt = np.full(w, -1.0)
    if glass is not None and np.any(glass):
        ys_idx, xs_idx = np.where(glass)
        if len(xs_idx):
            # Bottom of the glass in each column is the shoulder.
            order = np.argsort(xs_idx)
            xs_s = xs_idx[order]
            ys_s = ys_idx[order]
            # last y per x
            # np.maximum.at
            acc = np.full(w, -1, np.int32)
            np.maximum.at(acc, xs_s, ys_s)
            known = np.where(acc >= 0)[0]
            if len(known) > 8:
                belt = np.interp(np.arange(w), known, acc[known].astype(np.float32))
                belt = np.convolve(belt, np.ones(41) / 41.0, mode="same")
    if belt[0] < 0:
        belt[:] = y0 + 0.36 * (y1 - y0)
    yy = np.arange(h)[:, None].astype(np.float32)
    dy = yy - (belt[None, :] + 7.0)
    streak = np.exp(-0.5 * (dy / 8.0) ** 2)
    u = (np.arange(w) - x0) / float(max(1, x1 - x0))
    across = np.exp(-0.5 * ((u - 0.50) / 0.46) ** 2)
    paint_lum = 180.0 if paint is None else float(np.mean(paint))
    gain = 12.0 if paint_lum > 150 else 20.0
    add = (gain * streak * across[None, :]) * body
    rgb = rgb + add[:, :, None]
    out = rgba.copy()
    cap = 236 if paint_lum > 150 else 210
    out[:, :, :3] = np.clip(rgb, 0, cap).astype(np.uint8)
    return out


def choke(rgba, px=1, protect=None):
    """Eat 1 px of fringe. Leave a 1 px soft rim so the roof is not a staircase.

    Wheel pixels are copied back afterwards. The choke cannot open a wheel.
    """
    alpha = rgba[:, :, 3]
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    eroded = alpha
    for _ in range(max(1, px)):
        eroded = cv2.erode(eroded, kernel, iterations=1)
    out = rgba.copy()
    edge = (eroded > 20) & (cv2.erode((eroded > 20).astype(np.uint8), kernel, iterations=1) == 0)
    if protect is not None:
        edge = edge & ~protect
    if edge.any():
        painted = cv2.inpaint(out[:, :, :3], edge.astype(np.uint8) * 255, 2, cv2.INPAINT_TELEA)
        out[:, :, :3] = painted
    soft = cv2.GaussianBlur(eroded, (0, 0), 0.7)
    soft[alpha < 8] = 0
    soft[eroded > 220] = 255
    if protect is not None:
        keep = protect & (alpha > 40)
        soft[keep] = alpha[keep]
        out[keep, :3] = rgba[keep, :3]
    out[:, :, 3] = soft
    return out


def _smooth_known(values, sigma):
    known = np.where(values >= 0)[0]
    if len(known) < 24:
        return values.astype(np.float32)
    filled = np.interp(np.arange(len(values)), known, values[known].astype(np.float32))
    smoothed = cv2.GaussianBlur(filled.reshape(1, -1), (0, 0), sigma).ravel()
    out = values.astype(np.float32)
    out[known] = smoothed[known]
    return out


def smooth_profiles(rgba):
    """Smooth the rocker and the rear corner in image space.

    A short average along the contour follows each stair. The bottom, left
    and right envelopes are smoothed in screen space, and only below the
    belt line, so the roof crown stays where the matte put it.
    """
    alpha = rgba[:, :, 3]
    h, w = alpha.shape
    solid = alpha > 100
    box = bbox_of(solid)
    if box is None:
        return rgba
    y0, y1, x0, x1 = box
    span = max(1.0, float(y1 - y0))
    bot = np.full(w, -1, np.int32)
    left = np.full(h, -1, np.int32)
    right = np.full(h, -1, np.int32)
    for x in range(w):
        ys = np.where(solid[:, x])[0]
        if len(ys):
            bot[x] = int(ys[-1])
    for y in range(h):
        xs = np.where(solid[y])[0]
        if len(xs):
            left[y] = int(xs[0])
            right[y] = int(xs[-1])
    bot_s = _smooth_known(bot, 7.0)
    left_s = _smooth_known(left, 5.5)
    right_s = _smooth_known(right, 5.5)
    out = rgba.copy()
    belt = y0 + 0.56 * span
    for x in range(w):
        if bot[x] < 0 or bot[x] < belt:
            continue
        nb = int(np.clip(round(float(bot_s[x])), 0, h - 1))
        ob = int(bot[x])
        # Cut a stair that sticks out. Do not fill a bite: that is a wheel arch.
        if 0 < ob - nb <= 8:
            out[nb + 1 : ob + 1, x, 3] = 0
            out[nb + 1 : ob + 1, x, :3] = 0
    side_top = y0 + 0.48 * span
    for y in range(int(side_top), h):
        if left[y] >= 0:
            nl = int(np.clip(round(float(left_s[y])), 0, w - 1))
            ol = int(left[y])
            if 0 < nl - ol <= 8:
                out[y, ol:nl, 3] = 0
                out[y, ol:nl, :3] = 0
        if right[y] >= 0:
            nr = int(np.clip(round(float(right_s[y])), 0, w - 1))
            orr = int(right[y])
            if 0 < orr - nr <= 8:
                out[y, nr + 1 : orr + 1, 3] = 0
                out[y, nr + 1 : orr + 1, :3] = 0
    return out


def wheel_labels(rgba, conf=0.25):
    """Instance ids for every wheel the parts model sees. 0 is background."""
    h, w = rgba.shape[:2]
    labels = np.zeros((h, w), np.uint8)
    layers = _part_layers(rgba[:, :, :3], rgba[:, :, 3], conf=conf)
    n = 0
    for name, conf_i, layer, y0, y1, x0, x1 in layers:
        if "wheel" not in name:
            continue
        if int((layer > 0).sum()) < 80:
            continue
        n += 1
        labels[layer > 0] = n
    return labels, n


def restore_wheels(rgba, original, labels):
    """Put the original wheel pixels back. Cleanup is not allowed to eat them."""
    if labels is None or not np.any(labels):
        return rgba
    guard = cv2.dilate((labels > 0).astype(np.uint8), np.ones((3, 3), np.uint8), iterations=1) > 0
    guard &= original[:, :, 3] > 40
    out = rgba.copy()
    out[guard] = original[guard]
    return out


def prepare_matte(rgba):
    """Subject-only matte, then a smooth lower edge and a bright-fringe cleanup.

    Wheel pixels are copied back from the cutout after every cleanup step.
    """
    labels, n_wheels = wheel_labels(rgba)
    original = rgba.copy()
    rgba = keep_subject(rgba)
    rgba = restore_wheels(rgba, original, labels)
    rgba = smooth_silhouette(rgba)
    rgba = restore_wheels(rgba, original, labels)
    rgba = smooth_profiles(rgba)
    rgba = restore_wheels(rgba, original, labels)
    rgba = defringe(rgba)
    rgba = restore_wheels(rgba, original, labels)
    print("  wheels protected", n_wheels)
    return rgba, labels


def relight_cutout(rgba, wall_rgb, original=None, mask=None):
    """Procedural grade. Used only when IC-Light does not return a frame.

    The window mask and the smoky blend are the run 15 formulas.
    """
    if original is None:
        original = rgba.copy()
    if mask is None:
        mask = glass_mask(rgba[:, :, :3], rgba[:, :, 3])
    graded = studio_grade(rgba, wall_rgb)
    paint = paint_color(graded[:, :, :3], graded[:, :, 3])
    graded = kill_outdoor_cast(graded, paint, mask)
    graded = blend_glass(graded, original, mask)
    graded = relight_paint(graded, mask, paint)
    graded = damp_speculars(graded, mask, paint)
    graded = lift_white(graded, mask, paint)
    graded = add_softbox(graded, mask, paint)
    graded = clean_tail_lamps(graded)
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


def _rotate_pair(rgba, side, angle, labels=None):
    rgba = np.asarray(
        Image.fromarray(rgba, "RGBA").rotate(
            angle, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0)
        )
    )
    if side is not None:
        side = np.asarray(
            Image.fromarray(side, "L").rotate(
                angle, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=0
            )
        )
    if labels is not None:
        labels = np.asarray(
            Image.fromarray(labels, "L").rotate(
                angle, resample=Image.Resampling.NEAREST, expand=True, fillcolor=0
            )
        )
    return rgba, side, labels


def wheel_contacts(rgba):
    """Bottoms of the outer two wheel masks. None when the model sees fewer than two."""
    layers = _part_layers(rgba[:, :, :3], rgba[:, :, 3], conf=0.35)
    wheels = []
    alpha = rgba[:, :, 3]
    for name, conf, layer, y0, y1, x0, x1 in layers:
        if "wheel" not in name:
            continue
        m = (layer > 0) & (alpha > 40)
        if int(m.sum()) < 80:
            continue
        ys, xs = np.where(m)
        yb = int(ys.max())
        low = ys >= yb - 4
        xb = int(np.median(xs[low])) if low.any() else int(np.median(xs))
        wheels.append((xb, yb, int(m.sum())))
    if len(wheels) < 2:
        return None
    wheels.sort(key=lambda item: -item[2])
    big = [item for item in wheels if item[2] > wheels[0][2] * 0.25]
    if len(big) < 2:
        return None
    big.sort()
    left, right = big[0], big[-1]
    if abs(left[0] - right[0]) < rgba.shape[1] * 0.18:
        return None
    return [(int(left[0]), int(left[1])), (int(right[0]), int(right[1]))]


def contacts_of(rgba):
    found = wheel_contacts(rgba)
    if found is not None:
        return found, "wheel"
    return tire_contacts(rgba[:, :, 3]), "silhouette"


def level_tires(rgba, side=None, labels=None):
    """Rotate so the two tyre contacts share a y. Wheel-mask bottoms win."""
    total = 0.0
    prev = 1e9
    source = "silhouette"
    for _ in range(3):
        contacts, source = contacts_of(rgba)
        (x0, y0), (x1, y1) = contacts
        dx = float(x1 - x0)
        if abs(dx) < 8:
            break
        ang = float(np.degrees(np.arctan2(y1 - y0, dx)))
        if abs(ang) < 0.2 or abs(ang) > abs(prev) + 0.15:
            break
        prev = ang
        rgba, side, labels = _rotate_pair(rgba, side, ang, labels)
        total += ang
    contacts, source = contacts_of(rgba)
    return rgba, total, contacts, source, side, labels


def clip_hanging_shadow(rgba, contacts, protect=None):
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
    if protect is not None:
        keep = protect & (rgba[:, :, 3] > 40)
        out[keep] = rgba[keep]
    return out


def _paste(canvas, image, left, top):
    h, w = canvas.shape[:2]
    ih, iw = image.shape[:2]
    src_x0 = max(0, -left)
    src_y0 = max(0, -top)
    dst_x0 = max(0, left)
    dst_y0 = max(0, top)
    src_x1 = min(iw, w - left)
    src_y1 = min(ih, h - top)
    if src_x1 > src_x0 and src_y1 > src_y0:
        canvas[dst_y0 : dst_y0 + (src_y1 - src_y0), dst_x0 : dst_x0 + (src_x1 - src_x0)] = image[
            src_y0:src_y1, src_x0:src_x1
        ]
    return canvas


def place(plate, car, ground_y, width_frac=0.88, extra=None, labels=None):
    """Scale the car and put both tyre bottoms on ground_y.

    `extra` is an optional mask (glass). `labels` are wheel instance ids.
    Both follow the same trim, rotate and scale. Labels use nearest sampling.
    """
    h, w = plate.shape[:2]
    rgba = car
    alpha = rgba[:, :, 3]
    empty_labels = np.zeros((h, w), np.uint8)
    ys, xs = np.where(alpha > 20)
    if len(ys) < 10:
        empty = np.zeros((h, w, 4), np.uint8)
        mask = np.zeros((h, w), bool)
        return empty, [(0, h // 2), (w - 1, h // 2)], 0.0, "none", mask, empty_labels, 1.0, 0
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    rgba = rgba[y0 : y1 + 1, x0 : x1 + 1]
    side = None
    if extra is not None:
        side = (extra[y0 : y1 + 1, x0 : x1 + 1].astype(np.uint8) * 255)
    lab = None
    if labels is not None:
        lab = labels[y0 : y1 + 1, x0 : x1 + 1].astype(np.uint8)
    rgba, angle, contacts, source, side, lab = level_tires(rgba, side, lab)
    rgba = clip_hanging_shadow(rgba, contacts, protect=(lab > 0) if lab is not None else None)
    contacts, source = contacts_of(rgba)
    ch, cw = rgba.shape[:2]
    pre_area = int((rgba[:, :, 3] > 128).sum())
    scale = (w * width_frac) / float(cw)
    roof_limit = h * 0.15
    tire_y = float(np.mean([c[1] for c in contacts]))
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
    layer = _paste(layer, resized, left, top)
    mask = np.zeros((h, w), np.uint8)
    if side is not None:
        side_r = np.asarray(Image.fromarray(side, "L").resize((nw, nh), Image.Resampling.BILINEAR))
        mask = _paste(mask, side_r, left, top)
    placed_labels = np.zeros((h, w), np.uint8)
    if lab is not None:
        lab_r = np.asarray(Image.fromarray(lab, "L").resize((nw, nh), Image.Resampling.NEAREST))
        placed_labels = _paste(placed_labels, lab_r, left, top)
    placed = [(c[0] + left, c[1] + top) for c in contacts_s]
    print("  contacts", source, [(round(c[0], 1), round(c[1], 1)) for c in placed], "scale", round(scale, 3))
    return layer, placed, angle, source, mask > 40, placed_labels, float(scale), pre_area


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


def apply_low_freq(orig_rgb, alpha, ic_rgb):
    """Move only the broad lighting of the IC-Light result onto the original pixels.

    Badges, grille, wheels, text and the plate stay in the original detail.
    The ratio is clamped so a dark tyre cannot blow out.
    """
    h, w = orig_rgb.shape[:2]
    ic = np.asarray(Image.fromarray(ic_rgb, "RGB").resize((w, h), Image.Resampling.LANCZOS)).astype(np.float32)
    orig = orig_rgb.astype(np.float32)
    sigma = max(22.0, 0.04 * min(h, w))
    weight = (alpha.astype(np.float32) / 255.0)[:, :, None]

    def low(rgb):
        num = cv2.GaussianBlur(rgb * weight, (0, 0), sigma)
        den = cv2.GaussianBlur(np.squeeze(weight, axis=2), (0, 0), sigma)[:, :, None]
        return num / np.maximum(den, 1e-3)

    ratio = low(ic) / np.maximum(low(orig), 6.0)
    ratio = np.clip(ratio, 0.42, 1.85)
    out = orig * ratio
    deep = orig.mean(axis=2) < 32.0
    out[deep] = orig[deep] * 0.8 + out[deep] * 0.2
    return np.clip(out, 0, 255).astype(np.uint8)


def _on_grey(layer):
    rgb = layer[:, :, :3].astype(np.float32)
    a = (layer[:, :, 3].astype(np.float32) / 255.0)[:, :, None]
    return (rgb * a + 127.0 * (1.0 - a)).astype(np.uint8)


def release_models():
    global _PARTS, _BIREF
    _PARTS = None
    _BIREF = None
    import gc
    gc.collect()


def run_iclight_batch(jobs):
    """One CPU process for every car, so the unet is loaded once."""
    if not jobs:
        return {}
    work = "/tmp/gm-r17/ic"
    os.makedirs(work, exist_ok=True)
    spec = []
    found = {}
    for job in jobs:
        d = os.path.join(work, job["name"])
        os.makedirs(d, exist_ok=True)
        fg = os.path.join(d, "fg.png")
        bg = os.path.join(d, "bg.png")
        out = os.path.join(d, "out.png")
        # Reuse a finished CPU render. The matte pass is cheap next to 20 steps.
        if os.path.isfile(out) and os.path.getsize(out) > 10_000 and os.environ.get("GM_IC_RERUN", "") != "1":
            found[job["name"]] = np.asarray(Image.open(out).convert("RGB"))
            print("  reuse", out, found[job["name"]].shape)
            continue
        Image.fromarray(job["fg"], "RGB").save(fg)
        Image.fromarray(job["bg"], "RGB").save(bg)
        spec.append({"name": job["name"], "fg": fg, "bg": bg, "out": out, "seed": job.get("seed", 12345)})
    if not spec:
        return found
    manifest = os.path.join(work, "jobs.json")
    json.dump(spec, open(manifest, "w"))
    cmd = [
        sys.executable,
        os.path.join(ROOT, "tools", "iclight_fbc.py"),
        "--jobs",
        manifest,
        "--steps",
        os.environ.get("GM_IC_STEPS", "20"),
        "--long-side",
        os.environ.get("GM_IC_LONG", "768"),
    ]
    print("ic-light batch", len(spec), "steps", cmd[-3], "long", cmd[-1], flush=True)
    log_path = os.path.join(work, "iclight.log")
    with open(log_path, "w") as log:
        proc = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT, timeout=7200)
    text = open(log_path).read()
    print(text[-4000:])
    if proc.returncode != 0:
        print("ic-light batch failed", proc.returncode)
        return found
    for item in spec:
        if os.path.isfile(item["out"]):
            found[item["name"]] = np.asarray(Image.open(item["out"]).convert("RGB"))
    return found


def finish_with_iclight(layer, placed_original, mask, ic_rgb):
    """Low-frequency IC-Light shading, then the run 15/16 glass on top."""
    out = layer.copy()
    out[:, :, :3] = apply_low_freq(placed_original[:, :, :3], placed_original[:, :, 3], ic_rgb)
    out = blend_glass(out, placed_original, mask)
    out = clean_tail_lamps(out)
    out = cap_white(out)
    return out


def composite_car(plate_rgb, ellipse, ground_y, cut_path, wall_rgb, debug_path=None, src_path=None, ic_rgb=None):
    fallback = np.asarray(Image.open(cut_path).convert("RGBA"))
    car, _wheel_ids = prepare_matte(recut_biref(src_path, fallback))
    original = car.copy()
    mask = glass_mask(car[:, :, :3], car[:, :, 3])
    if debug_path:
        os.makedirs(os.path.dirname(debug_path), exist_ok=True)
        vis = car[:, :, :3].copy()
        vis[mask] = (0, 180, 255)
        Image.fromarray(vis, "RGB").save(debug_path, quality=85)
    layer, contacts, angle, source, mask_l, _labels, _scale, _area = place(plate_rgb, original, ground_y, extra=mask)
    placed_original = layer.copy()
    if ic_rgb is not None:
        print("  ic-light low-frequency transfer")
        layer = finish_with_iclight(layer, placed_original, mask_l, ic_rgb)
        layer = calm_dark_paint(layer)
    else:
        graded, _mask = relight_cutout(car, wall_rgb, original=original, mask=mask)
        layer, contacts, angle, source, mask_l, _labels, _scale, _area = place(
            plate_rgb, graded, ground_y, extra=mask
        )
    # Choke after the rotate and the resize, so the matte has no black fringe.
    layer = choke(layer, px=1)
    layer = cap_white(layer)
    out = paint_shadows(plate_rgb, contacts, ellipse)
    out = add_reflection(out, layer, contacts, ellipse)
    base = Image.fromarray(out, "RGB").convert("RGBA")
    over = Image.fromarray(layer, "RGBA")
    merged = np.asarray(Image.alpha_composite(base, over).convert("RGB"))
    return merged, contacts, angle, float(mask.mean()), placed_original, mask_l


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


def _predict_parts(rgb, conf):
    h, w = rgb.shape[:2]
    model = _parts_model()
    res = model.predict(np.ascontiguousarray(rgb), conf=conf, imgsz=768, verbose=False, retina_masks=True)[0]
    found = []
    if res.masks is None or res.boxes is None:
        return found
    for i, cls in enumerate(res.boxes.cls.cpu().numpy().astype(int)):
        name = str(model.names[int(cls)]).lower()
        layer = _fill_poly(h, w, res.masks.xy[i])
        x0, y0, x1, y1 = [float(v) for v in res.boxes.xyxy[i].cpu().numpy()]
        found.append((name, float(res.boxes.conf[i]), layer, y0, y1, x0, x1))
    return found


def calm_dark_paint(rgba):
    """On a black car, replace branch texture on the hood, the roof and the glass base.

    Door-panel median decides. A white or grey car is left alone. The hood
    becomes the door colour plus one soft streak, not a blur of the branches
    (those branches are bright, so blurring them stays bright). One compact
    emblem at the front of the hood can stay. The blend formula is unchanged.
    """
    alpha = rgba[:, :, 3]
    rgb = rgba[:, :, :3].astype(np.float32)
    if int((alpha > 160).sum()) < 500:
        return rgba
    layers = _part_layers(rgba[:, :, :3], alpha, conf=0.30)
    doors = np.zeros(alpha.shape, np.uint8)
    hood = np.zeros(alpha.shape, np.uint8)
    roof = np.zeros(alpha.shape, np.uint8)
    wind = np.zeros(alpha.shape, np.uint8)
    glass = np.zeros(alpha.shape, np.uint8)
    fender = np.zeros(alpha.shape, np.uint8)
    wheels = np.zeros(alpha.shape, np.uint8)
    lights = np.zeros(alpha.shape, np.uint8)
    for name, conf, layer, y0b, y1b, x0b, x1b in layers:
        if "door" in name:
            doors = np.maximum(doors, layer)
        elif name == "hood":
            hood = np.maximum(hood, layer)
        elif name == "roof":
            roof = np.maximum(roof, layer)
        elif "window" in name or "windshield" in name or "glass" in name:
            glass = np.maximum(glass, layer)
            if name == "windshield":
                wind = np.maximum(wind, layer)
        elif "fender" in name or "quarter" in name:
            fender = np.maximum(fender, layer)
        elif "wheel" in name:
            wheels = np.maximum(wheels, layer)
        elif "light" in name or "grille" in name:
            lights = np.maximum(lights, layer)
    dm = (doors > 0) & (alpha > 80)
    if int(dm.sum()) < 400:
        print("  dark paint skipped, no doors")
        return rgba
    door_med = float(np.median(rgb[dm].mean(axis=1)))
    if door_med > 70.0:
        print("  dark paint skipped, door median", round(door_med, 1))
        return rgba
    dark = dm & (rgb.mean(axis=2) <= door_med + 8.0)
    if int(dark.sum()) < 200:
        dark = dm
    base = np.median(rgb[dark], axis=0).astype(np.float32)
    print("  dark paint base", [round(float(c), 1) for c in base], "door med", round(door_med, 1))
    h, w = alpha.shape
    out = rgb.copy()
    wheel_guard = cv2.dilate(wheels, np.ones((5, 5), np.uint8), iterations=1) > 0
    paint = ((hood > 0) | (fender > 0)) & (alpha > 80) & ~wheel_guard
    if paint.any():
        ys, xs = np.where(paint)
        hy0, hy1 = int(ys.min()), int(ys.max())
        hx0, hx1 = int(xs.min()), int(xs.max())
        t = np.clip((np.arange(h) - hy0) / max(1.0, float(hy1 - hy0)), 0, 1).astype(np.float32)
        u = np.clip((np.arange(w) - hx0) / max(1.0, float(hx1 - hx0)), 0, 1).astype(np.float32)
        streak = np.exp(-0.5 * ((t - 0.22) / 0.14) ** 2)[:, None] * np.exp(-0.5 * ((u - 0.50) / 0.40) ** 2)[None, :]
        soft = base[None, None, :] + (1.0 - t)[:, None, None] * np.array([6.0, 6.0, 8.0])
        soft = soft + streak[:, :, None] * np.array([48.0, 50.0, 56.0])
        soft = np.clip(soft, 0, 120)
        weight = cv2.GaussianBlur(paint.astype(np.float32), (0, 0), 2.2)
        out = out * (1.0 - weight[:, :, None]) + soft * weight[:, :, None]
        lum = rgb.mean(axis=2)
        hm = (hood > 0) & (alpha > 80)
        emblem = (hm & (lum > max(140.0, door_med + 80.0))).astype(np.uint8)
        emblem = cv2.morphologyEx(emblem, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        n, lab, stats, cents = cv2.connectedComponentsWithStats(emblem, 8)
        hys, hxs = np.where(hm)
        if len(hys):
            eh0, eh1 = int(hys.min()), int(hys.max())
            ex0, ex1 = int(hxs.min()), int(hxs.max())
        else:
            eh0, eh1, ex0, ex1 = hy0, hy1, hx0, hx1
        target = np.array([0.5 * (ex0 + ex1), eh1 - 0.15 * max(1, eh1 - eh0)], np.float32)
        reach = 0.42 * max(ex1 - ex0, eh1 - eh0)
        best_i, best_d = -1, 1e9
        for i in range(1, n):
            area = int(stats[i, cv2.CC_STAT_AREA])
            bw = int(stats[i, cv2.CC_STAT_WIDTH])
            bh = int(stats[i, cv2.CC_STAT_HEIGHT])
            if area < 40 or area > 2200:
                continue
            if max(bw, bh) > 3.2 * max(1, min(bw, bh)):
                continue
            dist = float(np.hypot(cents[i][0] - target[0], cents[i][1] - target[1]))
            if dist < best_d:
                best_d, best_i = dist, i
        kept = 0
        if best_i > 0 and best_d < reach:
            keep = lab == best_i
            out[keep] = rgb[keep]
            kept = int(keep.sum())
        print("  hood smoothed", int(paint.sum()), "emblem", kept)
    # The metal above the glass, including a roof the parts model split into
    # a bright blob and left the rest unclaimed.
    roof_col = np.clip(base + np.array([10.0, 10.0, 12.0], np.float32), 0, 96)
    crown = np.zeros(alpha.shape, np.uint8)
    opaque = alpha > 80
    glass_b = glass > 0
    ys_car = np.where(opaque.any(axis=1))[0]
    car_top, car_bot = 0, h - 1
    if len(ys_car):
        car_top = int(ys_car[0])
        car_bot = int(ys_car[-1])
        limit = car_top + int(0.22 * max(1, car_bot - car_top))
        for x in range(w):
            col = np.where(opaque[:, x])[0]
            if len(col) == 0:
                continue
            y_top = int(col[0])
            glass_ys = np.where(glass_b[:, x] & (np.arange(h) > y_top))[0]
            y_stop = int(glass_ys[0]) - 2 if len(glass_ys) else limit
            y_stop = min(y_stop, limit)
            if y_stop > y_top:
                crown[y_top:y_stop, x] = 1
    # Roof-class pixels stay in even where a glass mask overlaps them. A bright
    # cap above the belt is the stripy blob; dark window pixels are below 115.
    lum_now = rgb.mean(axis=2)
    span_c = max(1, car_bot - car_top)
    rows = np.arange(h)[:, None]
    # The strip above the C-pillar sits lower than the roof class and stays
    # bright. Anything that bright on the upper body, other than lamps and
    # glass, is the outdoor reflection.
    chroma = rgb.max(axis=2) - rgb.min(axis=2)
    bright_cap = (
        opaque
        & (rows < car_top + 0.62 * span_c)
        & (lum_now > 145.0)
        & (chroma < 70.0)
        & (hood == 0)
        & (glass == 0)
        & (lights == 0)
        & ~wheel_guard
    )
    crown = ((crown > 0) & (glass == 0)) | (((roof > 0) | bright_cap) & opaque)
    crown &= alpha > 80
    if crown.any():
        weight = cv2.GaussianBlur(crown.astype(np.float32), (0, 0), 3.5)
        weight[alpha < 80] = 0
        out = out * (1.0 - weight[:, :, None]) + roof_col[None, None, :] * weight[:, :, None]
        print("  roof cleared", int(crown.sum()))
    if np.any(wind):
        ys, xs = np.where((wind > 0) & (alpha > 40))
        if len(ys) > 30:
            wy0, wy1 = int(ys.min()), int(ys.max())
            span = max(1, wy1 - wy0)
            rows = np.arange(h)[:, None]
            base_line = wy0 + 0.48 * span
            base_m = (wind > 0) & (rows > base_line) & (alpha > 40)
            t = np.clip((np.arange(h) - base_line) / max(8.0, wy1 - base_line), 0, 1).astype(np.float32)
            col = np.zeros_like(rgb)
            col[:] = np.array([22.0, 26.0, 34.0], np.float32)
            col += t[:, None, None] * np.array([14.0, 16.0, 18.0], np.float32)
            out[base_m] = np.clip(col, 0, 70)[base_m]
            print("  windshield base cleared", int(base_m.sum()))
    result = rgba.copy()
    result[:, :, :3] = np.clip(out, 0, 255).astype(np.uint8)
    return result


def _iou(a, b):
    inter = np.logical_and(a, b).sum()
    union = np.logical_or(a, b).sum()
    return float(inter) / float(max(1, union))


def _hole_fraction(alpha, contacts):
    solid = alpha > 40
    h, w = solid.shape
    bg = (~solid).astype(np.uint8)
    ff = bg.copy()
    flood = np.zeros((h + 2, w + 2), np.uint8)
    cv2.floodFill(ff, flood, (0, 0), 2)
    holes = ff == 1
    if contacts is not None and len(contacts) >= 2:
        x0 = min(contacts[0][0], contacts[1][0])
        x1 = max(contacts[0][0], contacts[1][0])
        y_c = min(contacts[0][1], contacts[1][1])
        span = max(1.0, float(x1 - x0))
        yy, xx = np.mgrid[0:h, 0:w]
        under = (xx > x0 + 0.15 * span) & (xx < x1 - 0.15 * span) & (yy > y_c - int(0.22 * h)) & (yy < y_c + 8)
        holes = holes & ~under
    return float(holes.sum()) / float(max(1, int(solid.sum())))


def _roof_stray(rgb, alpha, wall):
    """Pixels above the car, under the wordmark, that are not the wall.

    The roofline is the top of the subject alpha. Columns that only graze a
    bumper are not the roof, and the turntable beside them is not a second car.
    """
    solid = alpha > 40
    if not solid.any():
        return 10**9
    h, w = alpha.shape
    # The roofline is the top of the car. Columns that only graze a bumper
    # are not the roof, and the turntable beside them is not a second car.
    tops = np.full(w, -1, np.int32)
    for x in range(w):
        ys = np.where(solid[:, x])[0]
        if len(ys):
            tops[x] = int(ys[0])
    reached = tops >= 0
    if int(reached.sum()) < 4:
        return 10**9
    roof_y = float(np.percentile(tops[reached], 12))
    cols = np.where(reached & (tops <= roof_y + 28))[0]
    if len(cols) < 4:
        return 10**9
    wall = np.asarray(wall, np.float32)
    bad_y0, bad_y1, bad_x0, bad_x1 = h, 0, w, 0
    bad = 0
    for x in cols:
        y_roof = int(tops[x])
        y1 = y_roof - 8
        if y1 <= 175:
            continue
        col = rgb[175:y1, x].astype(np.float32)
        if col.size == 0:
            continue
        dev = np.abs(col - wall).sum(axis=1)
        hit = np.where(dev > 36)[0]
        if len(hit) == 0:
            continue
        bad += int(len(hit))
        y_a, y_b = 175 + int(hit[0]), 175 + int(hit[-1])
        bad_y0, bad_y1 = min(bad_y0, y_a), max(bad_y1, y_b)
        bad_x0, bad_x1 = min(bad_x0, x), max(bad_x1, x)
    if bad > 40:
        sample = rgb[bad_y0, bad_x0].astype(int).tolist()
        print("  roof stray", bad, "box", bad_x0, bad_y0, bad_x1, bad_y1, "sample", sample)
    return bad


def qa_frame(rgb, alpha, src_labels, pre_area, scale, wall, contacts):
    """Gates that have to pass before a frame is a final."""
    layers = _predict_parts(rgb, 0.25)
    final = []
    car = alpha > 40
    for name, conf, layer, y0, y1, x0, x1 in layers:
        if "wheel" not in name:
            continue
        m = layer > 0
        if int(m.sum()) < 200:
            continue
        if int((m & car).sum()) < 0.35 * max(1, int(m.sum())):
            continue
        final.append(m)
    # A bumper-corner false wheel, or the contact shadow, is much smaller
    # than either real tyre. Drop those on both sides so the count is the
    # real wheels. The same cut is applied to the source labels.
    def _significant(masks):
        if not masks:
            return []
        biggest = max(int(m.sum()) for m in masks)
        return [m for m in masks if int(m.sum()) >= 0.40 * biggest]

    final = _significant(final)
    src_ids = []
    src_masks = []
    if src_labels is not None and int(src_labels.max()) > 0:
        for i in range(1, int(src_labels.max()) + 1):
            m = src_labels == i
            if int(m.sum()) > 80:
                src_ids.append(i)
                src_masks.append(m)
    keep_src = _significant(src_masks)
    src_ids = [sid for sid, m in zip(src_ids, src_masks) if any(m is k for k in keep_src)]
    ious = []
    used = set()
    for sid in src_ids:
        sm = src_labels == sid
        best, best_j = 0.0, -1
        for j, fm in enumerate(final):
            if j in used:
                continue
            val = _iou(sm, fm)
            if val > best:
                best, best_j = val, j
        if best_j >= 0:
            used.add(best_j)
        ious.append(best)
    wheels_ok = len(src_ids) > 0 and len(src_ids) == len(final) and len(ious) == len(src_ids) and min(ious) > 0.6
    final_area = int((alpha > 128).sum())
    expected = float(pre_area) * float(scale) * float(scale)
    area_err = abs(final_area - expected) / max(1.0, expected)
    area_ok = area_err <= 0.03
    hole_frac = _hole_fraction(alpha, contacts)
    holes_ok = hole_frac < 0.002
    roof_bad = _roof_stray(rgb, alpha, wall)
    roof_ok = roof_bad <= 40
    passed = bool(wheels_ok and area_ok and holes_ok and roof_ok)
    return {
        "pass": passed,
        "wheels": "PASS" if wheels_ok else "FAIL",
        "n_src": len(src_ids),
        "n_final": len(final),
        "min_iou": min(ious) if ious else 0.0,
        "area": "PASS" if area_ok else "FAIL",
        "area_err": area_err,
        "holes": "PASS" if holes_ok else "FAIL",
        "hole_frac": hole_frac,
        "roof": "PASS" if roof_ok else "FAIL",
        "roof_bad": roof_bad,
    }


def main():
    plate_dir = sys.argv[1] if len(sys.argv) > 1 else "/tmp/gm-spyne13"
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "/tmp/gm-spyne13/out"
    os.makedirs(out_dir, exist_ok=True)
    meta = json.load(open(os.path.join(plate_dir, "plates.json")))
    oidn = find_oidn()
    print("oidn", oidn)
    jobs = [
        ("rav4-front", "/tmp/gm-proof2/rav4-front-cut.png", "h070", "/workspace/photos/test-rav4/front.jpg"),
        ("camry-black", "/tmp/gm-cars/camry-black-cut.png", "h070", "/tmp/gm-cars/camry-black-2025.jpg"),
        # The side cutout is the white Prime. The test-rav4 side photo is a different car.
        ("rav4-side", "/tmp/gm-proof2/rav4-side-cut.png", "h140", None),
        ("rav4-rear", "/tmp/gm-proof2/rav4-rear-cut.png", "h070", "/workspace/photos/test-rav4/rear.jpg"),
        ("accord-grey", "/tmp/gm-cars/accord-grey-cut.png", "h070", "/tmp/gm-cars/accord-grey.jpg"),
    ]
    only = os.environ.get("GM_JOBS", "").strip()
    if only:
        want = {part.strip() for part in only.split(",") if part.strip()}
        jobs = [job for job in jobs if job[0] in want]
    prepared = {}
    staged = []
    for name, cut, key, src_path in jobs:
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
        print("stage", name, flush=True)
        fallback = np.asarray(Image.open(cut).convert("RGBA"))
        car, wheel_ids = prepare_matte(recut_biref(src_path, fallback))
        original = car.copy()
        mask = glass_mask(car[:, :, :3], car[:, :, 3])
        debug = os.path.join(out_dir, "debug", f"{name}-glass.jpg")
        os.makedirs(os.path.dirname(debug), exist_ok=True)
        vis = car[:, :, :3].copy()
        vis[mask] = (0, 180, 255)
        Image.fromarray(vis, "RGB").save(debug, quality=85)
        layer, contacts, angle, source, mask_l, placed_labels, scale, pre_area = place(
            plate, original, ground_y, extra=mask, labels=wheel_ids
        )
        staged.append(
            {
                "name": name,
                "plate": plate,
                "wall": wall,
                "ellipse": ellipse,
                "ground_y": ground_y,
                "car": car,
                "original": original,
                "mask": mask,
                "layer": layer,
                "contacts": contacts,
                "angle": angle,
                "source": source,
                "mask_l": mask_l,
                "labels": placed_labels,
                "scale": scale,
                "pre_area": pre_area,
                "wheel_ids": wheel_ids,
            }
        )
    release_models()
    ic_map = {}
    if os.environ.get("GM_ICLIGHT", "1") != "0":
        try:
            ic_map = run_iclight_batch(
                [{"name": item["name"], "fg": _on_grey(item["layer"]), "bg": item["plate"], "seed": 12345} for item in staged]
            )
        except Exception as exc:
            print("ic-light batch exception", type(exc).__name__, exc)
            ic_map = {}
    results = []
    for item in staged:
        name = item["name"]
        ic = ic_map.get(name)
        labels = item["labels"]
        scale = item["scale"]
        pre_area = item["pre_area"]
        if ic is not None:
            print("finish", name, "ic-light", flush=True)
            layer = finish_with_iclight(item["layer"], item["layer"], item["mask_l"], ic)
            contacts, angle = item["contacts"], item["angle"]
        else:
            print("finish", name, "procedural fallback", flush=True)
            graded, _mask = relight_cutout(item["car"], item["wall"], original=item["original"], mask=item["mask"])
            layer, contacts, angle, _source, _mask_l, labels, scale, pre_area = place(
                item["plate"], graded, item["ground_y"], extra=item["mask"], labels=item["wheel_ids"]
            )
        layer = calm_dark_paint(layer)
        layer = choke(layer, px=1, protect=(labels > 0) if labels is not None else None)
        layer = cap_white(layer)
        out = paint_shadows(item["plate"], contacts, item["ellipse"])
        out = add_reflection(out, layer, contacts, item["ellipse"])
        merged = np.asarray(
            Image.alpha_composite(Image.fromarray(out, "RGB").convert("RGBA"), Image.fromarray(layer, "RGBA")).convert("RGB")
        )
        qa = qa_frame(merged, layer[:, :, 3], labels, pre_area, scale, item["wall"], contacts)
        merged = add_mark(merged)
        tag = "PASS" if qa["pass"] else "FAIL"
        path = os.path.join(out_dir, f"{name}.jpg" if qa["pass"] else f"{name}-FAIL.jpg")
        other = os.path.join(out_dir, f"{name}-FAIL.jpg" if qa["pass"] else f"{name}.jpg")
        if os.path.isfile(other):
            os.remove(other)
        Image.fromarray(merged, "RGB").save(path, "JPEG", quality=92, subsampling=1)
        h, w = merged.shape[:2]
        print(
            "wrote",
            path,
            tag,
            merged.shape,
            "tires",
            [(round(c[0] / w, 3), round(c[1] / h, 3)) for c in contacts],
            "dYpx",
            round(contacts[0][1] - contacts[1][1], 2),
            "rot",
            round(angle, 2),
            "glass",
            round(float(item["mask"].mean()), 4),
            "ic",
            ic is not None,
            "wall",
            [round(float(c), 1) for c in item["wall"]],
        )
        qa["name"] = name
        qa["path"] = path
        results.append(qa)
    _write_qa(out_dir, results)
    return results


def _write_qa(out_dir, rows):
    """PASS/FAIL per car. A failed frame is not described as a final."""
    header = f"{'car':<14} {'wheels':<6} {'n':<7} {'minIoU':>7} {'area':<6} {'err':>7} {'holes':<6} {'frac':>8} {'roof':<6} {'bad':>6} {'RESULT'}"
    lines = [header, "-" * len(header)]
    for qa in rows:
        n = f"{qa['n_src']}/{qa['n_final']}"
        lines.append(
            f"{qa['name']:<14} {qa['wheels']:<6} {n:<7} {qa['min_iou']:7.3f} {qa['area']:<6} {qa['area_err']:7.3f} "
            f"{qa['holes']:<6} {qa['hole_frac']:8.4f} {qa['roof']:<6} {qa['roof_bad']:6} {('PASS' if qa['pass'] else 'FAIL')}"
        )
    text = "\n".join(lines) + "\n"
    path = os.path.join(out_dir, "qa-table.txt")
    with open(path, "w") as handle:
        handle.write(text)
    print("\nQA\n" + text + "wrote " + path, flush=True)


if __name__ == "__main__":
    main()
