#!/usr/bin/env python3
"""Cut the test cars out with BiRefNet and seat them on the G&M studio plates.

This is the proof compositor. The browser path in web-studio.js follows the
same placement, glass, shadow and defringe rules with the in-browser model.
"""
import os
import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session, remove

OUT = "/tmp/gm-proof2"
os.makedirs(OUT, exist_ok=True)
PLATES = "/workspace/backgrounds/gm-studio"
VARIANTS = ("silver", "white", "warm", "charcoal")


def geom(w, h):
    wide = w / h >= 1.5
    cx = w * 0.5
    cy = h * (0.80 if wide else 0.735)
    rx = w * (0.36 if wide else 0.40)
    ry = rx * (0.17 if wide else 0.215)
    ground = cy + ry * 0.02
    return cx, cy, rx, ry, ground


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


def composite(plate, car, profile):
    w, h = plate.size
    cx, cy, rx, ry, ground = geom(w, h)
    frac = {"qfront": 0.62, "side": 0.74, "front": 0.46, "rear": 0.50}.get(profile, 0.62)
    # Work at plate resolution.
    target_w = w * frac
    scale = target_w / car.width
    target_h = car.height * scale
    # Roof must clear the wordmark. Wordmark occupies roughly the top 16%.
    max_top = h * 0.175
    max_h = ground - max_top
    if target_h > max_h:
        scale *= max_h / target_h
        target_w = car.width * scale
        target_h = car.height * scale
    tw, th = int(round(target_w)), int(round(target_h))
    car_r = car.resize((tw, th), Image.Resampling.LANCZOS)
    left = int(round(cx - tw / 2))
    top = int(round(ground - th))
    canvas = plate.convert("RGBA")
    # Contact shadow from the actual alpha, blurred, sitting under the tires.
    sh = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    alpha = car_r.split()[-1]
    blob = Image.new("L", canvas.size, 0)
    # Only the bottom 18% of the car casts the hard contact; the body casts AO.
    contact = alpha.crop((0, int(th * 0.82), tw, th))
    blob.paste(contact, (left, top + int(th * 0.82)))
    body = alpha.point(lambda p: min(255, int(p * 0.55)))
    body_layer = Image.new("L", canvas.size, 0)
    body_layer.paste(body, (left, top + 6))
    contact_blur = blob.filter(ImageFilter.GaussianBlur(radius=max(6, int(h * 0.008))))
    ao_blur = body_layer.filter(ImageFilter.GaussianBlur(radius=max(18, int(h * 0.02))))
    sh_px = np.array(sh)
    c = np.array(contact_blur).astype(np.float32) / 255.0
    ao = np.array(ao_blur).astype(np.float32) / 255.0
    darkness = np.clip(c * 0.55 + ao * 0.28, 0, 0.72)
    sh_px[:, :, 3] = (darkness * 255).astype(np.uint8)
    sh = Image.fromarray(sh_px, "RGBA")
    canvas = Image.alpha_composite(canvas, sh)
    # Floor reflection: flip the lower fifth, fade, clip to the disc.
    keep = max(8, int(th * 0.16))
    refl = Image.new("RGBA", (tw, keep), (0, 0, 0, 0))
    band = car_r.crop((0, th - keep, tw, th)).transpose(Image.Transpose.FLIP_TOP_BOTTOM)
    refl.paste(band, (0, 0))
    rp = np.array(refl).astype(np.float32)
    fade = np.linspace(0.22, 0.0, keep, dtype=np.float32)[:, None]
    rp[:, :, 3] *= fade
    refl = Image.fromarray(np.clip(rp, 0, 255).astype(np.uint8), "RGBA")
    # Clip reflection to the turntable ellipse.
    clip = Image.new("L", canvas.size, 0)
    yy, xx = np.mgrid[0:h, 0:w]
    ell = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0
    clip.paste(Image.fromarray((ell.astype(np.uint8) * 255), "L"))
    refl_full = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    refl_full.paste(refl, (left, int(ground) - 1))
    rpx = np.array(refl_full)
    rpx[:, :, 3] = (rpx[:, :, 3].astype(np.float32) * (np.array(clip) / 255.0)).astype(np.uint8)
    canvas = Image.alpha_composite(canvas, Image.fromarray(rpx, "RGBA"))
    canvas.paste(car_r, (left, top), car_r)
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
