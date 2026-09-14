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
must(/id="btnSendAsIs">Send</, "photos dock has Send as-is");
must(/if\(isWeb\(\) && APP\.role!=="guest" && window\.WebStudio\)/, "guest Send never enters studio");
must(/function paintWebsitePhotosChrome\(/, "website chrome helper");
must(/async function sendWebsitePacket\(/, "website packet helper");
const wsSrc = fs.readFileSync(path.join(root, "web-studio.js"), "utf8");
assert.ok(/sendWebsitePacket\(\)/.test(wsSrc), "studio Post to website sends the packet");
must(/id="photosTitle"/, "photos title swaps for website");
must(/id="wsPlateGrid"/, "background plate grid");

assert.equal(WS.CATALOG.dealership.length, 30, "30 dealership plates");
assert.equal(WS.CATALOG.landscape.length, 30, "30 landscape plates");
assert.equal(WS.CATALOG.landmark.length, 30, "30 landmark plates");
assert.ok(WS.CATALOG.studio.length >= 3, "soft studio plates for interiors");
const ids = {};
WS.allPlates().forEach(function (p) {
  assert.ok(p.id && p.name, "plate has id and name");
  assert.ok(!ids[p.id], "unique plate id " + p.id);
  ids[p.id] = 1;
  assert.ok(WS.plateSvg(p).indexOf(p.name) >= 0, "plate svg labeled " + p.name);
});
assert.ok(WS.DAMAGE_STAYS_PROMPT.indexOf("NEVER heal") >= 0 || WS.DAMAGE_STAYS_PROMPT.indexOf("Do not inpaint") >= 0, "prompt forbids healing damage");
assert.equal(WS.VIEW_ORDER.length, 12, "walk order has 12 slots");
assert.equal(WS.VIEW_LABELS.qfront, "3/4 Front");
assert.equal(WS.isInterior("dash"), true);
assert.equal(WS.isInterior("qfront"), false);
assert.equal(WS.shouldApplyBackground("interior", "lmk-01", false), false, "landmarks stay off interiors");
assert.equal(WS.shouldApplyBackground("qfront", "lmk-01", false), true);
assert.equal(WS.shouldApplyBackground("qfront", "dlr-01", true), false, "keep real background");

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
