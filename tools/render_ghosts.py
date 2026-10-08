#!/usr/bin/env python3
"""Neon framing ghosts in the same glow as the original ghosts/*.png files.

Original guides are luminous green line drawings: a bright core near
rgb(67, 254, 106) and a darker green edge, with a short alpha falloff.
New guides are drawn the same way. The twelve original PNGs are not touched.
"""
import math
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = "/workspace/ghosts"
STROKE = 2.6  # px at final resolution; originals sit near 4–6px including the core


def neon(mask_u8):
    """Turn a white-on-black line mask into the original ghost colour."""
    a = mask_u8.astype(np.float32) / 255.0
    # Slight extra bloom so lines sit in the same family as the PNGs.
    g = 70.0 + 185.0 * np.clip(a, 0, 1) ** 0.62
    rgb = np.dstack([g * 0.264, g, g * 0.418])
    alpha = np.clip((a - 0.015) / 0.22, 0, 1) ** 0.9
    rgba = np.dstack([rgb, alpha * 255.0])
    return Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), "RGBA")


class Pen:
    def __init__(self, w, h, scale=3):
        self.w, self.h, self.s = w, h, scale
        self.im = Image.new("L", (w * scale, h * scale), 0)
        self.d = ImageDraw.Draw(self.im)
        self.width = max(2, int(round(STROKE * scale)))

    def _p(self, x, y):
        return (x * self.s, y * self.s)

    def line(self, pts, width=None):
        if len(pts) < 2:
            return
        wd = self.width if width is None else max(2, int(round(width * self.s)))
        xy = [self._p(x, y) for x, y in pts]
        self.d.line(xy, fill=255, width=wd, joint="curve")

    def poly(self, pts, width=None, closed=False):
        p = list(pts)
        if closed and p:
            p = p + [p[0]]
        self.line(p, width)

    def ellipse(self, cx, cy, rx, ry, width=None):
        wd = self.width if width is None else max(2, int(round(width * self.s)))
        box = [cx - rx, cy - ry, cx + rx, cy + ry]
        box = [c * self.s for c in box]
        self.d.ellipse(box, outline=255, width=wd)

    def arc(self, cx, cy, rx, ry, a0, a1, width=None, n=48):
        pts = []
        for i in range(n + 1):
            t = a0 + (a1 - a0) * i / n
            pts.append((cx + math.cos(t) * rx, cy + math.sin(t) * ry))
        self.line(pts, width)

    def bez(self, p0, p1, p2, p3, width=None, n=28):
        pts = []
        for i in range(n + 1):
            t = i / n
            u = 1 - t
            x = u**3 * p0[0] + 3 * u**2 * t * p1[0] + 3 * u * t**2 * p2[0] + t**3 * p3[0]
            y = u**3 * p0[1] + 3 * u**2 * t * p1[1] + 3 * u * t**2 * p2[1] + t**3 * p3[1]
            pts.append((x, y))
        self.line(pts, width)

    def finish(self):
        blurred = self.im.filter(ImageFilter.GaussianBlur(radius=self.s * 0.72))
        small = blurred.resize((self.w, self.h), Image.Resampling.LANCZOS)
        return neon(np.array(small))


def norm(v):
    n = np.linalg.norm(v)
    return v / n if n else v


def look_at(eye, target, up, fov_deg, w, h):
    eye = np.array(eye, float)
    target = np.array(target, float)
    f = norm(target - eye)
    r = norm(np.cross(f, np.array(up, float)))
    u = np.cross(r, f)
    aspect = w / h
    tany = math.tan(math.radians(fov_deg) / 2)
    tanx = tany * aspect

    def project(p):
        p = np.array(p, float) - eye
        z = np.dot(p, f)
        if z < 0.05:
            return None
        x = np.dot(p, r) / (z * tanx)
        y = np.dot(p, u) / (z * tany)
        return ((x * 0.5 + 0.5) * w, (0.5 - y * 0.5) * h, z)
    return project


def raster_z(zbuf, tri):
    """tri: 3 points of (x, y, z) in pixel space. Painter writes nearest z."""
    pts = [p for p in tri if p is not None]
    if len(pts) < 3:
        return
    h, w = zbuf.shape
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    minx, maxx = int(max(0, min(xs))), int(min(w - 1, max(xs)))
    miny, maxy = int(max(0, min(ys))), int(min(h - 1, max(ys)))
    if maxx <= minx or maxy <= miny:
        return
    p0, p1, p2 = [np.array(p, float) for p in pts]
    v0, v1 = p1 - p0, p2 - p0
    den = v0[0] * v1[1] - v1[0] * v0[1]
    if abs(den) < 1e-6:
        return
    # Skip backfaces (negative screen area, clockwise).
    if den > 0:
        return
    for y in range(miny, maxy + 1):
        for x in range(minx, maxx + 1):
            q = np.array([x + 0.5, y + 0.5, 0.0]) - p0
            a = (q[0] * v1[1] - v1[0] * q[1]) / den
            b = (v0[0] * q[1] - q[0] * v0[1]) / den
            if a >= 0 and b >= 0 and a + b <= 1:
                z = p0[2] + a * v0[2] + b * v1[2]
                if z < zbuf[y, x]:
                    zbuf[y, x] = z


class Car:
    """A modern crossover, pickup or van described as panels and feature lines."""

    def __init__(self, kind="suv"):
        self.kind = kind
        if kind == "truck":
            self._truck()
        elif kind == "van":
            self._van()
        else:
            self._suv()

    def _suv(self):
        # x along the car, y to the driver's side, z up. Metres.
        self.stations = [
            # x, half-width, z rocker, z belt, z roof
            (0.20, 0.78, 0.34, 0.52, 0.52),
            (0.70, 0.92, 0.30, 0.70, 0.74),
            (1.25, 0.94, 0.28, 0.78, 0.98),
            (1.75, 0.93, 0.28, 0.82, 1.58),
            (3.05, 0.93, 0.28, 0.82, 1.55),
            (3.70, 0.92, 0.30, 0.76, 1.18),
            (4.35, 0.84, 0.34, 0.62, 0.66),
        ]
        self.wheel_x = (1.15, 3.45)
        self.length = 4.55
        self.doors = (2.05, 2.85)

    def _truck(self):
        self.stations = [
            (0.25, 0.82, 0.40, 0.62, 0.62),
            (0.80, 0.96, 0.36, 0.82, 0.88),
            (1.40, 0.98, 0.34, 0.90, 1.15),
            (1.90, 0.97, 0.34, 0.94, 1.72),
            (2.70, 0.97, 0.36, 0.90, 1.68),
            (3.15, 0.96, 0.48, 1.05, 1.05),  # back of cab / front of bed
            (5.35, 0.94, 0.48, 1.05, 1.05),  # tail of bed
        ]
        self.wheel_x = (1.25, 4.35)
        self.length = 5.6
        self.doors = (2.15,)
        self.bed = True

    def _van(self):
        self.stations = [
            (0.25, 0.88, 0.36, 0.70, 0.78),
            (0.90, 0.98, 0.32, 0.90, 1.35),
            (1.50, 0.99, 0.32, 1.00, 1.85),
            (4.15, 0.99, 0.32, 1.00, 1.82),
            (4.80, 0.96, 0.34, 0.88, 1.35),
            (5.20, 0.90, 0.38, 0.70, 0.78),
        ]
        self.wheel_x = (1.35, 3.95)
        self.length = 5.4
        self.doors = (1.7, 3.3)
        self.slider = (2.15, 3.55)

    def _section(self, x):
        s = self.stations
        if x <= s[0][0]:
            return s[0]
        if x >= s[-1][0]:
            return s[-1]
        for i in range(len(s) - 1):
            a, b = s[i], s[i + 1]
            if a[0] <= x <= b[0]:
                t = (x - a[0]) / (b[0] - a[0])
                return tuple(a[k] + (b[k] - a[k]) * t for k in range(5))
        return s[-1]

    def panels(self):
        """Quads (4 points) used only for the depth buffer."""
        faces = []
        s = self.stations
        for i in range(len(s) - 1):
            a, b = s[i], s[i + 1]
            for sign in (1, -1):
                # rocker to belt
                faces.append([
                    (a[0], sign * a[1], a[2]), (b[0], sign * b[1], b[2]),
                    (b[0], sign * b[1], b[3]), (a[0], sign * a[1], a[3]),
                ])
                # belt to roof
                faces.append([
                    (a[0], sign * a[1] * 0.92, a[3]), (b[0], sign * b[1] * 0.92, b[3]),
                    (b[0], sign * b[1] * 0.72, b[4]), (a[0], sign * a[1] * 0.72, a[4]),
                ])
            # top
            faces.append([
                (a[0], a[1] * 0.72, a[4]), (b[0], b[1] * 0.72, b[4]),
                (b[0], -b[1] * 0.72, b[4]), (a[0], -a[1] * 0.72, a[4]),
            ])
            # hood / deck between belt width
            faces.append([
                (a[0], a[1], a[3]), (b[0], b[1], b[3]),
                (b[0], -b[1], b[3]), (a[0], -a[1], a[3]),
            ])
        # nose and tail caps
        a = s[0]
        faces.append([(a[0], a[1], a[2]), (a[0], -a[1], a[2]), (a[0], -a[1], a[3]), (a[0], a[1], a[3])])
        b = s[-1]
        faces.append([(b[0], b[1], b[2]), (b[0], -b[1], b[2]), (b[0], -b[1], b[3]), (b[0], b[1], b[3])])
        return faces

    def feature_lines(self):
        lines = []
        s = self.stations

        def chain(idx_y_sign, zkey, yscale=1.0):
            # zkey 2 rocker, 3 belt, 4 roof
            for sign in (1, -1):
                pts = []
                for st in s:
                    pts.append((st[0], sign * st[1] * yscale, st[zkey]))
                lines.append(pts)

        chain(1, 4, 0.72)   # roof rail
        chain(1, 3, 1.0)    # belt
        chain(1, 2, 1.0)    # rocker
        # centre crease on the hood and roof
        lines.append([(st[0], 0.0, st[4] if st[4] > st[3] + 0.15 else st[3] + 0.02) for st in s])
        # pillars: A and C, both sides
        for sign in (1, -1):
            a = s[3]
            lines.append([(a[0], sign * a[1], a[3]), (a[0], sign * a[1] * 0.72, a[4])])
            c = s[4] if len(s) > 5 else s[-2]
            lines.append([(c[0], sign * c[1], c[3]), (c[0], sign * c[1] * 0.72, c[4])])
            for dx in self.doors:
                sec = self._section(dx)
                lines.append([(dx, sign * sec[1], sec[2] + 0.04), (dx, sign * sec[1], sec[3])])
        # character line
        for sign in (1, -1):
            pts = []
            for st in s[1:-1]:
                pts.append((st[0], sign * st[1], (st[2] + st[3]) * 0.5))
            lines.append(pts)
        # glass outline, inset
        for sign in (1, -1):
            g = []
            for st in s[3:5]:
                g.append((st[0], sign * st[1] * 0.90, st[3] + 0.06))
            for st in reversed(s[3:5]):
                g.append((st[0], sign * st[1] * 0.78, st[4] - 0.06))
            if len(g) >= 4:
                lines.append(g + [g[0]])
        # lamps
        nose = s[0]
        for sign in (1, -1):
            y = sign * nose[1] * 0.62
            z = nose[3] - 0.02
            lines.append([(nose[0] + 0.01, y - 0.16 * sign, z - 0.06),
                          (nose[0] + 0.01, y + 0.16 * sign, z - 0.06),
                          (nose[0] + 0.01, y + 0.16 * sign, z + 0.06),
                          (nose[0] + 0.01, y - 0.16 * sign, z + 0.06),
                          (nose[0] + 0.01, y - 0.16 * sign, z - 0.06)])
        tail = s[-1]
        for sign in (1, -1):
            y = sign * tail[1] * 0.55
            z = (tail[2] + tail[3]) * 0.5
            lines.append([(tail[0] - 0.01, y - 0.22 * sign, z),
                          (tail[0] - 0.01, y + 0.22 * sign, z + 0.08),
                          (tail[0] - 0.01, y - 0.22 * sign, z)])
        # grille bars
        for k in range(4):
            z = nose[2] + 0.08 + k * 0.06
            lines.append([(nose[0] + 0.02, -0.28, z), (nose[0] + 0.02, 0.28, z)])
        # mirrors
        a = s[3]
        for sign in (1, -1):
            lines.append([(a[0] + 0.05, sign * a[1], a[3] + 0.05),
                          (a[0] + 0.12, sign * (a[1] + 0.16), a[3] + 0.08),
                          (a[0] + 0.28, sign * (a[1] + 0.16), a[3] + 0.06),
                          (a[0] + 0.22, sign * a[1], a[3] + 0.02)])
        # wheels
        for xw in self.wheel_x:
            sec = self._section(xw)
            for sign in (1, -1):
                cy = sign * (sec[1] + 0.02)
                cz = 0.34
                r = 0.34
                loop = []
                for i in range(49):
                    t = i / 48 * math.tau
                    loop.append((xw + math.cos(t) * r, cy, cz + math.sin(t) * r))
                lines.append(loop)
                inner = []
                for i in range(33):
                    t = i / 32 * math.tau
                    inner.append((xw + math.cos(t) * r * 0.62, cy, cz + math.sin(t) * r * 0.62))
                lines.append(inner)
                for k in range(5):
                    t = -math.pi / 2 + k * math.tau / 5
                    lines.append([
                        (xw + math.cos(t) * r * 0.22, cy, cz + math.sin(t) * r * 0.22),
                        (xw + math.cos(t) * r * 0.58, cy, cz + math.sin(t) * r * 0.58),
                    ])
        # wheel arches
        for xw in self.wheel_x:
            sec = self._section(xw)
            for sign in (1, -1):
                arch = []
                for i in range(19):
                    t = math.pi + i / 18 * math.pi
                    arch.append((xw + math.cos(t) * 0.46, sign * sec[1], 0.34 + math.sin(t) * 0.46))
                lines.append(arch)
        if getattr(self, "bed", False):
            # bed floor and tailgate
            bed_a, bed_b = self.stations[-2], self.stations[-1]
            lines.append([(bed_a[0], bed_a[1], 0.55), (bed_b[0], bed_b[1], 0.55),
                          (bed_b[0], -bed_b[1], 0.55), (bed_a[0], -bed_a[1], 0.55)])
            lines.append([(bed_b[0], bed_b[1] * 0.7, 0.55), (bed_b[0], -bed_b[1] * 0.7, 0.55)])
        if getattr(self, "slider", None):
            x0, x1 = self.slider
            for x in (x0, x1):
                sec = self._section(x)
                lines.append([(x, sec[1], sec[2]), (x, sec[1], sec[4] * 0.92)])
            sec0, sec1 = self._section(x0), self._section(x1)
            lines.append([(x0, sec0[1], sec0[4] * 0.9), (x1, sec1[1], sec1[4] * 0.9)])
        return lines


def render_car(kind, eye, target, w, h, fov=32):
    car = Car(kind)
    project = look_at(eye, target, (0, 0, 1), fov, w, h)
    zbuf = np.full((h, w), np.inf, np.float32)
    for face in car.panels():
        proj = [project(p) for p in face]
        if any(p is None for p in proj):
            continue
        raster_z(zbuf, proj[:3])
        raster_z(zbuf, [proj[0], proj[2], proj[3]])
    pen = Pen(w, h, scale=2)
    for line in car.feature_lines():
        pts = []
        for p in line:
            q = project(p)
            if q is None:
                if len(pts) > 1:
                    pen.line(pts)
                pts = []
                continue
            x, y, z = q
            xi, yi = int(x), int(y)
            if 0 <= xi < w and 0 <= yi < h and z <= zbuf[yi, xi] + 0.08:
                pts.append((x, y))
            else:
                if len(pts) > 1:
                    pen.line(pts)
                pts = []
        if len(pts) > 1:
            pen.line(pts)
    return pen.finish()


def save(name, im):
    path = os.path.join(OUT, name + ".png")
    im.save(path)
    print(name, im.size, os.path.getsize(path))


def exteriors():
    center = {
        "suv": (2.3, 0.0, 0.85),
        "truck": (2.8, 0.0, 0.95),
        "van": (2.7, 0.0, 1.05),
    }
    # High front three-quarter. Camera is above the driver's front corner.
    c = center["suv"]
    save("roof", render_car("suv", (c[0] - 3.4, c[1] + 3.1, c[2] + 3.6), c, 800, 480, 34))
    save("bedside", render_car("truck", (2.8, 7.2, 1.5), center["truck"], 920, 340, 28))
    save("bedtail", render_car("truck", (8.4, 0.15, 1.55), center["truck"], 800, 500, 30))
    save("bedhitch", render_car("truck", (7.2, 2.4, 2.8), (3.6, 0, 0.7), 800, 520, 36))
    save("sliding", render_car("van", (2.7, 7.4, 1.7), center["van"], 920, 400, 30))


def draw_headlight(p, w, h):
    p.bez((80, 250), (120, 90), (620, 70), (740, 190))
    p.bez((60, 300), (200, 400), (640, 410), (760, 280))
    p.bez((150, 175), (180, 250), (200, 310), (190, 345))
    p.bez((190, 345), (360, 400), (620, 370), (690, 250))
    p.bez((690, 250), (720, 180), (560, 120), (150, 175))
    p.ellipse(330, 255, 58, 46)
    p.ellipse(330, 255, 22, 18)
    p.line([(430, 205), (600, 198)])
    p.line([(455, 232), (575, 228)], width=1.6)
    for i, x in enumerate((90, 118, 146)):
        p.line([(x, 190 + i * 4), (x - 8, 320)])


def draw_wheel(p, w, h):
    cx, cy, r = w * 0.5, h * 0.56, min(w, h) * 0.34
    p.arc(cx, cy - r * 0.95, r * 1.35, r * 0.85, math.pi * 1.05, math.pi * 1.95)
    p.ellipse(cx, cy, r, r)
    p.ellipse(cx, cy, r * 0.86, r * 0.86, width=1.8)
    p.ellipse(cx, cy, r * 0.72, r * 0.72)
    p.ellipse(cx, cy, r * 0.22, r * 0.22)
    p.ellipse(cx, cy, r * 0.08, r * 0.08)
    for k in range(5):
        a = -math.pi / 2 + k * math.tau / 5
        a2 = a + 0.18
        p.line([
            (cx + math.cos(a) * r * 0.24, cy + math.sin(a) * r * 0.24),
            (cx + math.cos(a) * r * 0.68, cy + math.sin(a) * r * 0.68),
            (cx + math.cos(a2) * r * 0.68, cy + math.sin(a2) * r * 0.68),
            (cx + math.cos(a2) * r * 0.24, cy + math.sin(a2) * r * 0.24),
        ])
    for k in range(5):
        a = -math.pi / 2 + 0.35 + k * math.tau / 5
        p.ellipse(cx + math.cos(a) * r * 0.15, cy + math.sin(a) * r * 0.15, 7, 7, width=1.5)
    # sidewall grooves
    p.ellipse(cx, cy, r * 0.93, r * 0.93, width=1.4)


def draw_taillight(p, w, h):
    p.bez((70, 150), (200, 70), (600, 60), (740, 150))
    p.bez((50, 280), (220, 360), (600, 370), (760, 250))
    p.poly([(140, 155), (180, 310), (660, 295), (700, 150)], closed=True)
    p.line([(300, 170), (290, 300)])
    p.line([(470, 165), (480, 298)])
    p.line([(190, 215), (270, 210)])
    p.line([(330, 208), (440, 205)])
    p.line([(510, 204), (630, 198)])
    p.line([(200, 255), (250, 258)], width=1.6)
    p.line([(350, 252), (420, 250)], width=1.6)
    p.line([(530, 248), (600, 242)], width=1.6)


def draw_badge(p, w, h):
    p.poly([(70, 80), (730, 80), (750, 130), (740, 360), (80, 370), (50, 140)], closed=True)
    p.line([(60, 175), (740, 168)])
    p.ellipse(230, 265, 58, 58)
    p.poly([(230, 220), (268, 265), (230, 310), (192, 265)], closed=True)
    p.ellipse(230, 265, 10, 10)
    p.poly([(360, 230), (660, 226), (662, 300), (358, 304)], closed=True)
    x = 390
    for width in (48, 36, 22, 54, 28):
        p.line([(x, 262), (x + width, 262)])
        x += width + 16
    p.line([(120, 330), (680, 324)], width=1.6)


def draw_engine(p, w, h):
    p.poly([(120, 70), (170, 190), (630, 190), (690, 60)], closed=False)
    p.line([(170, 190), (630, 190)])
    p.poly([(150, 220), (650, 220), (640, 470), (160, 470)], closed=True)
    p.ellipse(210, 250, 36, 28)
    p.ellipse(590, 250, 36, 28)
    p.poly([(280, 280), (520, 275), (525, 400), (275, 405)], closed=True)
    p.line([(310, 320), (490, 316)])
    p.line([(315, 350), (485, 346)])
    p.bez((280, 330), (200, 320), (170, 270), (210, 245))
    p.poly([(530, 285), (620, 285), (618, 360), (528, 360)], closed=True)
    p.line([(555, 285), (555, 360)])
    p.line([(590, 285), (590, 360)])
    p.bez((200, 430), (320, 490), (500, 490), (600, 420))
    p.poly([(370, 168), (440, 168), (440, 196), (370, 196)], closed=True)


def draw_jamb(p, w, h):
    p.line([(70, 30), (70, h - 30)])
    p.line([(w - 70, 30), (w - 70, h - 30)])
    p.line([(70, 40), (140, 40)])
    p.line([(w - 140, 40), (w - 70, 40)])
    p.poly([(130, 140), (w - 130, 140), (w - 130, 470), (130, 470)], closed=True)
    y = 175
    spans = (0.85, 0.55, 0.78, 0.48, 0.72, 0.40, 0.66)
    for s in spans:
        p.line([(155, y), (155 + (w - 310) * s, y)], width=1.7)
        y += 28
    # barcode
    x = 155
    for i in range(18):
        p.line([(x, 390), (x, 450)], width=2.2 if i % 3 == 0 else 1.3)
        x += 12
    p.poly([(150, 510), (230, 510), (230, 640), (150, 640)], closed=True)
    p.ellipse(190, 555, 12, 12, width=1.6)
    p.line([(165, 600), (215, 600)], width=1.5)
    p.poly([(260, 520), (w - 150, 520), (w - 150, 620), (260, 620)], closed=True)
    for yy in (548, 572, 596):
        p.line([(280, yy), (w - 180, yy)], width=1.4)


def draw_gauges(p, w, h):
    p.poly([(50, 70), (w - 50, 70), (w - 40, 340), (40, 350)], closed=True)
    for cx in (230, 570):
        p.ellipse(cx, 210, 108, 108)
        p.ellipse(cx, 210, 78, 78, width=1.5)
        for k in range(11):
            a = math.radians(200 - k * 20)
            p.line([
                (cx + math.cos(a) * 86, 210 + math.sin(a) * 86),
                (cx + math.cos(a) * (100 if k % 2 == 0 else 94), 210 + math.sin(a) * (100 if k % 2 == 0 else 94)),
            ], width=1.6)
        p.ellipse(cx, 210, 8, 8)
    p.line([(230, 210), (292, 158)])
    p.line([(570, 210), (500, 168)])
    p.poly([(330, 175), (470, 175), (470, 245), (330, 245)], closed=True)
    p.line([(348, 200), (452, 200)], width=1.6)
    p.line([(348, 222), (420, 222)], width=1.5)
    p.arc(230, 250, 40, 22, 0.4, 2.4, width=1.6)
    p.arc(570, 250, 40, 22, math.pi - 2.4, math.pi - 0.4, width=1.6)


def draw_steering(p, w, h):
    cx, cy, r = w / 2, h / 2, min(w, h) * 0.36
    p.ellipse(cx, cy, r, r)
    p.ellipse(cx, cy, r * 0.78, r * 0.78)
    p.line([(cx, cy - r), (cx, cy - r * 0.78)])
    p.line([(cx - r * 0.55, cy + r * 0.45), (cx - r * 0.22, cy + r * 0.12)])
    p.line([(cx + r * 0.55, cy + r * 0.45), (cx + r * 0.22, cy + r * 0.12)])
    p.poly([
        (cx - r * 0.28, cy - r * 0.05), (cx + r * 0.28, cy - r * 0.05),
        (cx + r * 0.24, cy + r * 0.28), (cx - r * 0.24, cy + r * 0.28),
    ], closed=True)
    p.ellipse(cx, cy + r * 0.06, r * 0.1, r * 0.1)
    for sx in (-1, 1):
        p.poly([
            (cx + sx * r * 0.55, cy - r * 0.22),
            (cx + sx * r * 0.32, cy - r * 0.22),
            (cx + sx * r * 0.32, cy - r * 0.05),
            (cx + sx * r * 0.55, cy - r * 0.05),
        ], closed=True)
        for k in range(3):
            p.ellipse(cx + sx * (r * 0.38 + k * r * 0.07), cy - r * 0.135, 5, 5, width=1.4)
    p.line([(cx + r * 0.7, cy - r * 0.15), (cx + r * 1.05, cy - r * 0.15)])
    p.line([(cx + r * 0.98, cy - r * 0.28), (cx + r * 0.98, cy - r * 0.02)])
    p.line([(cx - r * 0.85, cy + r * 0.05), (cx - r * 1.08, cy + r * 0.05)], width=1.6)


def draw_screen(p, w, h):
    p.poly([(60, 40), (w - 60, 40), (w - 50, h - 50), (50, h - 50)], closed=True)
    p.poly([(95, 80), (w - 95, 80), (w - 100, h - 120), (100, h - 120)], closed=True)
    p.line([(120, 110), (420, 110)], width=1.5)
    for i, span in enumerate((180, 140, 160, 120, 150)):
        p.line([(130, 155 + i * 32), (130 + span, 155 + i * 32)], width=1.6)
    p.bez((360, 160), (430, 130), (520, 180), (560, 150))
    p.bez((560, 150), (640, 120), (660, 230), (600, 280))
    p.bez((600, 280), (520, 340), (400, 320), (370, 250))
    p.bez((370, 250), (340, 190), (340, 180), (360, 160))
    for i, cx in enumerate((360, 420, 480, 540)):
        p.ellipse(cx, h - 85, 12, 12, width=1.6)


def draw_backup(p, w, h):
    p.poly([(50, 36), (w - 50, 36), (w - 40, h - 40), (40, h - 40)], closed=True)
    p.poly([(90, 78), (w - 90, 78), (w - 100, h - 90), (100, h - 90)], closed=True)
    p.line([(140, 210), (w - 140, 210)], width=1.5)
    p.line([(250, h - 110), (340, 250)])
    p.line([(w - 250, h - 110), (w - 340, 250)])
    p.bez((320, h - 120), (400, 280), (w - 400, 280), (w - 320, h - 120))
    p.bez((360, h - 120), (400, 340), (w - 400, 340), (w - 360, h - 120))
    p.bez((280, h - 150), (400, 300), (w - 400, 300), (w - 280, h - 150))
    p.poly([(370, 330), (430, 330), (440, 300), (360, 300)], closed=True)
    p.ellipse(400, 292, 8, 8, width=1.4)


def draw_climate(p, w, h):
    p.poly([(40, 70), (w - 40, 70), (w - 50, h - 50), (50, h - 50)], closed=True)
    for cx, needle in ((190, -0.8), (w - 190, -2.3)):
        p.ellipse(cx, 220, 78, 78)
        for k in range(12):
            a = -2.6 + k * 0.38
            p.line([
                (cx + math.cos(a) * 58, 220 + math.sin(a) * 58),
                (cx + math.cos(a) * 70, 220 + math.sin(a) * 70),
            ], width=1.5)
        p.line([(cx, 220), (cx + math.cos(needle) * 48, 220 + math.sin(needle) * 48)])
        p.ellipse(cx, 220, 7, 7)
    p.poly([(300, 120), (w - 300, 120), (w - 300, 165), (300, 165)], closed=True)
    p.line([(320, 142), (w - 320, 142)], width=1.5)
    for i, x in enumerate((320, 390, 460)):
        p.poly([(x, 190), (x + 55, 190), (x + 55, 230), (x, 230)], closed=True)
    for sx in (330, 450):
        p.poly([(sx, 255), (sx + 70, 255), (sx + 70, 330), (sx, 330)], closed=True)
        p.poly([(sx + 14, 275), (sx + 36, 275), (sx + 36, 315), (sx + 14, 315)], closed=True)
        p.arc(sx + 25, 268, 10, 8, math.pi, math.tau, width=1.4, n=12)


def draw_sunroof(p, w, h):
    p.poly([(40, 40), (w - 40, 40), (w - 40, h - 40), (40, h - 40)], closed=True)
    p.poly([(130, 90), (w - 130, 90), (w - 130, h - 110), (130, h - 110)], closed=True)
    p.poly([(150, 250), (w - 150, 250), (w - 160, h - 130), (160, h - 130)], closed=True)
    p.line([(170, 300), (w - 170, 300)], width=1.5)
    p.line([(170, 345), (w - 170, 345)], width=1.5)
    p.line([(150, 120), (w - 150, 120)])
    p.line([(155, 100), (155, h - 120)], width=1.6)
    p.line([(w - 155, 100), (w - 155, h - 120)], width=1.6)
    p.ellipse(w / 2, 190, 16, 12, width=1.5)


def draw_headliner(p, w, h):
    p.poly([(36, 70), (w - 36, 60), (w - 50, h - 70), (50, h - 60)], closed=True)
    p.poly([(250, 150), (550, 145), (555, 250), (245, 255)], closed=True)
    p.ellipse(330, 198, 24, 20)
    p.ellipse(470, 196, 24, 20)
    p.poly([(385, 175), (425, 175), (425, 215), (385, 215)], closed=True)
    p.poly([(300, 230), (500, 228), (502, 258), (298, 260)], closed=True)
    p.poly([(70, 70), (250, 78), (230, 130), (80, 125)], closed=True)
    p.poly([(w - 70, 68), (w - 250, 76), (w - 230, 128), (w - 80, 122)], closed=True)
    p.poly([(70, 190), (150, 190), (150, 250), (70, 250)], closed=True)
    p.poly([(w - 70, 188), (w - 150, 188), (w - 150, 248), (w - 70, 248)], closed=True)
    p.poly([(280, 300), (520, 295), (525, 350), (275, 355)], closed=True)


def draw_rearseat(p, w, h):
    p.poly([(40, 36), (40, h - 40), (170, h - 40), (160, 80), (40, 36)], closed=False)
    p.line([(40, 36), (150, 36)])
    p.poly([(170, 90), (w - 40, 70), (w - 50, h - 70), (180, h - 60)], closed=True)
    p.line([(190, 250), (w - 70, 235)])
    for x in (250, 430, 600):
        p.poly([(x, 140), (x + 90, 135), (x + 90, 210), (x, 215)], closed=True)
        p.line([(x + 45, 215), (x + 45, 250)])
    p.line([(220, 250), (220, 400)], width=1.6)
    p.line([(460, 245), (470, 400)], width=1.6)
    p.bez((250, 300), (255, 360), (245, 390), (240, 370))
    p.poly([(80, 180), (145, 180), (145, 310), (90, 320)], closed=False)
    p.line([(95, 230), (140, 228)], width=1.5)


def draw_legroom(p, w, h):
    p.poly([(50, 50), (340, 60), (400, 170), (390, h - 50), (50, h - 40)], closed=True)
    p.poly([(100, 110), (300, 120), (330, 190), (110, 250)], closed=True)
    p.line([(170, 190), (165, 245)], width=1.5)
    p.poly([(430, 280), (w - 50, 250), (w - 40, h - 70), (400, h - 50)], closed=True)
    p.poly([(470, 320), (w - 90, 300), (w - 100, 400), (455, 420)], closed=True)
    p.line([(50, h - 55), (w - 40, h - 40)])
    p.bez((380, 200), (450, 250), (440, 340), (400, 400))


def draw_passeat(p, w, h):
    p.poly([(50, 40), (w - 60, 36), (w - 50, h - 40), (40, h - 36)], closed=True)
    p.poly([(140, 130), (w - 160, 120), (w - 180, 230), (160, 245)], closed=True)
    p.poly([(155, 245), (w - 175, 230), (w - 190, h - 230), (140, h - 210)], closed=True)
    p.poly([(185, 290), (w - 220, 280), (w - 230, h - 280), (175, h - 270)], closed=True)
    p.poly([(160, h - 210), (w - 180, h - 230), (w - 150, h - 140), (140, h - 130)], closed=True)
    p.poly([(w - 150, 250), (w - 90, 245), (w - 80, h - 240), (w - 155, h - 230)], closed=True)
    p.line([(w - 140, 320), (w - 100, 318)], width=1.5)
    p.line([(w - 140, 350), (w - 100, 348)], width=1.5)
    p.ellipse(w - 120, 400, 10, 8, width=1.4)
    p.line([(80, h - 150), (w - 80, h - 160)])
    p.line([(150, 130), (150, 90), (250, 85), (250, 125)])


def draw_cargo(p, w, h, folded=False):
    p.poly([(180, 40), (w - 180, 36), (w - 100, 150), (100, 155)], closed=True)
    p.poly([(230, 70), (w - 230, 66), (w - 180, 135), (180, 140)], closed=True)
    p.poly([(100, 155), (w - 100, 150), (w - 140, h - 50), (140, h - 45)], closed=True)
    if folded:
        p.poly([(170, 230), (w - 170, 220), (w - 200, h - 80), (200, h - 75)], closed=True)
        p.line([(175, 310), (w - 175, 300)])
        p.line([(250, 260), (250, 305)], width=1.6)
        p.line([(w - 250, 255), (w - 250, 300)], width=1.6)
        p.line([(230, 360), (w - 230, 350)], width=1.5)
        p.line([(240, 410), (w - 240, 400)], width=1.5)
    else:
        p.poly([(210, 250), (w - 210, 240), (w - 230, h - 90), (230, h - 85)], closed=True)
        p.line([(400, 250), (395, h - 90)], width=1.6)
        p.line([(200, 250), (200, 200), (300, 195)])
        p.line([(w - 200, 240), (w - 200, 190), (w - 300, 185)])
        p.poly([(150, 190), (230, 185), (230, 250), (155, 255)], closed=False)


def draw_keys(p, w, h):
    p.poly([(70, 80), (230, 70), (240, 340), (60, 350)], closed=True)
    p.ellipse(150, 150, 18, 16)
    for i, y in enumerate((210, 250, 290)):
        p.poly([(120, y), (180, y), (180, y + 24), (120, y + 24)], closed=True)
    p.poly([(280, 110), (420, 100), (430, 340), (270, 350)], closed=True)
    p.ellipse(345, 175, 16, 14)
    p.poly([(310, 220), (370, 220), (370, 244), (310, 244)], closed=True)
    p.poly([(310, 258), (370, 258), (370, 282), (310, 282)], closed=True)
    p.line([(460, 250), (540, 250), (575, 215), (640, 215), (640, 250), (700, 250)])
    p.ellipse(455, 250, 16, 16)
    p.ellipse(500, 232, 6, 6, width=1.4)
    p.poly([(140, 380), (400, 370), (410, 460), (130, 470)], closed=True)
    p.line([(165, 410), (370, 402)], width=1.5)
    p.line([(165, 435), (330, 428)], width=1.5)
    p.poly([(450, 300), (730, 290), (740, 450), (440, 460)], closed=True)
    p.poly([(480, 270), (580, 265), (575, 300), (485, 305)], closed=True)
    for y in (340, 372, 404):
        p.line([(480, y), (680, y - 6)], width=1.5)


def draw_thirdrow(p, w, h):
    p.line([(40, 40), (40, h - 40), (180, h - 50)])
    p.line([(40, 40), (150, 40)])
    p.poly([(190, 130), (430, 110), (450, 300), (200, 320)], closed=True)
    p.poly([(250, 165), (390, 155), (395, 230), (250, 240)], closed=True)
    p.poly([(460, 150), (w - 50, 120), (w - 60, h - 80), (400, h - 70)], closed=True)
    p.line([(490, 250), (w - 90, 230)])
    for x in (520, 650):
        p.poly([(x, 170), (x + 80, 165), (x + 80, 240), (x, 245)], closed=True)
        p.line([(x + 40, 245), (x + 40, 250)])
    p.line([(530, 300), (530, 410)], width=1.6)
    p.line([(680, 290), (690, 400)], width=1.6)
    p.poly([(w - 130, 80), (w - 50, 70), (w - 50, 200), (w - 140, 210)], closed=False)
    p.poly([(70, 200), (150, 195), (150, 330), (80, 340)], closed=False)


def flat(name, w, h, fn):
    pen = Pen(w, h, scale=3)
    fn(pen, w, h)
    save(name, pen.finish())


def main():
    os.makedirs(OUT, exist_ok=True)
    exteriors()
    flat("headlight", 800, 440, draw_headlight)
    flat("wheel", 640, 680, draw_wheel)
    flat("taillight", 800, 400, draw_taillight)
    flat("badge", 800, 440, draw_badge)
    flat("engine", 800, 520, draw_engine)
    flat("jamb", 500, 780, draw_jamb)
    flat("gauges", 800, 440, draw_gauges)
    flat("steering", 680, 680, draw_steering)
    flat("screen", 800, 500, draw_screen)
    flat("backup", 800, 500, draw_backup)
    flat("climate", 800, 420, draw_climate)
    flat("sunroof", 800, 520, draw_sunroof)
    flat("headliner", 800, 460, draw_headliner)
    flat("rearseat", 800, 500, draw_rearseat)
    flat("legroom", 800, 520, draw_legroom)
    flat("passeat", 620, 780, draw_passeat)
    flat("cargo", 800, 520, lambda p, w, h: draw_cargo(p, w, h, False))
    flat("folded", 800, 520, lambda p, w, h: draw_cargo(p, w, h, True))
    flat("keys", 800, 480, draw_keys)
    flat("thirdrow", 800, 520, draw_thirdrow)


if __name__ == "__main__":
    main()
