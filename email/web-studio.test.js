#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const WS = require(path.join(root, "web-studio.js"));

function must(re, msg) {
  assert.ok(re.test(html), msg);
}

must(/id="webStudio"/, "website studio screen");
must(/id="wsHistoryList"/, "History tab list");
must(/data-ws-tab="history"/, "History tab");
must(/id="webHistJump"/, "photos screen can open History");
must(/Damage stays\. Dirt goes\./, "damage lock copy");
must(/script src="web-studio\.js/, "studio script is not inlined keys");
must(/Retouch & post/, "website send goes to studio");
must(/if\(isWeb\(\) && APP\.role!=="guest" && window\.WebStudio\)/, "guest Send never enters studio");
must(/function paintWebsitePhotosChrome\(/, "website chrome helper");
must(/id="photosTitle"/, "photos title swaps for website");
must(/id="wsPlateGrid"/, "background plate grid");

assert.equal(WS.CATALOG.studio.length, 4, "four G&M studio plates");
assert.ok(!WS.CATALOG.dealership && !WS.CATALOG.landscape && !WS.CATALOG.landmark, "fake plate series are gone");
const ids = {};
WS.allPlates().forEach(function (p) {
  assert.ok(p.id && p.name && p.src, "plate has id, name, and photo");
  assert.ok(!ids[p.id], "unique plate id " + p.id);
  ids[p.id] = 1;
  assert.ok(WS.plateSvg(p).indexOf(p.name) >= 0, "plate svg labeled " + p.name);
  const file = path.join(root, p.src.split("?")[0]);
  const buf = fs.readFileSync(file);
  assert.ok(buf.length > 100000, p.id + " is a real image");
  let w = 0, h = 0;
  for (let i = 0; i < buf.length - 8; i++) {
    if (buf[i] === 0xff && (buf[i + 1] === 0xc0 || buf[i + 1] === 0xc2)) {
      h = buf.readUInt16BE(i + 5);
      w = buf.readUInt16BE(i + 7);
      break;
    }
  }
  assert.ok(w >= 2400 && h >= 1350, p.id + " is at least 2400px wide (" + w + "x" + h + ")");
});
assert.ok(fs.existsSync(path.join(root, "backgrounds/gm-studio/CREDITS.txt")), "studio attribution is recorded");
assert.ok(WS.DAMAGE_STAYS_PROMPT.indexOf("NEVER heal") >= 0 || WS.DAMAGE_STAYS_PROMPT.indexOf("Do not inpaint") >= 0, "prompt forbids healing damage");
assert.equal(WS.VIEW_ORDER.length, 12, "walk order has 12 slots");
assert.equal(WS.VIEW_LABELS.qfront, "3/4 Front");
assert.equal(WS.isInterior("dash"), true);
assert.equal(WS.isInterior("qfront"), false);
assert.equal(WS.shouldApplyBackground("interior", "gm-silver", false), false, "studio stays off interiors");
assert.equal(WS.shouldApplyBackground("dash", "gm-white", false), false, "dashboard stays off the turntable");
assert.equal(WS.shouldApplyBackground("qfront", "gm-silver", false), true);
assert.equal(WS.shouldApplyBackground("tire", "gm-silver", false), false, "close-ups are not pasted onto the turntable");
assert.equal(WS.shouldApplyBackground("qfront", "gm-silver", true), false, "keep real background");

assert.ok(WS.SAMPLES.length >= 5, "at least 5 website samples");
WS.SAMPLES.forEach(function (s) {
  const check = WS.assertSampleAccuracy(s);
  assert.ok(check.ok, s.id + " " + (check.reason || "accurate"));
  assert.equal(WS.samplePhotoCount(s), WS.VIEW_ORDER.length, s.id + " fills every walk slot");
  WS.VIEW_ORDER.forEach(function (id, i) {
    assert.ok(s.photos[id], s.id + " has " + id);
    assert.ok(decodeURIComponent(s.photos[id]).indexOf("Special:FilePath") >= 0, s.id + " " + id + " is a real photo ref");
  });
  assert.ok(s.label.indexOf(s.token) >= 0, "label names the vehicle");
});

const store = {};
const hooks = {
  storeGet: function (k) { return store[k] || null; },
  storeSet: function (k, v) { store[k] = v; }
};
const seeded = WS.seedSamples(hooks);
assert.ok(seeded.length >= 5, "History seeds ≥5 packages");
assert.ok(seeded.every(function (x) { return x.sample && x.thumb; }), "samples have thumbs");
const again = WS.seedSamples(hooks);
assert.equal(again.filter(function (x) { return x.sample; }).length, WS.SAMPLES.length, "reseed does not duplicate");

WS.upsertHistory({ id: "ws-live", label: "Live unit", status: "saved", vin: "TESTVIN" }, { originals: { qfront: "x" }, enhanced: {}, approved: {} }, hooks);
const hist = WS.loadHistoryMeta(hooks);
assert.ok(hist.some(function (x) { return x.id === "ws-live"; }), "live save lands in History");

WS.processPhotos({
  items: [{ id: "qfront", data: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" }],
  localEngine: function (item) { return Promise.resolve({ id: item.id, data: "enhanced", engine: "local" }); }
}).then(function (res) {
  assert.equal(res.photos[0].data, "enhanced", "processPhotos provider interface");
  const api = fs.readFileSync(path.join(root, "api", "photo-enhance.js"), "utf8");
  assert.ok(/PHOTO_ENHANCE_KEY/.test(api), "api documents PHOTO_ENHANCE_KEY");
  assert.ok(/REPLICATE_API_TOKEN/.test(api), "api documents REPLICATE_API_TOKEN");
  assert.ok(/local-fallback/.test(api), "api falls back without keys");
  assert.ok(!/REPLICATE_API_TOKEN\s*[:=]\s*["'][^"']+["']/.test(html), "no provider token in frontend");
  console.log("web-studio: ok");
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
