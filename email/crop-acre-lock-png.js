#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const destDir = path.join(root, "start-bgs", "gr-corolla");
const candidates = [
  path.join(root, "acre-detail-refs", "04-home-desk-exact.png"),
  "/tmp/acre-ref/04-home-desk-exact.png"
];
const src = candidates.find(function (p) { return fs.existsSync(p); });
if (!src) {
  console.error("crop-acre-lock-png: no 04-home-desk-exact.png yet");
  process.exit(2);
}

function pngSize(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString("ascii", 0, 8) !== "\x89PNG\r\n\x1a\n") throw new Error("not a PNG");
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

const dim = pngSize(src);
const baseW = 1690;
const baseH = 899;
const sx = dim.w / baseW;
const sy = dim.h / baseH;

function box(x1, y1, x2, y2) {
  const x = Math.max(0, Math.round(x1 * sx));
  const y = Math.max(0, Math.round(y1 * sy));
  const w = Math.max(8, Math.round((x2 - x1) * sx));
  const h = Math.max(8, Math.round((y2 - y1) * sy));
  return { x: x, y: y, w: Math.min(w, dim.w - x), h: Math.min(h, dim.h - y) };
}

const crops = {
  "hero.jpg": box(55, 78, 548, 488),
  "01.jpg": box(48, 608, 372, 798),
  "02.jpg": box(388, 608, 718, 798),
  "03.jpg": box(750, 608, 1064, 798),
  "04.jpg": box(1100, 608, 1418, 798),
  "05.jpg": box(1426, 608, 1678, 798)
};

function ffmpegCrop(outName, r) {
  const out = path.join(destDir, outName);
  const vf = "crop=" + r.w + ":" + r.h + ":" + r.x + ":" + r.y;
  const args = ["-y", "-i", src, "-vf", vf, "-q:v", "2", out];
  const res = spawnSync("ffmpeg", args, { encoding: "utf8" });
  if (res.status !== 0) {
    console.error(res.stderr || res.stdout);
    throw new Error("ffmpeg failed for " + outName);
  }
  console.log("wrote", outName, r.w + "x" + r.h, "from", r.x + "," + r.y);
}

console.log("lock PNG", src, dim.w + "x" + dim.h, "scale", sx.toFixed(3), sy.toFixed(3));
Object.keys(crops).forEach(function (name) { ffmpegCrop(name, crops[name]); });
console.log("crop-acre-lock-png: ok");
