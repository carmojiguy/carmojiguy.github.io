/**
 * Website photos studio — catalog, local enhance, History, samples.
 * No API keys live here. Remote enhance is optional via /api/photo-enhance.
 */
(function (root) {
  "use strict";

  var WS = {};
  WS.DAMAGE_COPY = "Damage stays. Dirt goes.";
  WS.DAMAGE_STAYS_PROMPT =
    "Damage stays. Dirt goes. Remove dirt, dust, and grime only. " +
    "Make the vehicle look freshly detailed, including a dirty interior. " +
    "Do not inpaint, heal, blur, or reconstruct scratches, dents, chips, " +
    "cracks, rust, or broken glass. Lighting and exposure polish is allowed.";
  WS.HISTORY_KEY = "inspect.webStudio.history";
  WS.SAMPLE_VER = "webstudio5";
  WS.INTERIOR = { dash: 1, console: 1, interior: 1 };
  WS.VIEW_ORDER = [
    "qfront", "front", "driver", "qrear_drv", "rear", "qrear_pass",
    "pass", "qfront_pass", "dash", "console", "tire", "interior"
  ];
  WS.VIEW_LABELS = {
    qfront: "3/4 Front",
    front: "Front",
    driver: "Driver side",
    qrear_drv: "3/4 Rear driver",
    rear: "Rear",
    qrear_pass: "3/4 Rear passenger",
    pass: "Passenger side",
    qfront_pass: "3/4 Front passenger",
    dash: "Dashboard",
    console: "Console",
    tire: "Tire",
    interior: "Driver interior"
  };

  function wiki(name) {
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" +
      encodeURIComponent(name) + "?width=1400";
  }

  function plate(id, name, file) {
    var v = "20261008d";
    return {
      id: id,
      name: name,
      src: "backgrounds/gm-studio/" + file + "-4x3.jpg?v=" + v,
      wide: "backgrounds/gm-studio/" + file + "-16x9.jpg?v=" + v
    };
  }

  WS.CATALOG = {
    studio: [
      plate("gm-silver", "Light grey studio", "silver"),
      plate("gm-white", "Bright white studio", "white"),
      plate("gm-warm", "Warm grey studio", "warm"),
      plate("gm-charcoal", "Charcoal studio", "charcoal")
    ]
  };

  WS.SERIES = [
    { id: "studio", label: "Studio" }
  ];

  function allPlates() {
    return WS.CATALOG.studio.slice();
  }
  WS.allPlates = allPlates;

  WS.plateById = function (id) {
    var list = allPlates();
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  };

  WS.INTERIOR = {
    dash: 1, console: 1, interior: 1,
    jamb: 1, gauges: 1, steering: 1, screen: 1, backup: 1,
    climate: 1, sunroof: 1, headliner: 1, rearseat: 1, legroom: 1,
    passeat: 1, cargo: 1, folded: 1, keys: 1
  };

  WS.isInterior = function (viewId) {
    if (!viewId) return false;
    var kind = typeof root.websiteBodyKind === "function" ? root.websiteBodyKind() : "";
    if (kind === "truck" && (viewId === "sunroof" || viewId === "cargo" || viewId === "folded")) return false;
    if (kind === "van" && viewId === "rearseat") return false;
    return !!WS.INTERIOR[viewId];
  };

  WS.carProfile = function (viewId) {
    var map = {
      qfront: "qfront", qfront_pass: "qfront", qrear_drv: "qfront", qrear_pass: "qfront", roof: "qfront",
      driver: "side", pass: "side",
      front: "front", rear: "rear"
    };
    var kind = typeof root.websiteBodyKind === "function" ? root.websiteBodyKind() : "";
    if (kind === "truck" && viewId === "sunroof") return "side";
    if (kind === "truck" && (viewId === "cargo" || viewId === "folded")) return "rear";
    if (kind === "van" && viewId === "rearseat") return "side";
    return map[viewId] || "";
  };

  function svgEsc(s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  WS.plateSvg = function (p) {
    if (!p) return "";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 450" width="800" height="450">' +
      '<rect width="800" height="450" fill="#E6E8EC"/>' +
      '<text x="40" y="416" fill="#12141A" font-family="Inter,system-ui,sans-serif" font-size="20" font-weight="700">' +
      svgEsc(p.name) + "</text></svg>";
  };

  WS.plateDataUri = function (p) {
    if (p && p.src) return p.src;
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(WS.plateSvg(p));
  };

  WS.shouldApplyBackground = function (viewId, plateId, keepBackground) {
    if (keepBackground) return false;
    if (!plateId) return false;
    if (!WS.plateById(plateId)) return false;
    if (WS.isInterior(viewId)) return false;
    if (!WS.carProfile(viewId)) return false;
    return true;
  };

  function walkFrom(files) {
    var out = {};
    WS.VIEW_ORDER.forEach(function (id) {
      var name = files[id];
      if (!name) return;
      out[id] = wiki(name);
    });
    return out;
  }

  /**
   * Five accurate website packages. Every image filename contains the
   * vehicle token (F-150, Civic, GR Corolla, CX-5, Wrangler). Slots
   * follow the live VIEWS walk order. No mismatched stock.
   */
  WS.SAMPLES = [
    {
      id: "ws-sample-f150",
      label: "2024 Ford F-150 XLT SuperCrew",
      year: "2024", make: "Ford", model: "F-150", trim: "XLT SuperCrew",
      color: "Oxford White", km: "28600", vin: "1FTFW1E50RFA44120", stock: "W-1504",
      token: "F-150",
      series: "dealership", backgroundId: "dlr-01", keepBackground: false, retouchOn: true,
      postedAtOffset: 2.1,
      photos: walkFrom({
        qfront: "2021 Ford F150 Supercrew, Front Right, 03-09-2021.jpg",
        front: "2024 Ford F-150 XLT front view.jpg",
        driver: "Ford F-150 V8 XLT 2021.jpg",
        qrear_drv: "2021 Ford F-150 SuperCrew, rear 4.28.21.jpg",
        rear: "2024 Ford F-150 XLT rear view.jpg",
        qrear_pass: "2022 Ford F-150 Supercrew, rear 5.2.22.jpg",
        pass: "Ford F-150 XLT Pickup Truck (53150027120).jpg",
        qfront_pass: "2021 Ford F-150 SuperCrew, front 4.28.21.jpg",
        dash: "2025 Ford F-150 12-inch Cluster-Off-Road drive mode.jpg",
        console: "2025 Ford F-150 PowerBoost Lariat-EV driving mode.jpg",
        tire: "Ford F-150 Lariat V8 Sport FX4 2024 (54481296733).jpg",
        interior: "2022 Ford F-150 interior.jpg"
      })
    },
    {
      id: "ws-sample-civic",
      label: "2023 Honda Civic Sport",
      year: "2023", make: "Honda", model: "Civic", trim: "Sport",
      color: "Rallye Red", km: "18000", vin: "2HGFE2F54RH543210", stock: "W-4412",
      token: "Civic",
      series: "dealership", backgroundId: "dlr-04", keepBackground: false, retouchOn: true,
      postedAtOffset: 1.4,
      photos: walkFrom({
        qfront: "2023 Honda Civic Sport Sedan in Rallye Red, front right, 2024-09-29.jpg",
        front: "23 Honda Civic Sport.jpg",
        driver: "2023 Honda Civic Sport Sedan in Rallye Red, Front Left, 04-07-2023.jpg",
        qrear_drv: "2022 Honda Civic Sport, Rear Right, 06-20-2021.jpg",
        rear: "2022 Honda Civic, rear 12.15.21.jpg",
        qrear_pass: "Honda Civic (2021) sedan Sport DSC 7057.jpg",
        pass: "Honda Civic (2021) sedan Sport DSC 7055.jpg",
        qfront_pass: "2022 Honda Civic Sport, Front Right, 06-20-2021.jpg",
        dash: "2021 Honda Civic RS 1.5 FE1 interior (20211117).jpg",
        console: "Honda Civic FE1 FL 1.5 RS Turbo interior.jpg",
        tire: "Honda Civic (2021) sedan Sport DSC 7056.jpg",
        interior: "2021 Honda Civic RS sedan (Indonesia) interior.jpg"
      })
    },
    {
      id: "ws-sample-grcorolla",
      label: "2023 Toyota GR Corolla Core",
      year: "2023", make: "Toyota", model: "GR Corolla", trim: "Core",
      color: "White", km: "10500", vin: "JTNABAAE8PA003162", stock: "A-1184",
      token: "GR Corolla",
      series: "landscape", backgroundId: "lnd-01", keepBackground: false, retouchOn: true,
      postedAtOffset: 0.6,
      photos: walkFrom({
        qfront: "2023 Toyota GR Corolla, front NYIAS 2022.jpg",
        front: "2023 Toyota GR Corolla, front NYIAS 2022.jpg",
        driver: "GRCorollaGZEA14KitaIkebukuro.jpg",
        qrear_drv: "GRCorollaGZEA14KitaIkebukuroR.jpg",
        rear: "2023 Toyota GR Corolla, rear NYIAS 2022.jpg",
        qrear_pass: "2023 Toyota GR Corolla, rear NYIAS 2022.jpg",
        pass: "GRCorollaGZEA14KitaIkebukuro.jpg",
        qfront_pass: "GRCorollaGZEA14KitaIkebukuro.jpg",
        dash: "The interior of Toyota GR COROLLA RZ (4BA-GZEA14H-BHFRZ).jpg",
        console: "Toyota GR COROLLA RZ (4BA-GZEA14H-BHFRZ) interior.jpg",
        tire: "2023 Toyota GR Corolla, front NYIAS 2022.jpg",
        interior: "2022 Toyota GR Corolla Morizo Edition (Japan) interior.png"
      })
    },
    {
      id: "ws-sample-cx5",
      label: "2017 Mazda CX-5 GT",
      year: "2017", make: "Mazda", model: "CX-5", trim: "GT",
      color: "Soul Red", km: "88000", vin: "JM3KFBDM5L0147890", stock: "W-2208",
      token: "CX-5",
      series: "landscape", backgroundId: "lnd-03", keepBackground: false, retouchOn: true,
      postedAtOffset: 4.2,
      photos: walkFrom({
        qfront: "The frontview of Mazda CX-5 XD L Package 4WD (LDA-KF2P).jpg",
        front: "Mazda CX-5 XD L Package 4WD (LDA-KF2P) front.jpg",
        driver: "Mazda CX-5 (KF) Facelift 1X7A6070.jpg",
        qrear_drv: "The rearview of Mazda CX-5 XD L Package 4WD (LDA-KF2P).jpg",
        rear: "Mazda CX-5 XD L Package 4WD (LDA-KF2P) rear.jpg",
        qrear_pass: "The rearview of Mazda CX-5 XD L Package 4WD (LDA-KF2P).jpg",
        pass: "Mazda CX-5 25S Silk Beige Selection (6BA-KF5P) front.jpg",
        qfront_pass: "Mazda CX-5 XD L Package 4WD (LDA-KF2P) front.jpg",
        dash: "Mazda CX-5 XD L Package 4WD (LDA-KF2P) interior.jpg",
        console: "Mazda CX-5 XD L Package 4WD (LDA-KF2P) interior.jpg",
        tire: "The tire wheel of Mazda CX-5 XD L Package 4WD (LDA-KF2P).jpg",
        interior: "Mazda CX-5 XD L Package 4WD (LDA-KF2P) interior.jpg"
      })
    },
    {
      id: "ws-sample-wrangler",
      label: "2024 Jeep Wrangler Unlimited Sahara",
      year: "2024", make: "Jeep", model: "Wrangler", trim: "Unlimited Sahara",
      color: "Silver Zynith", km: "14200", vin: "1C4HJXDN5RW640118", stock: "W-8810",
      token: "Wrangler",
      series: "landmark", backgroundId: "lmk-21", keepBackground: false, retouchOn: true,
      postedAtOffset: 6.5,
      photos: walkFrom({
        qfront: "2024 Jeep Wrangler four-door Sahara in Silver Zynith, front right, 2026-06-06.jpg",
        front: "2024 Jeep Wrangler Sahara Unlimited.jpg",
        driver: "Jeep Wrangler Sahara Seite.JPG",
        qrear_drv: "Jeep Wrangler Unlimited 2.2 CRDi Sahara (JL) – h 08052021.jpg",
        rear: "2024 Jeep Wrangler four-door Sahara in Silver Zynith, rear right, 2026-06-06.jpg",
        qrear_pass: "2024 Jeep Wrangler four-door Sahara in Silver Zynith, rear right, 2026-06-06.jpg",
        pass: "24 Jeep Wrangler Unlimited Sahara.jpg",
        qfront_pass: "Jeep Wrangler Unlimited 2.2 CRDi Sahara (JL) – f 08052021.jpg",
        dash: "2024 Jeep Wrangler Unlimited interior.jpg",
        console: "2023 Jeep Wrangler Unlimited interior.jpg",
        tire: "Jeep Wrangler Spare Wheel Cover Millennial Anti-Theft.jpg",
        interior: "2024 Jeep Wrangler Unlimited interior.jpg"
      })
    }
  ];

  WS.samplePhotoCount = function (sample) {
    return Object.keys((sample && sample.photos) || {}).length;
  };

  WS.assertSampleAccuracy = function (sample) {
    var token = sample.token;
    var files = sample.photos || {};
    var missing = [];
    WS.VIEW_ORDER.forEach(function (id) {
      if (!files[id]) missing.push(id);
    });
    if (missing.length) return { ok: false, reason: "missing views " + missing.join(",") };
    var label = (sample.label || "") + " " + (sample.model || "");
    if (label.toLowerCase().indexOf(token.toLowerCase()) < 0) {
      return { ok: false, reason: "label missing token " + token };
    }
    var compact = String(token || "").toLowerCase().replace(/[-_\s]/g, "");
    var bad = [];
    Object.keys(files).forEach(function (id) {
      var url = decodeURIComponent(files[id] || "").toLowerCase().replace(/[-_\s]/g, "");
      if (url.indexOf(compact) < 0) bad.push(id);
    });
    if (bad.length) return { ok: false, reason: "mismatched stock on " + bad.join(",") };
    return { ok: true };
  };

  function emptyStudio() {
    return {
      tab: "studio",
      flow: "photos",
      retouchOn: true,
      keepBackground: true,
      series: "studio",
      backgroundId: "gm-silver",
      blurPlate: false,
      originals: {},
      enhanced: {},
      approved: {},
      demo: false,
      engine: "local",
      busy: false,
      fromHistory: false,
      packageId: ""
    };
  }

  function mediaKey(id) { return "inspect.webStudio.media." + id; }

  function readJson(storeGet, key, fallback) {
    try {
      var raw = storeGet ? storeGet(key) : null;
      if (!raw && typeof localStorage !== "undefined") raw = localStorage.getItem(key);
      if (!raw) return fallback;
      var v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (e) { return fallback; }
  }

  function writeJson(storeSet, key, val) {
    var s = JSON.stringify(val);
    if (storeSet) storeSet(key, s);
    else {
      try { localStorage.setItem(key, s); } catch (e1) {}
      try { sessionStorage.setItem(key, s); } catch (e2) {}
    }
  }

  WS.loadHistoryMeta = function (hooks) {
    hooks = hooks || {};
    var list = readJson(hooks.storeGet, WS.HISTORY_KEY, []);
    return Array.isArray(list) ? list : [];
  };

  WS.saveHistoryMeta = function (list, hooks) {
    hooks = hooks || {};
    writeJson(hooks.storeSet, WS.HISTORY_KEY, list || []);
    return list;
  };

  WS.upsertHistory = function (meta, media, hooks) {
    hooks = hooks || {};
    var list = WS.loadHistoryMeta(hooks);
    var i = -1;
    list.forEach(function (x, n) { if (x && x.id === meta.id) i = n; });
    var slim = {};
    Object.keys(meta || {}).forEach(function (k) {
      if (k !== "photos" && k !== "originals" && k !== "enhanced") slim[k] = meta[k];
    });
    slim.updatedAt = Date.now();
    slim.photoCount = slim.photoCount || (media && media.originals ? Object.keys(media.originals).length : 0);
    if (i >= 0) list[i] = Object.assign({}, list[i], slim);
    else list.unshift(slim);
    WS.saveHistoryMeta(list, hooks);
    if (hooks.idbPut && media) hooks.idbPut(mediaKey(meta.id), media);
    else writeJson(hooks.storeSet, mediaKey(meta.id), media || {});
    return slim;
  };

  WS.loadHistoryMedia = function (id, hooks) {
    hooks = hooks || {};
    if (hooks.idbGet) {
      return Promise.resolve(hooks.idbGet(mediaKey(id))).then(function (v) {
        if (v && v.originals) return v;
        return readJson(hooks.storeGet, mediaKey(id), { originals: {}, enhanced: {}, approved: {} });
      });
    }
    return Promise.resolve(readJson(hooks.storeGet, mediaKey(id), { originals: {}, enhanced: {}, approved: {} }));
  };

  function daysAgo(n) { return Date.now() - Math.round(n * 86400000); }

  WS.sampleToHistory = function (sample) {
    var posted = daysAgo(sample.postedAtOffset || 1);
    return {
      id: sample.id,
      sample: true,
      sampleVer: WS.SAMPLE_VER,
      label: sample.label,
      year: sample.year, make: sample.make, model: sample.model, trim: sample.trim,
      color: sample.color, km: sample.km, vin: sample.vin, stock: sample.stock,
      token: sample.token,
      retouchOn: sample.retouchOn !== false,
      keepBackground: !!sample.keepBackground,
      series: sample.series || "dealership",
      backgroundId: sample.backgroundId || "",
      blurPlate: false,
      status: "posted",
      createdAt: posted,
      updatedAt: posted,
      postedAt: posted,
      photoCount: WS.samplePhotoCount(sample),
      thumb: sample.photos.qfront || sample.photos.front || ""
    };
  };

  WS.seedSamples = function (hooks) {
    hooks = hooks || {};
    var list = WS.loadHistoryMeta(hooks);
    var stale = list.some(function (x) { return x && x.sample && x.sampleVer !== WS.SAMPLE_VER; });
    if (stale) list = list.filter(function (x) { return !(x && x.sample && x.sampleVer !== WS.SAMPLE_VER); });
    var have = {};
    list.forEach(function (x) { if (x && x.id) have[x.id] = true; });
    var added = 0;
    WS.SAMPLES.forEach(function (s) {
      if (have[s.id]) return;
      var meta = WS.sampleToHistory(s);
      list.push(meta);
      var originals = {};
      var approved = {};
      Object.keys(s.photos).forEach(function (id) {
        originals[id] = s.photos[id];
        approved[id] = true;
      });
      if (hooks.idbPut) hooks.idbPut(mediaKey(s.id), { originals: originals, enhanced: {}, approved: approved });
      else writeJson(hooks.storeSet, mediaKey(s.id), { originals: originals, enhanced: {}, approved: approved });
      added++;
    });
    list.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    if (stale || added) WS.saveHistoryMeta(list, hooks);
    return list;
  };

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      if (typeof Image === "undefined") return reject(new Error("no Image"));
      var img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error("img")); };
      img.src = src;
    });
  }

  function makeCanvas(w, h) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    return c;
  }

  function drawCover(ctx, img, w, h) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    var t = w / h;
    var sx = 0, sy = 0, sw = iw, sh = ih;
    if (iw / ih > t) { sw = ih * t; sx = (iw - sw) / 2; }
    else { sh = iw / t; sy = (ih - sh) / 2; }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  }

  function drawContainLower(ctx, img, w, h, scale) {
    var iw = img.naturalWidth || img.width;
    var ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    scale = scale || 0.86;
    var maxW = w * scale;
    var maxH = h * 0.72;
    var r = Math.min(maxW / iw, maxH / ih);
    var dw = iw * r, dh = ih * r;
    var dx = (w - dw) / 2;
    var dy = h - dh - h * 0.08;
    ctx.save();
    ctx.fillStyle = "rgba(8,10,16,.35)";
    ctx.beginPath();
    ctx.ellipse(w / 2, dy + dh - 8, dw * 0.42, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  function blurPlateRegion(ctx, w, h) {
    var x = Math.round(w * 0.38);
    var y = Math.round(h * 0.62);
    var bw = Math.round(w * 0.24);
    var bh = Math.round(h * 0.1);
    try {
      var data = ctx.getImageData(x, y, bw, bh);
      var copy = new Uint8ClampedArray(data.data);
      var r = 6;
      for (var py = 0; py < bh; py++) {
        for (var px = 0; px < bw; px++) {
          var rs = 0, gs = 0, bs = 0, n = 0;
          for (var oy = -r; oy <= r; oy += 2) {
            for (var ox = -r; ox <= r; ox += 2) {
              var xx = px + ox, yy = py + oy;
              if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue;
              var i = (yy * bw + xx) * 4;
              rs += copy[i]; gs += copy[i + 1]; bs += copy[i + 2]; n++;
            }
          }
          var o = (py * bw + px) * 4;
          data.data[o] = rs / n; data.data[o + 1] = gs / n; data.data[o + 2] = bs / n;
        }
      }
      ctx.putImageData(data, x, y);
    } catch (e) {}
  }

  function plateGeom(w, h) {
    var wide = w / h >= 1.5;
    var cx = w * 0.5;
    var cy = h * (wide ? 0.80 : 0.74);
    var rx = w * (wide ? 0.36 : 0.38);
    var ry = rx * (wide ? 0.17 : 0.22);
    return { cx: cx, cy: cy, rx: rx, ry: ry, ground: cy + ry * 0.08 };
  }

  function isGhostSrc(src) {
    var s = String(src || "");
    return !s || s.indexOf("ghosts/") >= 0;
  }

  async function loadCutoutModel() {
    if (root._gmRemoveBg) return root._gmRemoveBg;
    if (root._gmCutoutFailed) return null;
    try {
      var mod = await import("https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.6.0/dist/index.mjs");
      root._gmRemoveBg = mod.removeBackground;
      return root._gmRemoveBg;
    } catch (e) {
      root._gmCutoutFailed = true;
      return null;
    }
  }

  function glassPass(canvas) {
    var ctx = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;
    var img = ctx.getImageData(0, 0, w, h);
    var d = img.data;
    var fg = new Uint8Array(w * h);
    var i, x, y, p;
    for (i = 0; i < w * h; i++) fg[i] = d[i * 4 + 3] > 24 ? 1 : 0;
    var outside = new Uint8Array(w * h);
    var stack = [];
    function push(px, py) {
      if (px < 0 || py < 0 || px >= w || py >= h) return;
      var q = py * w + px;
      if (outside[q] || fg[q]) return;
      outside[q] = 1;
      stack.push(q);
    }
    for (x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      p = stack.pop();
      y = Math.floor(p / w);
      x = p - y * w;
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
    }
    var ys = [], xs = [];
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (fg[y * w + x]) { ys.push(y); xs.push(x); }
    if (!ys.length) return canvas;
    var y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var band = y0 + (y1 - y0) * 0.62;
    for (y = y0; y < band; y++) {
      for (x = 0; x < w; x++) {
        p = y * w + x;
        if (fg[p] || outside[p]) continue;
        var o = p * 4;
        d[o] = 28; d[o + 1] = 32; d[o + 2] = 36; d[o + 3] = 118;
      }
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  function trimCanvas(src) {
    var ctx = src.getContext("2d");
    var w = src.width, h = src.height;
    var d = ctx.getImageData(0, 0, w, h).data;
    var minX = w, minY = h, maxX = 0, maxY = 0, y, x, a;
    for (y = 0; y < h; y++) {
      for (x = 0; x < w; x++) {
        a = d[(y * w + x) * 4 + 3];
        if (a > 16) {
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX <= minX || maxY <= minY) return src;
    var c = makeCanvas(maxX - minX + 1, maxY - minY + 1);
    c.getContext("2d").drawImage(src, minX, minY, c.width, c.height, 0, 0, c.width, c.height);
    return c;
  }

  async function cutoutCar(img) {
    var removeBackground = await loadCutoutModel();
    if (!removeBackground) return null;
    try {
      var blob = await fetch(img.src).then(function (r) { return r.blob(); });
      var png = await removeBackground(blob, {
        model: "medium",
        output: { format: "image/png", quality: 0.9 }
      });
      var url = URL.createObjectURL(png);
      var cut = await loadImage(url);
      var c = makeCanvas(cut.naturalWidth || cut.width, cut.naturalHeight || cut.height);
      c.getContext("2d").drawImage(cut, 0, 0);
      URL.revokeObjectURL(url);
      return trimCanvas(glassPass(c));
    } catch (e) {
      root._gmCutoutFailed = true;
      return null;
    }
  }

  function compositeStudio(ctx, plateImg, car, viewId, w, h) {
    var geom = plateGeom(w, h);
    var profile = WS.carProfile(viewId) || "qfront";
    var widthFrac = { qfront: 0.60, side: 0.78, front: 0.48, rear: 0.50 }[profile] || 0.60;
    drawCover(ctx, plateImg, w, h);
    var targetW = Math.round(w * widthFrac);
    var scale = targetW / car.width;
    var targetH = Math.max(1, Math.round(car.height * scale));
    var logoBottom = Math.round(h * 0.045 + w * 0.20 + h * 0.02);
    var maxH = Math.round(geom.ground - logoBottom);
    if (targetH > maxH && maxH > 40) {
      scale *= maxH / targetH;
      targetW = Math.max(1, Math.round(car.width * scale));
      targetH = Math.max(1, Math.round(car.height * scale));
    }
    var left = Math.round(geom.cx - targetW / 2);
    var top = Math.round(geom.ground - targetH);
    ctx.save();
    ctx.filter = "blur(16px)";
    ctx.fillStyle = "rgba(18,20,26,0.38)";
    ctx.beginPath();
    ctx.ellipse(geom.cx, geom.ground, targetW * 0.36, Math.max(8, h * 0.016), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    var keep = Math.max(8, Math.round(targetH * 0.22));
    var refl = makeCanvas(targetW, keep);
    var rctx = refl.getContext("2d");
    rctx.translate(0, keep);
    rctx.scale(1, -1);
    rctx.drawImage(car, 0, car.height - Math.round(car.height * 0.22), car.width, Math.round(car.height * 0.22), 0, 0, targetW, keep);
    var rid = rctx.getImageData(0, 0, targetW, keep);
    var rd = rid.data, yy, xx, o, fade;
    for (yy = 0; yy < keep; yy++) {
      fade = 0.34 * (1 - yy / Math.max(1, keep - 1));
      for (xx = 0; xx < targetW; xx++) {
        o = (yy * targetW + xx) * 4;
        rd[o + 3] = Math.round(rd[o + 3] * fade);
      }
    }
    rctx.putImageData(rid, 0, 0);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(geom.cx, geom.cy, geom.rx, geom.ry, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(refl, left, Math.round(geom.ground) - 2);
    ctx.restore();
    if (ctx.filter !== undefined) ctx.filter = "contrast(1.06) saturate(1.04) brightness(1.03)";
    ctx.drawImage(car, left, top, targetW, targetH);
    ctx.filter = "none";
  }

  async function localItem(item, opts) {
    opts = opts || {};
    var viewId = item.view || item.id;
    var w = 1600, h = 1200;
    var c = makeCanvas(w, h);
    var ctx = c.getContext("2d");
    var img;
    try { img = await loadImage(item.data); }
    catch (e) { return { id: item.id, data: item.data, engine: "local", skipped: true }; }
    var applyBg = WS.shouldApplyBackground(viewId, opts.backgroundId, opts.keepBackground);
    if (applyBg) {
      var plate = WS.plateById(opts.backgroundId);
      var bg = null;
      try { if (plate) bg = await loadImage(WS.plateDataUri(plate)); } catch (e2) { bg = null; }
      var car = await cutoutCar(img);
      if (!bg || !car) {
        if (opts.retouchOn !== false && ctx.filter !== undefined) ctx.filter = "contrast(1.08) saturate(1.04) brightness(1.03)";
        drawCover(ctx, img, w, h);
        ctx.filter = "none";
        return { id: item.id, data: c.toDataURL("image/jpeg", 0.9), engine: "local-fallback", cutout: false };
      }
      compositeStudio(ctx, bg, car, viewId, w, h);
      if (opts.blurPlate) blurPlateRegion(ctx, w, h);
      return { id: item.id, data: c.toDataURL("image/jpeg", 0.9), engine: "local", cutout: true };
    }
    if (opts.retouchOn !== false && ctx.filter !== undefined) ctx.filter = "contrast(1.08) saturate(1.04) brightness(1.03)";
    drawCover(ctx, img, w, h);
    ctx.filter = "none";
    return { id: item.id, data: c.toDataURL("image/jpeg", 0.9), engine: "local" };
  }

  async function tryRemote(payload) {
    var urls = [];
    if (root.PHOTO_ENHANCE_URL) urls.push(root.PHOTO_ENHANCE_URL);
    urls.push("/api/photo-enhance");
    for (var i = 0; i < urls.length; i++) {
      try {
        var r = await fetch(urls[i], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!r.ok) continue;
        var j = await r.json();
        if (j && j.photos && j.photos.length) return j;
      } catch (e) {}
    }
    return null;
  }

  WS.processPhotos = async function (opts) {
    opts = opts || {};
    var items = opts.items || opts.photos || [];
    var remote = await tryRemote({
      mode: opts.mode || "both",
      backgroundId: opts.backgroundId || "",
      blurPlate: !!opts.blurPlate,
      keepBackground: !!opts.keepBackground,
      prompt: WS.DAMAGE_STAYS_PROMPT,
      photos: items.map(function (it) {
        return { id: it.id, view: it.view || it.id, kind: it.kind || "walk", data: it.data };
      })
    });
    if (remote && remote.photos && remote.photos.length) {
      return { engine: remote.engine || "remote", photos: remote.photos };
    }
    var out = [];
    for (var i = 0; i < items.length; i++) {
      if (opts.localEngine) out.push(await opts.localEngine(items[i], opts));
      else if (typeof document !== "undefined") out.push(await localItem(items[i], opts));
      else out.push({ id: items[i].id, data: items[i].data, engine: "local-stub" });
    }
    return { engine: "local", photos: out };
  };

  function $(id) {
    return typeof document !== "undefined" ? document.getElementById(id) : null;
  }

  function hooks() {
    return {
      storeGet: root.storeGet,
      storeSet: root.storeSet,
      idbPut: root.idbPut,
      idbGet: root.idbGet
    };
  }

  function views() {
    var APP = root.APP || {};
    if (APP.photoSet === "web32" && typeof root.websiteCaptureIds === "function") {
      var ids = root.websiteCaptureIds();
      if (ids && ids.length) return ids;
    }
    return WS.VIEW_ORDER.slice();
  }

  function viewLabel(id) {
    var useWeb = (root.APP || {}).photoSet === "web32";
    if (useWeb && typeof root.websiteShotLabel === "function") {
      var web = root.websiteShotLabel(id);
      if (web) {
        var ids = typeof root.websiteCaptureIds === "function" ? root.websiteCaptureIds() : [];
        var at = ids.indexOf(id);
        return (at >= 0 ? (at + 1) + " · " : "") + web;
      }
    }
    var list = root.VIEWS || [];
    for (var i = 0; i < list.length; i++) if (list[i][0] === id) return (i + 1) + " · " + list[i][1];
    var idx = WS.VIEW_ORDER.indexOf(id);
    var name = WS.VIEW_LABELS[id] || id;
    return (idx >= 0 ? (idx + 1) + " · " : "") + name;
  }

  function picFor(id) {
    if ((root.APP || {}).photoSet === "web32" && typeof root.websiteGhost === "function") {
      var g = root.websiteGhost(id);
      if (g) return g;
    }
    var list = root.VIEWS || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i][0] === id && typeof root.pic === "function") return root.pic(list[i][2]);
    }
    return "";
  }

  function studioState() {
    var APP = root.APP;
    if (!APP.webStudio) APP.webStudio = emptyStudio();
    return APP.webStudio;
  }

  function collectOriginals() {
    var APP = root.APP;
    var st = studioState();
    var originals = {};
    var demo = true;
    views().forEach(function (id) {
      if (APP.photos && APP.photos[id]) {
        originals[id] = APP.photos[id];
        demo = false;
      } else if (st.originals[id]) {
        originals[id] = st.originals[id];
        if (String(originals[id]).indexOf("ghosts/") < 0) demo = false;
      } else {
        originals[id] = picFor(id);
      }
    });
    st.originals = originals;
    st.demo = demo && !st.fromHistory;
    return originals;
  }

  function unitName() {
    if (typeof root.unitLabel === "function" && root.unitLabel() !== "Unit") return root.unitLabel();
    var APP = root.APP || {};
    var bits = [APP.year, APP.make, APP.model].filter(Boolean);
    return bits.length ? bits.join(" ") : "Website unit";
  }

  function paintEngineBadge() {
    var el = $("wsEngineBadge");
    var st = studioState();
    if (!el) return;
    el.textContent = st.engine === "remote"
      ? "Live enhance"
      : "Demo mode · local enhance";
  }

  function paintSteps() {
    var st = studioState();
    var host = $("wsSteps");
    if (!host) return;
    var order = ["photos", "retouch", "background", "review", "post"];
    var labels = { photos: "Photos", retouch: "Retouch", background: "Background", review: "Review", post: "Post" };
    var cur = order.indexOf(st.flow || "photos");
    if (cur < 0) cur = 0;
    host.innerHTML = order.map(function (id, i) {
      var cls = i === cur ? "on" : (i < cur ? "done" : "");
      return '<li class="' + cls + '" data-ws-flow="' + id + '">' + labels[id] + "</li>";
    }).join("");
  }

  function paintSeries() {
    var st = studioState();
    var host = $("wsSeries");
    if (!host) return;
    host.innerHTML = WS.SERIES.map(function (s) {
      return '<button type="button" class="ws-chip' + (st.series === s.id ? " on" : "") + '" data-ws-series="' + s.id + '">' + s.label + "</button>";
    }).join("");
  }

  function paintPlates() {
    var st = studioState();
    var host = $("wsPlateGrid");
    if (!host) return;
    var list = (WS.CATALOG.studio || []).slice();
    host.innerHTML = list.map(function (p) {
      return '<button type="button" class="ws-plate' + (st.backgroundId === p.id ? " on" : "") + '" data-ws-plate="' + p.id + '">' +
        '<img alt="" src="' + WS.plateDataUri(p) + '"><span>' + p.name + "</span></button>";
    }).join("");
  }

  function paintPhotos() {
    var st = studioState();
    var host = $("wsPhotoList");
    if (!host) return;
    collectOriginals();
    var ids = views();
    if (!ids.length) {
      host.innerHTML = '<p class="quote">No walk-around slots.</p>';
      return;
    }
    var flow = st.flow || "photos";
    var web = (root.APP || {}).photoSet === "web32";
    host.classList.toggle("ws-grid", flow !== "review");
    if (flow === "review") {
      var real = ids.filter(function (id) { return st.originals[id] && !isGhostSrc(st.originals[id]); });
      if (!real.length) {
        host.innerHTML = '<p class="quote">Add photos, then retouch and choose a background.</p>';
        return;
      }
      host.innerHTML = real.map(function (id) {
        var before = st.originals[id] || "";
        var after = st.enhanced[id] || before;
        var ok = !!st.approved[id];
        return '<article class="ws-shot' + (ok ? " ok" : "") + '" data-ws-shot="' + id + '">' +
          "<header><b>" + viewLabel(id) + "</b>" +
          (ok ? '<span class="ws-ok">Approved</span>' : "") + "</header>" +
          '<div class="ws-ba">' +
          '<figure><img src="' + before + '" alt="Before"><figcaption>Before</figcaption></figure>' +
          '<figure><img src="' + after + '" alt="After"><figcaption>After</figcaption></figure>' +
          "</div>" +
          '<button type="button" class="ws-text" data-ws-do="approve" data-id="' + id + '">' + (ok ? "Approved" : "Approve") + "</button>" +
          "</article>";
      }).join("");
      return;
    }
    var html = "";
    var last = "";
    ids.forEach(function (id) {
      if (web && typeof root.websiteShotSection === "function") {
        var sec = root.websiteShotSection(id);
        if (sec && sec !== last) {
          last = sec;
          html += '<div class="web-shot-head">' + sec + "</div>";
        }
      }
      var src = flow === "photos" ? (st.originals[id] || "") : (st.enhanced[id] || st.originals[id] || "");
      html += '<button type="button" class="ws-cell' + (isGhostSrc(src) ? "" : " shot") + '" data-ws-do="shot" data-id="' + id + '">' +
        '<img alt="" src="' + src + '"><b>' + viewLabel(id) + "</b></button>";
    });
    host.innerHTML = html;
  }

  function formatWhen(ts) {
    try {
      return new Date(ts).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
    } catch (e) { return ""; }
  }

  function plateName(id) {
    var p = WS.plateById(id);
    return p ? p.name : "Real background";
  }

  function paintHistory() {
    var host = $("wsHistoryList");
    if (!host) return;
    WS.seedSamples(hooks());
    var list = WS.loadHistoryMeta(hooks());
    if (!list.length) {
      host.innerHTML = '<p class="quote">Nothing posted yet. Enhance a walk-around and save — it will live here.</p>';
      return;
    }
    host.innerHTML = list.map(function (it) {
      return '<button type="button" class="ws-hist" data-ws-open="' + it.id + '">' +
        '<img src="' + (it.thumb || "") + '" alt="">' +
        "<div><b>" + (it.label || "Website unit") + "</b>" +
        "<span>" + (it.status === "posted" ? "Posted" : "Saved") + " · " + formatWhen(it.updatedAt || it.postedAt) + "</span>" +
        "<em>" + plateName(it.backgroundId) + " · " + (it.photoCount || 0) + " photos</em></div></button>";
    }).join("");
  }

  function paintToggles() {
    var st = studioState();
    var ret = $("wsRetouch");
    if (ret) ret.checked = st.retouchOn !== false;
    var keep = $("wsKeepBg");
    var apply = $("wsApplyBg");
    if (keep) keep.checked = !!st.keepBackground;
    if (apply) apply.checked = !st.keepBackground;
    var blur = $("wsBlurPlate");
    if (blur) blur.checked = !!st.blurPlate;
    var post = $("wsPost");
    if (post) post.textContent = st.fromHistory ? "Resend to website" : "Post to website";
  }

  function paintTabs() {
    var st = studioState();
    document.querySelectorAll("[data-ws-tab]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-ws-tab") === st.tab);
    });
    if ($("wsStudioPane")) $("wsStudioPane").classList.toggle("hide", st.tab !== "studio");
    if ($("wsHistoryPane")) $("wsHistoryPane").classList.toggle("hide", st.tab !== "history");
  }

  function hasRealPhoto(st) {
    return Object.keys(st.originals || {}).some(function (k) { return !isGhostSrc(st.originals[k]); });
  }

  function paintPrimary() {
    var b = $("wsPrimary");
    var st = studioState();
    var studio = $("webStudio");
    if (studio) {
      ["photos", "retouch", "background", "review", "post"].forEach(function (f) {
        studio.classList.toggle("flow-" + f, (st.flow || "photos") === f && st.tab !== "history");
      });
    }
    if (!b) return;
    if (st.tab === "history") { b.textContent = "Back to studio"; return; }
    if ((st.flow || "photos") === "photos" && !hasRealPhoto(st)) { b.textContent = "Add photos"; return; }
    var labels = {
      photos: "Continue",
      retouch: "Apply retouch",
      background: "Apply background",
      review: "Approve all",
      post: st.fromHistory ? "Resend to website" : "Post to website"
    };
    b.textContent = labels[st.flow] || "Continue";
  }

  WS.paint = function () {
    if (!$("webStudio")) return;
    collectOriginals();
    paintTabs();
    paintToggles();
    paintEngineBadge();
    paintSteps();
    paintSeries();
    paintPlates();
    paintPhotos();
    paintPrimary();
    paintHistory();
    var lock = $("wsLock");
    if (lock) lock.textContent = WS.DAMAGE_COPY;
    var sub = $("wsHeroSub");
    if (sub) sub.textContent = unitName();
  };

  function applyVehicle(meta) {
    var APP = root.APP;
    APP.purpose = "website";
    ["year", "make", "model", "trim", "color", "km", "vin", "stock"].forEach(function (k) {
      if (meta[k] != null) APP[k] = meta[k];
    });
    if (typeof root.applyMode === "function") root.applyMode();
  }

  async function openPackage(id) {
    var list = WS.loadHistoryMeta(hooks());
    var meta = list.filter(function (x) { return x && x.id === id; })[0];
    var sample = WS.SAMPLES.filter(function (s) { return s.id === id; })[0];
    var media = await WS.loadHistoryMedia(id, hooks());
    if ((!media || !media.originals || !Object.keys(media.originals).length) && sample) {
      media = { originals: sample.photos, enhanced: {}, approved: {} };
      Object.keys(sample.photos).forEach(function (k) { media.approved[k] = true; });
    }
    if (!meta && sample) meta = WS.sampleToHistory(sample);
    if (!meta) return;
    applyVehicle(meta);
    var APP = root.APP;
    APP.photos = Object.assign({}, (media && media.originals) || {});
    APP.webStudioId = meta.id;
    APP.webStudio = emptyStudio();
    var st = APP.webStudio;
    st.originals = Object.assign({}, (media && media.originals) || {});
    st.enhanced = Object.assign({}, (media && media.enhanced) || {});
    st.approved = Object.assign({}, (media && media.approved) || {});
    st.retouchOn = meta.retouchOn !== false;
    st.keepBackground = !!meta.keepBackground;
    st.series = meta.series || "dealership";
    st.backgroundId = meta.backgroundId || "";
    st.blurPlate = !!meta.blurPlate;
    st.fromHistory = true;
    st.packageId = meta.id;
    st.tab = "studio";
    st.demo = false;
    WS.paint();
    if (typeof root.toast === "function") root.toast("Opened " + (meta.label || "package") + ". Change the plate, re-retouch, approve, resend.");
    if (st.retouchOn && !Object.keys(st.enhanced).length) runEnhance();
  }

  function currentMeta(status) {
    var APP = root.APP;
    var st = studioState();
    var id = st.packageId || APP.webStudioId || ("ws" + Date.now().toString(36));
    st.packageId = id;
    APP.webStudioId = id;
    return {
      id: id,
      label: unitName(),
      year: APP.year, make: APP.make, model: APP.model, trim: APP.trim,
      color: APP.color, km: APP.km, vin: APP.vin, stock: APP.stock,
      retouchOn: st.retouchOn !== false,
      keepBackground: !!st.keepBackground,
      series: st.series,
      backgroundId: st.backgroundId,
      blurPlate: !!st.blurPlate,
      status: status || "saved",
      createdAt: Date.now(),
      postedAt: status === "posted" ? Date.now() : "",
      photoCount: Object.keys(st.originals || {}).length,
      thumb: st.enhanced.qfront || st.originals.qfront || st.enhanced.front || st.originals.front || ""
    };
  }

  function persist(status) {
    var st = studioState();
    var meta = currentMeta(status);
    WS.upsertHistory(meta, {
      originals: st.originals,
      enhanced: st.enhanced,
      approved: st.approved
    }, hooks());
    return meta;
  }

  async function runEnhance(ids) {
    var st = studioState();
    if (st.busy) return;
    collectOriginals();
    var want = (ids && ids.length) ? ids : views();
    if (st.keepBackground === false && !st.backgroundId) st.backgroundId = "gm-silver";
    st.busy = true;
    if (typeof root.toast === "function") {
      root.toast(st.keepBackground ? "Retouching — dirt goes, damage stays." : "Placing the car on the studio floor…");
    }
    var items = want.map(function (id) {
      return { id: id, view: id, kind: "walk", data: st.originals[id] };
    }).filter(function (it) { return it.data && !isGhostSrc(it.data); });
    try {
      var res = await WS.processPhotos({
        mode: st.keepBackground ? "retouch" : "both",
        backgroundId: st.backgroundId,
        keepBackground: st.keepBackground,
        blurPlate: st.blurPlate,
        retouchOn: st.retouchOn,
        items: items
      });
      st.engine = res.engine || "local";
      (res.photos || []).forEach(function (p) {
        if (p && p.id && p.data) {
          st.enhanced[p.id] = p.data;
          st.approved[p.id] = false;
        }
      });
      var missed = (res.photos || []).some(function (p) { return p && p.cutout === false; });
      if (typeof root.toast === "function") {
        root.toast(missed ? "Cutout didn’t load — those photos stayed as shot." : (st.engine === "remote" ? "Enhanced." : "Ready to review."));
      }
    } catch (e) {
      if (typeof root.toast === "function") root.toast("Couldn’t enhance — try again.");
    }
    st.busy = false;
    WS.paint();
  }

  function approveAll() {
    var st = studioState();
    views().forEach(function (id) {
      if (!st.enhanced[id]) st.enhanced[id] = st.originals[id];
      st.approved[id] = true;
    });
    WS.paint();
    if (typeof root.toast === "function") root.toast("All photos approved.");
  }

  function applyApprovedToApp() {
    var APP = root.APP;
    var st = studioState();
    views().forEach(function (id) {
      var src = st.enhanced[id] || st.originals[id];
      if (src && !isGhostSrc(src)) APP.photos[id] = src;
    });
  }

  function goPost() {
    var st = studioState();
    var pending = views().filter(function (id) { return !isGhostSrc(st.originals[id]) && !st.approved[id]; });
    if (pending.length) {
      if (typeof root.toast === "function") root.toast("Approve each photo first — then post.");
      return;
    }
    applyApprovedToApp();
    persist("posted");
    if (typeof root.show === "function") root.show("submit");
    if (typeof root.toast === "function") root.toast(st.fromHistory ? "Ready to resend." : "Ready to post.");
  }

  WS.open = function (tab) {
    var APP = root.APP;
    if (!APP.webStudio || !APP.webStudio.packageId) APP.webStudio = emptyStudio();
    if (tab) APP.webStudio.tab = tab;
    WS.seedSamples(hooks());
    collectOriginals();
    if (typeof root.show === "function") root.show("webStudio");
    WS.paint();
    var st = APP.webStudio;
    if (st.tab === "studio" && st.retouchOn && !st.demo && !Object.keys(st.enhanced).length && (st.flow === "retouch" || st.flow === "background")) {
      runEnhance();
    }
  };

  WS.bind = function () {
    if (!$("webStudio") || $("webStudio")._bound) return;
    $("webStudio")._bound = true;
    if ($("webStudioX")) $("webStudioX").onclick = function () {
      if (typeof root.pageClose === "function") { root.pageClose(); return; }
      if (typeof root.show === "function") root.show("photos");
    };
    document.querySelectorAll("[data-ws-tab]").forEach(function (b) {
      b.onclick = function () {
        studioState().tab = b.getAttribute("data-ws-tab");
        WS.paint();
      };
    });
    if ($("wsRetouch")) $("wsRetouch").onchange = function () {
      studioState().retouchOn = !!this.checked;
      paintSteps();
    };
    if ($("wsKeepBg")) $("wsKeepBg").onchange = function () {
      if (this.checked) {
        studioState().keepBackground = true;
        if ($("wsApplyBg")) $("wsApplyBg").checked = false;
      }
      paintSteps();
    };
    if ($("wsApplyBg")) $("wsApplyBg").onchange = function () {
      if (this.checked) {
        studioState().keepBackground = false;
        if ($("wsKeepBg")) $("wsKeepBg").checked = false;
      }
      paintSteps();
    };
    if ($("wsBlurPlate")) $("wsBlurPlate").onchange = function () {
      studioState().blurPlate = !!this.checked;
    };
    if ($("wsSeries")) $("wsSeries").addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("[data-ws-series]");
      if (!b) return;
      studioState().series = b.getAttribute("data-ws-series");
      paintSeries();
      paintPlates();
    });
    if ($("wsPlateGrid")) $("wsPlateGrid").addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("[data-ws-plate]");
      if (!b) return;
      var st = studioState();
      st.backgroundId = b.getAttribute("data-ws-plate");
      st.keepBackground = false;
      if ($("wsKeepBg")) $("wsKeepBg").checked = false;
      if ($("wsApplyBg")) $("wsApplyBg").checked = true;
      paintPlates();
      paintSteps();
    });
    if ($("wsPhotoList")) $("wsPhotoList").addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("[data-ws-do]");
      if (!b) return;
      var id = b.getAttribute("data-id");
      var act = b.getAttribute("data-ws-do");
      if (act === "one") runEnhance([id]);
      if (act === "shot" && typeof root.openCamera === "function") root.openCamera("photos", id);
      if (act === "approve") {
        var st = studioState();
        if (!st.enhanced[id]) st.enhanced[id] = st.originals[id];
        st.approved[id] = true;
        WS.paint();
      }
    });
    if ($("wsHistoryList")) $("wsHistoryList").addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("[data-ws-open]");
      if (!b) return;
      openPackage(b.getAttribute("data-ws-open"));
    });
    if ($("wsRetouchAll")) $("wsRetouchAll").onclick = function () { runEnhance(); };
    if ($("wsBgAll")) $("wsBgAll").onclick = function () {
      var st = studioState();
      st.keepBackground = false;
      if (!st.backgroundId) {
        if (typeof root.toast === "function") root.toast("Tap a plate first.");
        return;
      }
      var exteriors = views().filter(function (id) { return !WS.isInterior(id); });
      runEnhance(exteriors);
    };
    if ($("wsSaveHist")) $("wsSaveHist").onclick = function () {
      persist("saved");
      studioState().tab = "history";
      WS.paint();
      if (typeof root.toast === "function") root.toast("Saved to History.");
    };
    if ($("wsApproveAll")) $("wsApproveAll").onclick = approveAll;
    if ($("wsPost")) $("wsPost").onclick = goPost;
    if ($("wsSteps")) $("wsSteps").addEventListener("click", function (e) {
      var b = e.target && e.target.closest && e.target.closest("[data-ws-flow]");
      if (!b) return;
      studioState().flow = b.getAttribute("data-ws-flow");
      studioState().tab = "studio";
      WS.paint();
    });
    if ($("wsPrimary")) $("wsPrimary").onclick = function () {
      var st = studioState();
      if (st.tab === "history") { st.tab = "studio"; st.flow = "photos"; WS.paint(); return; }
      var flow = st.flow || "photos";
      if (flow === "photos") {
        if (!hasRealPhoto(st)) { if (typeof root.show === "function") root.show("photos"); return; }
        st.flow = "retouch";
        WS.paint();
        return;
      }
      if (flow === "retouch") {
        st.keepBackground = true;
        st.retouchOn = true;
        runEnhance().then(function () { studioState().flow = "background"; WS.paint(); });
        return;
      }
      if (flow === "background") {
        st.keepBackground = false;
        if (!st.backgroundId) st.backgroundId = "gm-silver";
        runEnhance(views().filter(function (id) { return !!WS.carProfile(id); })).then(function () {
          studioState().flow = "review";
          WS.paint();
        });
        return;
      }
      if (flow === "review") { st.flow = "post"; approveAll(); return; }
      if (flow === "post") goPost();
    };
    if ($("webHistJump")) $("webHistJump").onclick = function () { WS.open("history"); };
  };

  WS.emptyStudio = emptyStudio;
  WS.openPackage = openPackage;
  WS.persist = persist;
  root.WebStudio = WS;
  if (typeof module !== "undefined" && module.exports) module.exports = WS;
})(typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : this);
