#!/usr/bin/env python3
"""Photographic G&M studio plates: seamless cyc, metal turntable, wall wordmark.

The wordmark is set in Liberation Sans, the Arial-metric face on this machine,
at a heavy weight (Bold drawn in a stacked 900-style). G and M follow the wall
(dark on light studios, white on charcoal). The ampersand and the bar are
#E0243C. There is no black badge box.
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = "/workspace/backgrounds/gm-studio"
FONT_BLACK = "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"
RED = (224, 36, 60, 255)
os.makedirs(OUT, exist_ok=True)

VARIANTS = {
    "silver": {
        "wall": (214, 216, 220),
        "hot": (248, 249, 251),
        "cove": (232, 234, 237),
        "floor": (196, 198, 203),
        "floor_far": (226, 228, 232),
        # Satin dark-grey disc on the light floor. No machined rings.
        "disc_far": (78, 82, 88),
        "disc_near": (108, 112, 118),
        "sheen": (132, 136, 142),
        "rim_hi": (214, 218, 224),
        "rim_lo": (36, 38, 42),
        "spec": 0.55,
        "ink": (22, 24, 28, 255),
        "sub": (70, 74, 82, 255),
        "vignette": 0.22,
        "lit": 0.0,
        "accent": None,
    },
    "white": {
        "wall": (236, 237, 239),
        "hot": (255, 255, 255),
        "cove": (246, 247, 248),
        "floor": (222, 223, 226),
        "floor_far": (240, 241, 243),
        # Polished light-grey disc. One soft edge highlight, no rings.
        "disc_far": (168, 170, 174),
        "disc_near": (206, 208, 212),
        "sheen": (228, 230, 234),
        "rim_hi": (255, 255, 255),
        "rim_lo": (120, 122, 126),
        "spec": 0.85,
        "ink": (28, 30, 34, 255),
        "sub": (90, 94, 100, 255),
        "vignette": 0.12,
        "lit": 0.0,
        "accent": None,
    },
    "warm": {
        "wall": (214, 206, 196),
        "hot": (246, 240, 232),
        "cove": (230, 222, 212),
        "floor": (196, 186, 174),
        "floor_far": (226, 218, 208),
        "disc_far": (72, 66, 60),
        "disc_near": (104, 96, 88),
        "sheen": (126, 116, 106),
        "rim_hi": (214, 206, 196),
        "rim_lo": (36, 32, 28),
        "spec": 0.5,
        "ink": (36, 30, 26, 255),
        "sub": (92, 78, 68, 255),
        "vignette": 0.20,
        "lit": 0.0,
        "accent": None,
    },
    "charcoal": {
        "wall": (28, 29, 32),
        "hot": (62, 64, 70),
        "cove": (38, 39, 43),
        "floor": (18, 19, 21),
        "floor_far": (34, 35, 38),
        "disc_far": (46, 48, 52),
        "disc_near": (72, 74, 80),
        "sheen": (96, 100, 108),
        "rim_hi": (186, 192, 202),
        "rim_lo": (16, 17, 19),
        "spec": 0.7,
        "ink": (248, 248, 250, 255),
        "sub": (196, 198, 204, 255),
        "vignette": 0.55,
        "lit": 1.0,
        "accent": None,
    },
}


def mix(a, b, t):
    t = np.clip(t, 0, 1)[..., None]
    return a * (1 - t) + b * t


def wordmark(dark_ink, sub_ink, scale):
    """Transparent wordmark. scale is the cap-height of G&M in pixels."""
    font_gm = ImageFont.truetype(FONT_BLACK, int(scale))
    font_sub = ImageFont.truetype(FONT_BLACK, max(12, int(scale * 0.16)))
    # Measure by drawing once.
    probe = Image.new("RGBA", (8, 8))
    d = ImageDraw.Draw(probe)

    def text_size(font, text, tracking=0):
        widths = []
        h = 0
        for ch in text:
            b = d.textbbox((0, 0), ch, font=font)
            widths.append(b[2] - b[0])
            h = max(h, b[3] - b[1])
        return sum(widths) + tracking * (len(text) - 1), h, widths

    gm = "G&M"
    # Draw G, &, M separately so the ampersand can be red.
    gap = int(scale * 0.02)
    parts = []
    total_w = 0
    gm_h = 0
    for ch in gm:
        b = d.textbbox((0, 0), ch, font=font_gm)
        w = b[2] - b[0]
        h = b[3] - b[1]
        parts.append((ch, w, h, b))
        total_w += w
        gm_h = max(gm_h, h)
    total_w += gap * (len(parts) - 1)
    sub = "AUTO SALES & SERVICE"
    track = int(scale * 0.045)
    sw, sh, swidths = text_size(font_sub, sub, track)
    bar_h = max(4, int(scale * 0.045))
    pad = int(scale * 0.35)
    W = max(total_w, sw) + pad * 2
    H = gm_h + int(scale * 0.18) + bar_h + int(scale * 0.10) + sh + pad
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    mask = Image.new("L", (W, H), 0)
    md = ImageDraw.Draw(mask)
    dr = ImageDraw.Draw(im)
    # Heavy 900-style: stamp the bold face a few pixels around itself.
    x0 = (W - total_w) // 2
    y0 = pad // 3
    x = x0
    offsets = [(dx, dy) for dx in (-2, -1, 0, 1, 2) for dy in (-2, -1, 0, 1, 2) if abs(dx) + abs(dy) <= 3]
    for ch, w, h, b in parts:
        col = RED if ch == "&" else dark_ink
        for dx, dy in offsets:
            dr.text((x - b[0] + dx, y0 - b[1] + dy), ch, font=font_gm, fill=col)
        x += w + gap
    bar_w = int(total_w * 0.92)
    bar_x = (W - bar_w) // 2
    bar_y = y0 + gm_h + int(scale * 0.06)
    dr.rounded_rectangle([bar_x, bar_y, bar_x + bar_w, bar_y + bar_h], radius=bar_h // 2, fill=RED)
    # subtitle, tracked
    sx = (W - sw) // 2
    sy = bar_y + bar_h + int(scale * 0.08)
    x = sx
    for i, ch in enumerate(sub):
        b = d.textbbox((0, 0), ch, font=font_sub)
        col = RED if ch == "&" else sub_ink
        dr.text((x - b[0], sy - b[1]), ch, font=font_sub, fill=col)
        x += swidths[i] + track
    # soft contact shadow baked into the transparent art, below the letters
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    alpha = im.split()[-1]
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    sh.paste((0, 0, 0, 140), mask=alpha)
    sh = sh.filter(ImageFilter.GaussianBlur(max(2, scale // 18)))
    shadow.paste(sh, (0, max(1, scale // 40)), sh)
    out = Image.alpha_composite(shadow, im)
    return out


def render(name, spec, w, h):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx - w * 0.5) / w
    ny = yy / h
    wall = np.array(spec["wall"], np.float32)
    hot = np.array(spec["hot"], np.float32)
    cove_c = np.array(spec["cove"], np.float32)
    floor = np.array(spec["floor"], np.float32)
    floor_far = np.array(spec["floor_far"], np.float32)

    # Key light: a large softbox centered above the turntable.
    key = np.exp(-((nx * 1.15) ** 2 + (ny - 0.30) ** 2) / 0.085)
    # Two side softboxes, dimmer, so the wall is not a flat ramp.
    left = np.exp(-((nx + 0.28) ** 2 / 0.02 + (ny - 0.22) ** 2 / 0.012))
    right = np.exp(-((nx - 0.28) ** 2 / 0.02 + (ny - 0.22) ** 2 / 0.012))
    rgb = mix(wall, hot, np.clip(key * 0.85 + left * 0.35 + right * 0.35, 0, 1))

    # Seamless cove. The wall bends into the floor through a wide bright band.
    cove = np.clip((ny - 0.52) / 0.10, 0, 1)
    cove = cove * cove * (3 - 2 * cove)
    rgb = mix(rgb, cove_c, cove * 0.65)
    floor_t = np.clip((ny - 0.60) / 0.18, 0, 1)
    floor_t = floor_t * floor_t * (3 - 2 * floor_t)
    floor_col = mix(floor_far, floor, np.clip((ny - 0.62) / 0.38, 0, 1))
    rgb = mix(rgb, floor_col, floor_t)

    # Vignette, stronger at the corners, never a hard edge.
    vig = np.clip((np.abs(nx) * 1.7) ** 2 + (ny - 0.42) ** 2 * 1.4, 0, 1)
    rgb = rgb * (1 - vig[..., None] * spec["vignette"])

    wide = w / h >= 1.5
    # Low dealer camera: a flat ellipse, not a CD seen from above.
    cx = w * 0.50
    cy = h * (0.80 if wide else 0.762)
    rx = w * (0.42 if wide else 0.46)
    ry = rx * (0.20 if wide else 0.24)
    dx = (xx - cx) / rx
    dy = (yy - cy) / ry
    d = np.sqrt(dx * dx + dy * dy)
    ang = np.arctan2(dy, dx)

    # Soft floor shadow under the disc, offset toward the camera. Not a ring.
    sdx = (xx - cx) / (rx * 1.04)
    sdy = (yy - (cy + ry * 0.42)) / (ry * 1.55)
    sd = np.sqrt(sdx * sdx + sdy * sdy)
    sh = np.clip(1.02 - sd, 0, 1) ** 1.6
    if spec["lit"] < 0.5:
        rgb = rgb * (1 - sh[..., None] * 0.16)
    else:
        pool = np.exp(-(sd ** 2) / 1.35)
        rgb = rgb + pool[..., None] * 18

    # Satin face. A smooth radial falloff (bright center, darker rim) plus a
    # gentle near-side lift. One gradient, no concentric grooves.
    disc_far = np.array(spec["disc_far"], np.float32)
    disc_near = np.array(spec["disc_near"], np.float32)
    sheen = np.array(spec["sheen"], np.float32)
    radial = np.clip(d, 0, 1)
    radial = radial * radial * (3 - 2 * radial)
    disc = mix(disc_near, disc_far, radial)
    facing = np.clip((dy + 0.20) * 0.55, 0, 1)
    facing = facing * facing * (3 - 2 * facing)
    disc = mix(disc, sheen, facing * 0.22 * (1 - radial * 0.45))
    # A wide, soft reflection of the overhead softbox. It fades before the rim.
    bloom = np.exp(-((dx + 0.06) ** 2) / 0.72 - ((dy - 0.16) ** 2) / 0.40)
    bloom = bloom * np.clip(1.08 - d * 0.85, 0, 1)
    disc = mix(disc, sheen, bloom * (0.14 + 0.10 * spec["spec"]))

    # Thin bevel. The metal lip is quiet except for one soft specular on the
    # near-left arc, where the softbox catches the edge.
    lip = np.exp(-((d - 0.978) ** 2) / (2 * 0.0065 ** 2))
    outer = np.exp(-((d - 1.006) ** 2) / (2 * 0.008 ** 2))
    # Angle 2.15 rad is the near-left rim (camera left, toward the floor).
    spec_arc = np.exp(-((ang - 2.15) ** 2) / (2 * 0.38 ** 2))
    disc = mix(disc, np.array(spec["rim_lo"], np.float32), outer * 0.80)
    disc = mix(disc, np.array(spec["rim_hi"], np.float32), lip * (0.18 + 0.72 * spec_arc * spec["spec"]))
    disc_a = np.clip((1.008 - d) / 0.012, 0, 1)
    disc_a = disc_a * disc_a * (3 - 2 * disc_a)
    rgb = mix(rgb, disc, disc_a)

    rng = np.random.default_rng(11)
    grain = rng.normal(0, 1.15, (h, w, 1)).astype(np.float32)
    rgb = np.clip(rgb + grain, 0, 255).astype(np.uint8)
    im = Image.fromarray(rgb, "RGB").convert("RGBA")

    mark = wordmark(spec["ink"], spec["sub"], int(w * (0.078 if not wide else 0.062)))
    # Cap the wordmark width.
    max_w = int(w * (0.34 if not wide else 0.28))
    if mark.width > max_w:
        nh = int(mark.height * max_w / mark.width)
        mark = mark.resize((max_w, nh), Image.Resampling.LANCZOS)
    lx = (w - mark.width) // 2
    ly = int(h * (0.055 if not wide else 0.045))
    im.alpha_composite(mark, (lx, ly))
    out = im.convert("RGB")
    tag = "4x3" if abs(w / h - 4 / 3) < 0.02 else "16x9"
    path = os.path.join(OUT, f"{name}-{tag}.jpg")
    out.save(path, "JPEG", quality=92, optimize=True, subsampling=1)
    print("wrote", path, out.size, os.path.getsize(path))
    return path


def main():
    for name, spec in VARIANTS.items():
        render(name, spec, 3200, 2400)
        render(name, spec, 3200, 1800)


if __name__ == "__main__":
    main()
