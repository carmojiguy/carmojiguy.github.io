#!/usr/bin/env python3
"""Cut the test cars out with BiRefNet and seat them on the G&M studio plates.

This is the proof compositor. The browser path in web-studio.js follows the
same placement, glass, shadow and defringe rules with the in-browser model.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from rembg import new_session, remove

OUT = "/tmp/gm-proof2"
os.makedirs(OUT, exist_ok=True)
PLATES = "/workspace/backgrounds/gm-studio"
VARIANTS = ("silver", "white", "warm", "charcoal")


def geom(w, h):
    """Same low-camera disc as render_gm_studio.py.

    ry/rx ~ 0.24 is a bumper-height camera: the face of the disc is visible,
    and it is flatter than a turntable shot from above the roof.
    """
    wide = w / h >= 1.5
    cx = w * 0.50
    cy = h * (0.80 if wide else 0.762)
    rx = w * (0.42 if wide else 0.46)
    ry = rx * (0.20 if wide else 0.24)
    return cx, cy, rx, ry


def defringe(im, src):
    """Unmix the outdoor background from the cut edge and kill colour fringes."""
    rgba = np.array(im.convert("RGBA")).astype(np.float32)
    src_a = np.array(src.convert("RGB")).astype(np.float32)
    h, w = rgba.shape[:2]
    border = np.concatenate([
        src_a[:12].reshape(-1, 3),
        src_a[-12:].reshape(-1, 3),
        src_a[:, :12].reshape(-1, 3),
        src_a[:, -12:].reshape(-1, 3),
    ], axis=0)
    bg = np.median(border, axis=0)
    a = rgba[:, :, 3] / 255.0
    rgb = rgba[:, :, :3]
    # Edge band only. Fully opaque paint keeps its colour.
    edge = (a > 0.04) & (a < 0.92)
    aa = np.clip(a, 0.08, 1.0)
    fg = (rgb - bg * (1 - a)[..., None]) / aa[..., None]
    rgb = np.where(edge[..., None], np.clip(fg, 0, 255), rgb)
    # Feather the mask half a pixel so the cut is not a hard scissor line.
    alpha_im = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    alpha_im = alpha_im.filter(ImageFilter.GaussianBlur(radius=0.6))
    a2 = np.array(alpha_im).astype(np.float32) / 255.0
    # Restore the solid interior so blur does not eat the paint.
    a2 = np.where(a > 0.97, 1.0, a2)
    rgba[:, :, :3] = np.clip(rgb, 0, 255)
    rgba[:, :, 3] = np.clip(a2 * 255, 0, 255)
    return Image.fromarray(rgba.astype(np.uint8), "RGBA"), bg


def punch_glass(im, bg):
    """Windows keep a dark tint and show the studio. Sky and foliage do not."""
    rgba = np.array(im.convert("RGBA"))
    h, w = rgba.shape[:2]
    a = rgba[:, :, 3]
    fg = a > 28
    # Outside flood fill. Holes enclosed by the car are glass candidates.
    outside = np.zeros((h, w), np.uint8)
    stack = []
    def push(x, y):
        if x < 0 or y < 0 or x >= w or y >= h:
            return
        if outside[y, x] or fg[y, x]:
            return
        outside[y, x] = 1
        stack.append((x, y))
    for x in range(w):
        push(x, 0); push(x, h - 1)
    for y in range(h):
        push(0, y); push(w - 1, y)
    while stack:
        x, y = stack.pop()
        push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
    ys, xs = np.where(fg)
    if len(ys) == 0:
        return im
    y0, y1 = int(ys.min()), int(ys.max())
    x0, x1 = int(xs.min()), int(xs.max())
    band = y0 + int((y1 - y0) * 0.60)
    hole = (outside == 0) & (fg == 0)
    hole[:y0] = False
    hole[band:] = False
    hole[:, :x0] = False
    hole[:, x1:] = False
    # Sky / foliage still painted into the glass or the clearcoat.
    rgb = rgba[:, :, :3].astype(np.float32)
    lum = rgb.mean(axis=2)
    bg_l = float(np.mean(bg))
    blue = rgb[:, :, 2] - np.maximum(rgb[:, :, 0], rgb[:, :, 1])
    green = rgb[:, :, 1] - np.maximum(rgb[:, :, 0], rgb[:, :, 2])
    upper = np.zeros((h, w), bool)
    upper[y0:band, x0:x1] = True
    sky = upper & fg & ((blue > 18) | (green > 22) | ((lum > 210) & (np.abs(rgb - bg).sum(axis=2) < 80)))
    glass = hole | sky
    # Dark automotive tint. Alpha stays low enough that the plate reads through.
    rgba[glass, 0] = 18
    rgba[glass, 1] = 22
    rgba[glass, 2] = 26
    rgba[glass, 3] = np.where(hole[glass] if False else glass, 96, rgba[:, :, 3])[glass]
    # The where above is messy. Set directly.
    rgba[glass, 3] = 110
    # Soften the glass edge into the paint by a pixel.
    gmask = Image.fromarray((glass.astype(np.uint8) * 255))
    gmask = gmask.filter(ImageFilter.GaussianBlur(radius=1.1))
    gm = np.array(gmask).astype(np.float32) / 255.0
    base = np.array(Image.fromarray(rgba, "RGBA"))
    # Re-read original paint where the blur spills, then blend.
    paint = np.array(im.convert("RGBA")).astype(np.float32)
    tint = np.zeros_like(paint)
    tint[:, :, 0] = 18
    tint[:, :, 1] = 22
    tint[:, :, 2] = 26
    tint[:, :, 3] = 110
    out = paint * (1 - gm[..., None]) + tint * gm[..., None]
    out[:, :, 3] = np.maximum(paint[:, :, 3] * (1 - gm), tint[:, :, 3] * gm)
    # Keep fully opaque paint fully opaque.
    solid = (paint[:, :, 3] > 230) & (gm < 0.35)
    out[solid] = paint[solid]
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGBA")


def trim(im, pad=2):
    a = np.array(im.split()[-1])
    ys, xs = np.where(a > 12)
    if len(xs) == 0:
        return im
    x0, x1 = max(0, xs.min() - pad), min(im.width, xs.max() + pad)
    y0, y1 = max(0, ys.min() - pad), min(im.height, ys.max() + pad)
    return im.crop((x0, y0, x1 + 1, y1 + 1))


def match_light(car, plate_rgb):
    """Nudge exposure and white balance toward the studio so the car is not a sticker."""
    rgba = np.array(car.convert("RGBA")).astype(np.float32)
    a = rgba[:, :, 3]
    m = a > 180
    if m.sum() < 50:
        return car
    rgb = rgba[:, :, :3]
    # Gray-world on the paint, pulled only part way so a white car stays white
    # and a grey Camry stays grey.
    mean = rgb[m].mean(axis=0)
    target = np.array(plate_rgb, np.float32)
    # Match the colour of the light, not the wall brightness.
    target_n = target / max(1.0, target.mean())
    mean_n = mean / max(1.0, mean.mean())
    gain = 1 + (target_n / np.maximum(mean_n, 1e-3) - 1) * 0.28
    rgb = rgb * gain
    # A small lift if the car is much darker than a studio subject.
    paint_l = float(rgb[m].mean())
    if paint_l < 110:
        rgb = rgb * (1 + (125 - paint_l) / 400.0)
    rgba[:, :, :3] = np.clip(rgb, 0, 255)
    return Image.fromarray(rgba.astype(np.uint8), "RGBA")


def _blur1d(v, r):
    k = np.ones(r * 2 + 1) / (r * 2 + 1)
    return np.convolve(np.pad(v, r, mode="edge"), k, mode="valid")


def lower_envelope(car):
    a = np.array(car.split()[-1])
    h, w = a.shape
    lowest = np.full(w, -1.0)
    for x in range(w):
        ys = np.where(a[:, x] > 80)[0]
        if len(ys):
            lowest[x] = float(ys[-1])
    idx = np.where(lowest >= 0)[0]
    if len(idx) < 8:
        return a, np.linspace(h - 1, h - 1, w)
    full = np.interp(np.arange(w), idx, lowest[idx])
    return a, _blur1d(full, max(8, w // 48))


def tire_contacts(car):
    """Prominent low points of the silhouette: the tires, not the wheel centres."""
    a, sm = lower_envelope(car)
    h, w = a.shape
    rad = max(12, w // 22)
    peaks = []
    for i in range(rad, w - rad):
        window = sm[i - rad:i + rad + 1]
        if sm[i] < window.max() - 1.5:
            continue
        left = float(sm[max(0, i - w // 5):i].min()) if i > rad else float(sm[i])
        right = float(sm[i + 1:min(w, i + w // 5)].min()) if i < w - rad else float(sm[i])
        prom = float(sm[i]) - max(left, right)
        if prom < 10:
            continue
        if peaks and i - peaks[-1][0] < rad:
            if sm[i] > peaks[-1][1]:
                peaks[-1] = [i, float(sm[i]), prom]
            continue
        peaks.append([i, float(sm[i]), prom])
    # A centre peak lower than both tires is the front valance. Keep it for
    # shadow, but the tires are the outer peaks.
    if not peaks:
        return [(w * 0.3, float(sm.max())), (w * 0.7, float(sm.max()))]
    return [(float(x), float(y)) for x, y, _ in peaks]


def cool_rim(car):
    """Faint cool edge light so the cutout picks up the studio, not outdoor sun."""
    rgba = np.array(car.convert("RGBA")).astype(np.float32)
    a = rgba[:, :, 3] / 255.0
    mask = Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))
    dil = np.array(mask.filter(ImageFilter.GaussianBlur(radius=2.4))).astype(np.float32) / 255.0
    ero = np.array(mask.filter(ImageFilter.MinFilter(5))).astype(np.float32) / 255.0
    rim = np.clip(dil - ero, 0, 1)
    # Stronger on the roof and the camera-left edge, where a softbox would catch.
    h, w = a.shape
    yy = np.linspace(1.0, 0.25, h, dtype=np.float32)[:, None]
    xx = np.linspace(1.0, 0.35, w, dtype=np.float32)[None, :]
    rim = rim * yy * xx
    cool = np.array([186, 214, 232], np.float32)
    rgb = rgba[:, :, :3]
    rgba[:, :, :3] = np.clip(rgb * (1 - rim[..., None] * 0.35) + cool * (rim[..., None] * 0.55), 0, 255)
    return Image.fromarray(rgba.astype(np.uint8), "RGBA")


def composite(plate, car, profile):
    w, h = plate.size
    cx, cy, rx, ry = geom(w, h)
    contacts = tire_contacts(car)
    alpha, env = lower_envelope(car)
    opaque_x = np.where(alpha.max(axis=0) > 40)[0]
    body_cx = float(opaque_x.mean()) if len(opaque_x) else car.width / 2
    seat_y = float(env.max())
    # Tires and the valance are within a short span on these low cameras.
    # Seat the lowest rubber on the near half of the disc, and keep the car
    # small enough that pad shows on every side.
    frac = {"qfront": 0.56, "side": 0.70, "front": 0.46, "rear": 0.50}.get(profile, 0.56)
    scale = min((w * frac) / car.width, (rx * 1.20) / max(car.width, 1))
    contact_y = min(cy + ry * 0.34, cy + ry * 0.78)
    roof_limit = h * 0.175
    top = contact_y - seat_y * scale
    if top < roof_limit:
        scale = min(scale, (contact_y - roof_limit) / max(seat_y, 1))
        top = contact_y - seat_y * scale
    tw = max(2, int(round(car.width * scale)))
    th = max(2, int(round(car.height * scale)))
    car_r = cool_rim(car).resize((tw, th), Image.Resampling.LANCZOS)
    left = int(round(cx - body_cx * scale))
    top_i = int(round(top))
    canvas = plate.convert("RGBA")

    # Per-tire contact shadows, plus a soft body shadow.
    sh = Image.new("L", canvas.size, 0)
    draw_src = sh.load()
    for x, y in contacts:
        px = int(round(left + x * scale))
        py = int(round(top_i + y * scale))
        rw = max(10, int(tw * 0.075))
        rh = max(4, int(ry * 0.11))
        blob = Image.new("L", canvas.size, 0)
        bd = ImageDraw.Draw(blob)
        bd.ellipse([px - rw, py - rh, px + rw, py + rh + 2], fill=255)
        sh = Image.fromarray(np.maximum(np.array(sh), np.array(blob)))
    contact_blur = sh.filter(ImageFilter.GaussianBlur(radius=max(5, int(h * 0.007))))
    alpha = car_r.split()[-1]
    body = Image.new("L", canvas.size, 0)
    body.paste(alpha.point(lambda p: min(255, int(p * 0.5))), (left, top_i + max(2, int(h * 0.004))))
    ao = body.filter(ImageFilter.GaussianBlur(radius=max(16, int(h * 0.018))))
    darkness = np.clip(
        np.array(contact_blur).astype(np.float32) / 255.0 * 0.72
        + np.array(ao).astype(np.float32) / 255.0 * 0.30,
        0, 0.78,
    )
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    sp = np.array(shadow)
    sp[:, :, 3] = (darkness * 255).astype(np.uint8)
    canvas = Image.alpha_composite(canvas, Image.fromarray(sp, "RGBA"))

    # Short reflection on the disc only, under the tires.
    keep = max(8, int(th * 0.12))
    band = car_r.crop((0, th - keep, tw, th)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    rp = np.array(band).astype(np.float32)
    rp[:, :, 3] *= np.linspace(0.16, 0.0, keep, dtype=np.float32)[:, None]
    refl_full = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ground = int(round(contact_y))
    refl_full.paste(Image.fromarray(np.clip(rp, 0, 255).astype(np.uint8), "RGBA"), (left, ground - 1))
    yy, xx = np.mgrid[0:h, 0:w]
    ell = (((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2) <= 0.96
    rpx = np.array(refl_full)
    rpx[:, :, 3] = (rpx[:, :, 3].astype(np.float32) * ell).astype(np.uint8)
    canvas = Image.alpha_composite(canvas, Image.fromarray(rpx, "RGBA"))
    canvas.paste(car_r, (left, top_i), car_r)
    return canvas.convert("RGB")


def prepare(path, session):
    src = Image.open(path).convert("RGB")
    # BiRefNet is happier around 1280 on the long side. Keep detail.
    long = max(src.size)
    if long > 1600:
        s = 1600 / long
        src_in = src.resize((int(src.width * s), int(src.height * s)), Image.Resampling.LANCZOS)
    else:
        src_in = src
    cut = remove(src_in, session=session).convert("RGBA")
    cut, bg = defringe(cut, src_in)
    cut = punch_glass(cut, bg)
    cut = trim(cut)
    return src, cut


def main():
    session = new_session("birefnet-general-lite")
    jobs = [
        ("rav4-front", "/workspace/photos/test-rav4/front.jpg", "qfront"),
        ("rav4-side", "/workspace/photos/test-rav4/side.jpg", "side"),
        ("rav4-rear", "/workspace/photos/test-rav4/rear.jpg", "rear"),
        ("camry-front", "/tmp/car2.jpg", "qfront"),
    ]
    cells = []
    for name, path, profile in jobs:
        print("cut", name, flush=True)
        src, car = prepare(path, session)
        car.save(os.path.join(OUT, name + "-cut.png"))
        # before: the original, cover-fitted into a 4:3 frame
        before = Image.new("RGB", (1200, 900), (20, 20, 20))
        s = min(1200 / src.width, 900 / src.height)
        fw, fh = int(src.width * s), int(src.height * s)
        before.paste(src.resize((fw, fh), Image.Resampling.LANCZOS), ((1200 - fw) // 2, (900 - fh) // 2))
        row = [before]
        for variant in VARIANTS:
            plate = Image.open(f"{PLATES}/{variant}-4x3.jpg").convert("RGB")
            # Proof at 1600x1200 so the sheet is sharp without a 40MB jpeg.
            plate_s = plate.resize((1600, 1200), Image.Resampling.LANCZOS)
            # Sample the wall colour beside the wordmark for white balance.
            wall = plate_s.getpixel((200, 280))
            lit = match_light(car, wall)
            comp = composite(plate_s, lit, profile)
            comp.save(os.path.join(OUT, f"{name}-{variant}.jpg"), quality=90)
            row.append(comp.resize((1200, 900), Image.Resampling.LANCZOS))
            print(" ", variant, flush=True)
        cells.append((name, row))
    # Contact sheet: label gutter + 5 columns.
    cw, ch = 1200, 900
    pad = 16
    label_h = 36
    W = pad + 5 * (cw + pad)
    H = pad + len(cells) * (ch + label_h + pad)
    sheet = Image.new("RGB", (W, H), (16, 17, 20))
    from PIL import ImageDraw, ImageFont
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.truetype("/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", 22)
    heads = ["Before", "Light grey", "Bright white", "Warm grey", "Charcoal"]
    for r, (name, row) in enumerate(cells):
        for c, im in enumerate(row):
            x = pad + c * (cw + pad)
            y = pad + r * (ch + label_h + pad)
            sheet.paste(im, (x, y + label_h))
            cap = f"{name} · {heads[c]}"
            draw.text((x, y + 6), cap, fill=(230, 232, 236), font=font)
    path = os.path.join(OUT, "contact-sheet.jpg")
    sheet.save(path, quality=88)
    print("sheet", path, sheet.size)


if __name__ == "__main__":
    main()
