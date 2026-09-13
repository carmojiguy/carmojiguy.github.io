#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function sliceFn(name, next) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start > 0, name + " found");
  const end = html.indexOf("\nfunction " + next + "(", start);
  assert.ok(end > start, name + " ends before " + next);
  return html.slice(start, end);
}

const kick = sliceFn("kickShare", "packetSendId");
const share = (function () {
  const start = html.indexOf("async function sharePacket(){");
  const end = html.indexOf("\nfunction resetAll()", start);
  assert.ok(start > 0 && end > start, "sharePacket found");
  return html.slice(start, end);
})();
const send = sliceFn("sendFromMe", "openEml");
const land = (function () {
  const start = html.indexOf("function landIncomingPacket(");
  const end = html.indexOf("\nasync function sendFromMe(", start);
  assert.ok(start > 0 && end > start, "landIncomingPacket found");
  return html.slice(start, end);
})();

assert.ok(!/api\/incoming/.test(kick), "kickShare does not touch /api/incoming");
assert.ok(!/api\/incoming/.test(share), "sharePacket does not touch /api/incoming");
assert.ok(!/api\/incoming/.test(send), "sendFromMe does not touch /api/incoming");
assert.ok(/sentOk=true;\s*finish\(""\);\s*try\{ finishGuest\(\); \}/.test(share), "Thank-you path stays frozen");
assert.ok(/shareIncomingBestEffort\(item\)/.test(land), "landIncomingPacket posts after local land");
assert.ok(/try\{ shareIncomingBestEffort\(item\); \}catch\(e\)\{\}/.test(land), "Incoming post never throws into Thank-you");
assert.ok(/return persistCenterMedia\(item\.id, photos, docs\)\.then\(function\(\)\{ return item; \}\)/.test(land), "Incoming post does not block persist");

const mergeSrc = sliceFn("mergeIncomingShared", "scheduleIncomingPull").replace(
  "function mergeIncomingShared",
  "function"
);
const applySrc = html.match(/function applySharedIncoming\(item, remote\)\{[\s\S]*?\n\}/)[0].replace(
  "function applySharedIncoming",
  "function"
);
const matchSrc = html.match(/function findCenterMatch\(store, hint\)\{[\s\S]*?\n\}/)[0].replace(
  "function findCenterMatch",
  "function"
);

function isCenterSample(item) {
  if (!item) return false;
  if (item.sample || item.sampleVer) return true;
  const id = String(item.id || "");
  return /^sample[-_]/i.test(id);
}
const APP = { sendId: "", centerId: "open-other", vin: "", inviteName: "" };
const findCenterMatch = eval("(" + matchSrc + ")");
const applySharedIncoming = eval("(" + applySrc + ")");

function emptyTeam() { return {}; }
function emptyVals() { return {}; }
function nextAppNo(store) {
  store.seq = (store.seq || 1000) + 1;
  return "A-" + store.seq;
}
function slimSharedDocs(docs) {
  const src = docs || {};
  const out = {};
  Object.keys(src).forEach(function (k) {
    const d = src[k] || {};
    out[k] = { have: !!d.have, name: d.name || "", type: d.type || "" };
  });
  return out;
}

(function testReplaceInviteStub() {
  const store = {
    seq: 1000,
    items: [{
      id: "invite-1",
      source: "trade-in",
      stage: "Waiting",
      lane: "inbox",
      ymmt: "Trade incoming",
      interest: "2025 Hyundai Tucson Preferred",
      story: "Trade-in link sent to Christine Guest.",
      photoCount: 0,
      thumb: "",
      vin: "",
      customer: { name: "Christine Guest", email: "christine@example.com", phone: "(613) 555-0100" },
      salesperson: "Shawn",
      linkSent: true
    }]
  };
  function centerStore() { return store; }
  function saveCenterStore() {}
  const mergeIncomingShared = eval("(" + mergeSrc + ")");
  const changed = mergeIncomingShared([{
    sendId: "s9guest",
    vin: "5NMS3DAJ7NH452632",
    year: "2022",
    make: "Hyundai",
    model: "Santa Fe",
    ymmt: "2022 Hyundai Santa Fe Preferred",
    source: "guest",
    story: "Full walk and books are on the file.",
    photoCount: 8,
    thumb: "data:image/jpeg;base64,xxx",
    customer: { name: "Christine Guest", email: "christine@example.com", phone: "(613) 555-0100" },
    docs: { carfax: { have: true, name: "Carfax.pdf", type: "pdf", data: "NOPE" } }
  }]);
  assert.equal(changed, true);
  assert.equal(store.items.length, 1, "invite stub is replaced, not duplicated");
  const row = store.items[0];
  assert.equal(row.id, "invite-1");
  assert.equal(row.source, "guest");
  assert.equal(row.lane, "inbox");
  assert.equal(row.stage, "Waiting");
  assert.equal(row.linkSent, false);
  assert.equal(row.vin, "5NMS3DAJ7NH452632");
  assert.equal(row.ymmt, "2022 Hyundai Santa Fe Preferred");
  assert.equal(row.story, "Full walk and books are on the file.");
  assert.equal(row.photoCount, 8);
  assert.equal(row.thumb, "data:image/jpeg;base64,xxx");
  assert.equal(row.docs.carfax.have, true);
  assert.equal(row.docs.carfax.data, undefined, "docs stay meta only");
  assert.equal(row.interest, "2025 Hyundai Tucson Preferred");
})();

(function testUnshiftWhenNoMatch() {
  const store = { seq: 1000, items: [] };
  function centerStore() { return store; }
  function saveCenterStore() {}
  const mergeIncomingShared = eval("(" + mergeSrc + ")");
  mergeIncomingShared([{
    id: "remote-1",
    sendId: "s1",
    vin: "2HKRW2H86JH123456",
    ymmt: "2018 Honda CR-V EX",
    customer: { name: "Chris Nguyen" },
    photoCount: 4,
    story: "Packet in."
  }]);
  assert.equal(store.items.length, 1);
  assert.equal(store.items[0].source, "guest");
  assert.equal(store.items[0].vin, "2HKRW2H86JH123456");
})();

(function testSkipCodedSamplesKeepRealGuests() {
  const store = { seq: 1000, items: [] };
  function centerStore() { return store; }
  function saveCenterStore() {}
  const mergeIncomingShared = eval("(" + mergeSrc + ")");
  mergeIncomingShared([
    { id: "sample-v5-civic", sample: true, vin: "2HGFE2F54RH543210", ymmt: "2024 Honda Civic Sport", customer: { name: "Alex Ruiz" } },
    { id: "sample-v8-wait-camry", sampleVer: "acre8", vin: "4T1B11HK5HU234901", ymmt: "2017 Toyota Camry SE", customer: { name: "Elena Rossi" } },
    {
      id: "guest-christine-blazer-20260913",
      sendId: "s-blazer",
      vin: "3GNKBHRS0LS577461",
      ymmt: "2020 Chevrolet Blazer LT",
      source: "guest",
      customer: { name: "Christine Cyr" },
      photoCount: 6,
      story: "Packet in."
    },
    {
      id: "guest-chris-rav4-20260913",
      sendId: "s-rav4",
      vin: "2T3B1RFVXRC466025",
      ymmt: "2024 Toyota RAV4",
      source: "guest",
      customer: { name: "Chris Cyr" },
      photoCount: 8,
      story: "Packet in."
    }
  ]);
  const ids = store.items.map(function (x) { return x.id; });
  assert.ok(ids.indexOf("sample-v5-civic") < 0, "Honda smoke does not land");
  assert.ok(ids.indexOf("sample-v8-wait-camry") < 0, "waiting sample does not land");
  assert.ok(ids.indexOf("guest-christine-blazer-20260913") >= 0, "Christine Blazer lands");
  assert.ok(ids.indexOf("guest-chris-rav4-20260913") >= 0, "Chris RAV4 lands");
  assert.equal(store.items.length, 2);
})();

assert.ok(/scheduleIncomingPull\(\)/.test(html), "Center boot/paint schedules the Incoming pull");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("center-incoming: ok");
