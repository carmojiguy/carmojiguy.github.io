#!/usr/bin/env python3
"""Composite a BiRefNet cutout onto a Cycles turntable plate.

This is the free, off-phone half of the studio pipeline. It does not touch
the live app. Plates come from tools/blender_spyne_plate.py.

What it does, in order:
  - smooth the plate (this Blender build cannot denoise)
  - draw one constant-width turntable circle (a physical tube cannot stay
    thin at both the near and far edge)
  - seat the tyres on the projected ground line
  - cut off mask that hangs well below the tyres (lot shadow)
  - contact shadow and a short ambient occlusion at each tyre
  - a flipped, squashed, Fresnel-faded reflection clipped to the disc
  - dark neutral glass only inside real window holes
  - a small G&M wordmark
"""
import importlib.util
import json
import os
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_wordmark():
    path = os.path.join(ROOT, "tools", "render_gm_studio.py")
    spec = importlib.util.spec_from_file_location("render_gm_studio", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.wordmark


wordmark = load_wordmark()


def smooth_plate(rgb):
    """Kill Cycles fireflies without smearing the cove."""
    return cv2.bilateralFilter(rgb, d=7, sigmaColor=18, sigmaSpace=7)


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
    """True outside the car. Window holes stay False."""
    holes = (alpha < 12).astype(np.uint8)
    flood = holes.copy()
    ff = np.zeros((holes.shape[0] + 2, holes.shape[1] + 2), np.uint8)
    cv2.floodFill(flood, ff, (0, 0), 2)
    return flood == 2


def fill_glass(rgba):
    """Dark neutral studio glass, only where the cutout actually has a hole."""
    rgb = rgba[:, :, :3].astype(np.float32)
    alpha = rgba[:, :, 3]
    outside = exterior_mask(alpha)
    # Enclosed holes, plus the soft partial alpha BiRefNet leaves on glass.
    # Glass is the upper cabin only. Low holes are grilles and wheel gaps.
    body = np.where(alpha > 80)
    if len(body[0]) == 0:
        return rgba
    y_top, y_bot = int(body[0].min()), int(body[0].max())
    cabin = np.zeros(alpha.shape, dtype=bool)
    cabin[: y_top + int((y_bot - y_top) * 0.52), :] = True
    hole = (alpha < 80) & ~outside & cabin
    soft = (alpha >= 80) & (alpha < 160) & ~outside & cabin
    if not hole.any() and not soft.any():
        return rgba
    h, w = rgba.shape[:2]
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    # Spyne keeps the glass dark and neutral, a little lighter toward the beltline.
    top = np.array([28, 32, 38], np.float32)
    bot = np.array([58, 62, 68], np.float32)
    grad = np.broadcast_to(top * (1 - yy) + bot * yy, (h, w, 3))
    out = rgba.copy()
    if hole.any():
        out[:, :, :3][hole] = grad[hole]
        out[:, :, 3][hole] = 230
    if soft.any():
        a = (alpha[soft].astype(np.float32) / 255.0)[:, None]
        mixed = rgb[soft] * a + grad[soft] * (1 - a)
        out[:, :, :3][soft] = np.clip(mixed, 0, 255)
        out[:, :, 3][soft] = np.maximum(alpha[soft], 200)
    return out


def defringe(rgba):
    """Pull the dark lot-edge colour off the silhouette."""
    rgb = rgba[:, :, :3].copy()
    alpha = rgba[:, :, 3]
    edge = (alpha > 20) & (alpha < 250)
    if not edge.any():
        return rgba
    # Interior colour, blurred, replaces the fringe.
    interior = (alpha > 220).astype(np.uint8) * 255
    color = cv2.inpaint(rgb, (edge.astype(np.uint8) * 255), 3, cv2.INPAINT_TELEA)
    out = rgba.copy()
    out[:, :, :3][edge] = color[edge]
    # Shave one pixel of half-alpha so a grey halo does not survive.
    kernel = np.ones((3, 3), np.uint8)
    shaved = cv2.erode(alpha, kernel, iterations=1)
    out[:, :, 3] = np.where(alpha < 250, np.minimum(alpha, shaved), alpha)
    return out


def bottom_profile(alpha, thresh=150):
    h, w = alpha.shape
    bottom = np.full(w, -1, np.int32)
    cols = np.where(alpha.max(axis=0) > thresh)[0]
    for x in cols:
        ys = np.where(alpha[:, x] > thresh)[0]
        if len(ys):
            bottom[x] = ys[-1]
    return bottom


def tire_contacts(alpha):
    """Left and right tyre bottoms. The centre bumper is allowed to hang lower."""
    bottom = bottom_profile(alpha)
    xs = np.where(bottom >= 0)[0]
    if len(xs) < 20:
        return [(int(xs[0]), int(bottom[xs[0]])), (int(xs[-1]), int(bottom[xs[-1]]))]
    x0, x1 = int(xs[0]), int(xs[-1])
    span = max(1, x1 - x0)

    def lowest_in(a, b):
        lo, hi = x0 + int(span * a), x0 + int(span * b)
        seg = np.arange(lo, hi)
        seg = seg[(seg >= 0) & (seg < len(bottom)) & (bottom[seg] >= 0)]
        if len(seg) == 0:
            return None
        i = seg[np.argmax(bottom[seg])]
        return int(i), int(bottom[i])

    left = lowest_in(0.10, 0.32)
    right = lowest_in(0.68, 0.90)
    if left is None or right is None:
        left = (int(xs[len(xs) // 5]), int(bottom[xs[len(xs) // 5]]))
        right = (int(xs[4 * len(xs) // 5]), int(bottom[xs[4 * len(xs) // 5]]))
    return [left, right]


def clip_hanging_shadow(rgba, contacts):
    """Drop lot shadow that is not connected to the body. Keep the bumper."""
    alpha = rgba[:, :, 3]
    h, w = alpha.shape
    (x0, y0), (x1, y1) = contacts
    if x1 == x0:
        return rgba
    t = (np.arange(w) - x0) / float(x1 - x0)
    line = y0 + t * (y1 - y0)
    out = rgba.copy()
    span = abs(x1 - x0)
    for x in range(w):
        y_line = int(line[x])
        if y_line < 1 or y_line >= h - 2:
            continue
        col = alpha[:, x]
        # Follow the opaque run down from the tyre line. A gap ends the body.
        # Do not saw the bumper off on a straight line.
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
    """Scale the car and put the tyre bottoms on ground_y."""
    h, w = plate.shape[:2]
    rgba = car
    # Trim to the alpha bbox so the scale is the car, not the canvas.
    alpha = rgba[:, :, 3]
    ys, xs = np.where(alpha > 20)
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    rgba = rgba[y0 : y1 + 1, x0 : x1 + 1]
    contacts = tire_contacts(rgba[:, :, 3])
    rgba = clip_hanging_shadow(rgba, contacts)
    contacts = tire_contacts(rgba[:, :, 3])
    ch, cw = rgba.shape[:2]
    scale = (w * width_frac) / float(cw)
    # Keep the roof under the wordmark. Use the same tyre the placement uses.
    roof_limit = h * 0.15
    tire_y = max(c[1] for c in contacts)
    # If this scale would shove the roof into the logo, shrink.
    roof_at = ground_y - tire_y * scale
    if roof_at < roof_limit and tire_y > 0:
        scale *= (ground_y - roof_limit) / max(1.0, ground_y - roof_at)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    resized = np.asarray(
        Image.fromarray(rgba, "RGBA").resize((nw, nh), Image.Resampling.LANCZOS)
    )
    contacts_s = [(c[0] * scale, c[1] * scale) for c in contacts]
    # The lower tyre touches the floor. Averaging left one tyre in the air.
    tire_y = max(c[1] for c in contacts_s)
    left = int(round(w * 0.5 - nw * 0.5))
    top = int(round(ground_y - tire_y))
    layer = np.zeros((h, w, 4), np.uint8)
    # Clip to the frame.
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
    placed_contacts = [(c[0] + left, c[1] + top) for c in contacts_s]
    return layer, placed_contacts


def paint_shadows(plate, contacts, ellipse):
    h, w = plate.shape[:2]
    shade = np.zeros((h, w), np.float32)
    yy, xx = np.mgrid[0:h, 0:w]
    for x, y in contacts:
        # Contact shadow: tight under the tyre, plus a wider soft AO.
        dx = (xx - x) / (w * 0.055)
        dy = (yy - y) / (h * 0.018)
        shade += 0.72 * np.exp(-(dx ** 2 + dy ** 2))
        dx2 = (xx - x) / (w * 0.11)
        dy2 = (yy - (y + h * 0.01)) / (h * 0.03)
        shade += 0.22 * np.exp(-(dx2 ** 2 + dy2 ** 2))
    if len(contacts) == 2:
        x0, y0 = contacts[0]
        x1, y1 = contacts[1]
        cx, cy = 0.5 * (x0 + x1), 0.5 * (y0 + y1)
        dx = (xx - cx) / max(40.0, abs(x1 - x0) * 0.55)
        dy = (yy - cy) / (h * 0.028)
        shade += 0.18 * np.exp(-(dx ** 2 + dy ** 2))
    shade = np.clip(shade, 0, 0.72)
    inside = ellipse_mask(h, w, ellipse, grow=1.02)
    shade *= inside
    out = plate.astype(np.float32)
    out *= (1.0 - shade[:, :, None])
    return np.clip(out, 0, 255).astype(np.uint8)


def add_reflection(plate, layer, contacts, ellipse):
    """Flip the lower body, squash it onto the floor, fade it out."""
    h, w = plate.shape[:2]
    alpha = layer[:, :, 3].astype(np.float32) / 255.0
    if alpha.max() < 0.05:
        return plate
    contact_y = int(round(0.5 * (contacts[0][1] + contacts[1][1])))
    contact_y = int(np.clip(contact_y, 1, h - 2))
    # Only the lower body reflects. A full-car flip is the misaligned look.
    body = layer[:contact_y]
    if body.shape[0] < 8:
        return plate
    band_h = max(8, int(body.shape[0] * 0.42))
    band = body[-band_h:]
    flipped = np.flipud(band)
    # Squash. Anchored at the contact line so the reflection starts at the tyre.
    squash = 0.38
    nh = max(4, int(flipped.shape[0] * squash))
    small = np.asarray(Image.fromarray(flipped, "RGBA").resize((w, nh), Image.Resampling.LANCZOS))
    refl = np.zeros_like(layer)
    y1 = min(h, contact_y + nh)
    refl[contact_y:y1] = small[: y1 - contact_y]
    # Fresnel: stronger just under the car (grazing), gone toward the camera.
    yy = np.arange(h, dtype=np.float32)
    dist = np.clip((yy - contact_y) / max(8.0, nh * 0.95), 0, 1)
    fresnel = (1.0 - dist) ** 1.35
    fresnel[:contact_y] = 0
    inside = ellipse_mask(h, w, ellipse, grow=0.98)
    strength = 0.42 * fresnel[:, None] * inside
    # Blur the reflection so it reads as a satin floor, not a mirror.
    blurred = np.asarray(Image.fromarray(refl, "RGBA").filter(ImageFilter.GaussianBlur(radius=1.6)))
    src = blurred[:, :, :3].astype(np.float32)
    sa = (blurred[:, :, 3].astype(np.float32) / 255.0) * strength
    out = plate.astype(np.float32)
    out[:] = out * (1 - sa[:, :, None]) + src * sa[:, :, None]
    return np.clip(out, 0, 255).astype(np.uint8)


def match_colour(layer, wall_rgb):
    rgb = layer[:, :, :3].astype(np.float32)
    alpha = layer[:, :, 3]
    m = alpha > 200
    if m.sum() < 50:
        return layer
    paint = np.percentile(rgb[m], 90, axis=0)
    wall = np.array(wall_rgb, np.float32)
    # Pull the paint hue a quarter of the way toward the wall. Keep the level.
    target_hue = paint * 0.72 + wall * (paint.mean() / max(1.0, wall.mean())) * 0.28
    gain = np.clip(target_hue / np.maximum(paint, 1.0), 0.92, 1.10)
    out = layer.copy()
    out[:, :, :3] = np.clip(rgb * gain, 0, 255).astype(np.uint8)
    return out


def composite_car(plate_rgb, ellipse, ground_y, cut_path, wall_rgb):
    car = np.asarray(Image.open(cut_path).convert("RGBA"))
    car = fill_glass(car)
    car = defringe(car)
    car = match_colour(car, wall_rgb)
    layer, contacts = place(plate_rgb, car, ground_y)
    out = paint_shadows(plate_rgb, contacts, ellipse)
    out = add_reflection(out, layer, contacts, ellipse)
    # Car over the reflection and the shadow, so the tyre covers its own contact.
    base = Image.fromarray(out, "RGB").convert("RGBA")
    over = Image.fromarray(layer, "RGBA")
    merged = np.asarray(Image.alpha_composite(base, over).convert("RGB"))
    return merged, contacts


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


def prepare_plate(meta_plate):
    rgb = np.asarray(Image.open(meta_plate["file"]).convert("RGB"))
    rgb = smooth_plate(rgb)
    h = rgb.shape[0]
    # The rendered disc and the cove landed on almost the same grey.
    # Darken the disc a little so the oval reads, then stroke one circle.
    h, w = rgb.shape[:2]
    inside = ellipse_mask(h, w, meta_plate["ellipse"], grow=0.985)
    rgb = rgb.astype(np.float32)
    rgb[inside] *= 0.90
    rgb = np.clip(rgb, 0, 255).astype(np.uint8)
    width = max(4, int(round(h * 0.006)))
    rgb = stroke_circle(rgb, meta_plate["ellipse"], width)
    wall = rgb[: int(h * 0.12), int(rgb.shape[1] * 0.2) : int(rgb.shape[1] * 0.8)].mean(axis=(0, 1))
    return rgb, wall


def main():
    plate_dir = sys.argv[1] if len(sys.argv) > 1 else "/tmp/gm-spyne"
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "/tmp/gm-spyne/out"
    os.makedirs(out_dir, exist_ok=True)
    meta = json.load(open(os.path.join(plate_dir, "plates.json")))
    # Front and rear sit on the low camera. The side uses the higher one,
    # where the ellipse is flatter, closer to a walking side shot.
    jobs = [
        ("rav4-front", "/tmp/gm-proof2/rav4-front-cut.png", "h070"),
        ("rav4-side", "/tmp/gm-proof2/rav4-side-cut.png", "h140"),
        ("rav4-rear", "/tmp/gm-proof2/rav4-rear-cut.png", "h070"),
        ("camry-front", "/tmp/gm-proof2/camry-front-cut.png", "h100"),
    ]
    prepared = {}
    for name, _cut, key in jobs:
        if key not in prepared:
            if key not in meta["plates"]:
                key = next(iter(meta["plates"]))
            prepared[key] = prepare_plate(meta["plates"][key])
    results = []
    for name, cut, key in jobs:
        if key not in meta["plates"]:
            key = next(iter(meta["plates"]))
        plate, wall = prepared[key]
        info = meta["plates"][key]
        ellipse = info["ellipse"]
        # Low in the disc, so the car can be large and the near arc stays visible.
        ground_y = ellipse["cy"] + ellipse["ry"] * 0.45
        ground_y = min(ground_y, ellipse["cy"] + ellipse["ry"] - plate.shape[0] * 0.055)
        merged, contacts = composite_car(plate, info["ellipse"], ground_y, cut, wall)
        merged = add_mark(merged)
        path = os.path.join(out_dir, f"{name}.jpg")
        Image.fromarray(merged, "RGB").save(path, "JPEG", quality=92, subsampling=1)
        h, w = merged.shape[:2]
        alpha_contacts = contacts
        print("wrote", path, merged.shape, "tires", [(round(c[0] / w, 3), round(c[1] / h, 3)) for c in alpha_contacts])
        results.append(path)
    return results


if __name__ == "__main__":
    main()
