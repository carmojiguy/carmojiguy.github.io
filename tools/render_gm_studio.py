#!/usr/bin/env python3
"""Render photographic G&M studio cyc + turntable plates."""
import math
import os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

LOGO = "/workspace/icons/gm-logo-square.png"
OUT = "/workspace/backgrounds/gm-studio"
os.makedirs(OUT, exist_ok=True)

VARIANTS = {
    "silver": {
        "wall": (228, 230, 234),
        "wall_hot": (246, 247, 249),
        "edge": (186, 190, 196),
        "floor": (214, 216, 220),
        "disc": (198, 202, 208),
        "ring": (176, 180, 186),
        "ring_hi": (226, 228, 232),
        "rim": (236, 238, 241),
        "accent": None,
        "vignette": 0.28,
        "spot": 0.55,
    },
    "white": {
        "wall": (244, 245, 247),
        "wall_hot": (255, 255, 255),
        "edge": (214, 216, 220),
        "floor": (236, 237, 239),
        "disc": (228, 230, 233),
        "ring": (206, 209, 214),
        "ring_hi": (244, 245, 247),
        "rim": (250, 250, 252),
        "accent": None,
        "vignette": 0.18,
        "spot": 0.42,
    },
    "warm": {
        "wall": (226, 221, 214),
        "wall_hot": (242, 238, 232),
        "edge": (186, 176, 166),
        "floor": (214, 208, 200),
        "disc": (196, 190, 182),
        "ring": (170, 162, 152),
        "ring_hi": (224, 218, 210),
        "rim": (232, 226, 218),
        "accent": (224, 36, 60),
        "vignette": 0.26,
        "spot": 0.48,
    },
    "charcoal": {
        "wall": (42, 44, 48),
        "wall_hot": (78, 80, 86),
        "edge": (18, 19, 22),
        "floor": (32, 33, 36),
        "disc": (92, 94, 99),
        "ring": (68, 70, 74),
        "ring_hi": (128, 130, 136),
        "rim": (168, 170, 176),
        "accent": None,
        "vignette": 0.42,
        "spot": 0.85,
    },
}


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    t = np.clip(t, 0, 1)[..., None]
    return c1 * (1 - t) + c2 * t


def render(name, spec, w, h):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    nx = (xx - w * 0.5) / (w * 0.5)
    ny = (yy - h * 0.42) / (h * 0.55)
    # softbox: brighter behind the logo / car
    spot = np.exp(-((nx * 0.85) ** 2 + ((yy / h - 0.36) * 1.35) ** 2) * (2.2 - spec["spot"]))
    wall = np.array(spec["wall"], dtype=np.float32)
    hot = np.array(spec["wall_hot"], dtype=np.float32)
    edge = np.array(spec["edge"], dtype=np.float32)
    rgb = mix(wall, hot, spot * 0.85)
    vig = np.clip(nx ** 2 * 0.55 + ((yy / h - 0.4) ** 2) * 0.9, 0, 1)
    rgb = mix(rgb, edge, vig * spec["vignette"])
    # floor falloff — seamless, no hard horizon
    floor_t = np.clip((yy / h - 0.58) / 0.42, 0, 1) ** 1.15
    floor = np.array(spec["floor"], dtype=np.float32)
    rgb = mix(rgb, floor, floor_t * 0.55)
    # gentle vertical shade so the cyc reads as a wall
    rgb = rgb * (1 - np.clip((yy / h - 0.72), 0, 1)[..., None] * 0.08)

    cx = w * 0.5
    cy = h * (0.74 if w / h < 1.5 else 0.80)
    rx = w * (0.38 if w / h < 1.5 else 0.36)
    ry = rx * (0.22 if w / h < 1.5 else 0.17)
    # disc sits on the floor: soft shadow under the ellipse
    sdx = (xx - cx) / (rx * 1.04)
    sdy = (yy - (cy + ry * 0.22)) / (ry * 1.15)
    sd = np.sqrt(sdx ** 2 + sdy ** 2)
    sh_a = np.clip((1.15 - sd) / 0.55, 0, 1) ** 1.6
    rgb = rgb * (1 - sh_a[..., None] * (0.10 if name != "charcoal" else 0.0))
    if name == "charcoal":
        # lit pool on the floor around the turntable
        rgb = np.clip(rgb + (np.exp(-(sd ** 2) / 0.8)[..., None] * 18), 0, 255)
    dx = (xx - cx) / rx
    dy = (yy - cy) / ry
    d = np.sqrt(dx ** 2 + dy ** 2)
    # soft disc edge
    disc_a = np.clip((1.015 - d) / 0.028, 0, 1)
    disc_a = disc_a ** 1.15
    disc_col = np.array(spec["disc"], dtype=np.float32)
    # perspective shading: nearer (bottom) slightly lighter, far slightly darker
    shade = np.clip((yy - (cy - ry)) / (2 * ry), 0, 1)
    disc_rgb = disc_col * (0.90 + 0.16 * shade)[..., None]
    # concentric rings
    ring = np.array(spec["ring"], dtype=np.float32)
    ring_hi = np.array(spec["ring_hi"], dtype=np.float32)
    for i, rad in enumerate((0.18, 0.34, 0.50, 0.66, 0.82)):
        band = np.exp(-((d - rad) ** 2) / (2 * (0.012 ** 2)))
        col = ring if i % 2 == 0 else ring_hi
        disc_rgb = mix(disc_rgb, col, band * 0.72)
    # outer metal rim
    rim_band = np.exp(-((d - 0.975) ** 2) / (2 * (0.018 ** 2)))
    rim = np.array(spec["rim"], dtype=np.float32)
    disc_rgb = mix(disc_rgb, rim, rim_band * 0.9)
    if spec["accent"]:
        acc = np.array(spec["accent"], dtype=np.float32)
        acc_band = np.exp(-((d - 0.955) ** 2) / (2 * (0.007 ** 2)))
        disc_rgb = mix(disc_rgb, acc, acc_band * 0.85)
    # glossy sheen on the near half
    sheen = np.exp(-((d - 0.72) ** 2) / 0.02) * np.clip(dy, 0, 1)
    disc_rgb = np.clip(disc_rgb + sheen[..., None] * 18, 0, 255)
    # soft contact pool in the middle of the disc (empty studio, very faint)
    pool = np.exp(-(d ** 2) / (2 * (0.28 ** 2)))
    disc_rgb = disc_rgb * (1 - pool[..., None] * 0.06)
    rgb = mix(rgb, disc_rgb, disc_a)

    # fine photographic grain
    rng = np.random.default_rng(7)
    grain = rng.normal(0, 1.6, (h, w, 1)).astype(np.float32)
    rgb = np.clip(rgb + grain, 0, 255).astype(np.uint8)
    im = Image.fromarray(rgb, "RGB")

    # logo
    logo = Image.open(LOGO).convert("RGBA")
    lw = int(w * (0.20 if w / h < 1.5 else 0.16))
    lh = lw
    logo = logo.resize((lw, lh), Image.Resampling.LANCZOS)
    # slight shadow so it sits on the wall
    alpha = logo.split()[-1]
    shadow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    sh = Image.new("RGBA", logo.size, (0, 0, 0, 0))
    sh.paste((0, 0, 0, 90), mask=alpha)
    sh = sh.filter(ImageFilter.GaussianBlur(18))
    lx = (w - lw) // 2
    ly = int(h * (0.045 if w / h < 1.5 else 0.04))
    shadow.paste(sh, (lx, ly + int(h * 0.008)), sh)
    base = im.convert("RGBA")
    base = Image.alpha_composite(base, shadow)
    base.paste(logo, (lx, ly), logo)
    out = base.convert("RGB")
    tag = "4x3" if h*4 == w*3 else "16x9"
    path = os.path.join(OUT, f"{name}-{tag}.jpg")
    out.save(path, "JPEG", quality=90, optimize=True, subsampling=1)
    print("wrote", path, out.size)
    return path


def main():
    sizes = [(3200, 2400), (3200, 1800)]
    # quick preview first is the full size; caller can crop later
    for name, spec in VARIANTS.items():
        for w, h in sizes:
            render(name, spec, w, h)


if __name__ == "__main__":
    main()
