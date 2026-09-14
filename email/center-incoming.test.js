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
const applySrc = (function () {
  const start = html.indexOf("function applySharedIncoming(");
  const end = html.indexOf("\nlet incomingPullAt=", start);
  assert.ok(start > 0 && end > start, "applySharedIncoming found");
  return html.slice(start, end).replace("function applySharedIncoming", "function");
})();
const matchSrc = html.match(/function findCenterMatch\(store, hint\)\{[\s\S]*?\n\}/)[0].replace(
  "function findCenterMatch",
  "function"
);
const MARKET_DOC_REQ = eval("(" + html.match(/const MARKET_DOC_REQ=(\[[\s\S]*?\]);/)[1] + ")");
assert.strictEqual(MARKET_DOC_REQ.length, 3, "MARKET_DOC_REQ is the 3-pill desk");
const haveM = html.match(/function packetDocHave\(docs, spec\)\{[\s\S]*?\n\}/);
const missM = html.match(/function missingMarketDocs\(docs\)\{[\s\S]*?\n\}/);
const doneM = html.match(/function marketDocsComplete\(docs\)\{[\s\S]*?\n\}/);
const laneDocM = html.match(/function laneFromMarketDocs\(docs(?:, prefer)?\)\{[\s\S]*?\n\}/);
const landedM = html.match(/function isLandedCenterPacket\(item\)\{[\s\S]*?\n\}/);
const needsM = html.match(/function isNeedsDocsItem\(item\)\{[\s\S]*?\n\}/);
const laneOfM = html.match(/function centerLaneOf\(item\)\{[\s\S]*?\n\}/);
assert.ok(haveM && missM && doneM && laneDocM && landedM && needsM && laneOfM, "docs-lane helpers extractable");
const packetDocHave = eval("(" + haveM[0].replace("function packetDocHave", "function") + ")");
const missingMarketDocs = eval("(" + missM[0].replace("function missingMarketDocs", "function") + ")");
const marketDocsComplete = eval("(" + doneM[0].replace("function marketDocsComplete", "function") + ")");
const laneFromMarketDocs = eval("(" + laneDocM[0].replace("function laneFromMarketDocs", "function") + ")");
const isLandedCenterPacket = eval("(" + landedM[0].replace("function isLandedCenterPacket", "function") + ")");
function isCenterArchived(item) {
  return !!(item && (item.archived || item.stage === "Appraised"));
}
const isNeedsDocsItem = eval("(" + needsM[0].replace("function isNeedsDocsItem", "function") + ")");
const centerLaneOf = eval("(" + laneOfM[0].replace("function centerLaneOf", "function") + ")");

function isCenterSample(item) {
  if (!item) return false;
  if (item.sample || item.sampleVer) return true;
  const id = String(item.id || "");
  return /^sample[-_]/i.test(id);
}
function takeFn(name, next) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start > 0, name + " found");
  const end = html.indexOf("\nfunction " + next + "(", start);
  assert.ok(end > start, name + " ends before " + next);
  return html.slice(start, end).replace("function " + name, "function");
}
const sharedItemStamp = eval("(" + takeFn("sharedItemStamp", "sharedDocsHaveCount") + ")");
const sharedDocsHaveCount = eval("(" + takeFn("sharedDocsHaveCount", "sharedRemoteBeats") + ")");
const sharedRemoteBeats = eval("(" + takeFn("sharedRemoteBeats", "reviveSharedCenterItem") + ")");
const reviveSharedCenterItem = eval("(" + takeFn("reviveSharedCenterItem", "collapseSharedRemotes") + ")");
const collapseSharedRemotes = eval("(" + takeFn("collapseSharedRemotes", "collapseCenterVinDupes") + ")");
const collapseCenterVinDupes = eval("(" + takeFn("collapseCenterVinDupes", "findCenterMatch") + ")");
const isSupersededCenter = eval("(" + takeFn("isSupersededCenter", "lockSupersededCard") + ")");
const lockSupersededCard = eval("(" + takeFn("lockSupersededCard", "archiveOnsiteSameVin") + ")");
const archiveOnsiteSameVin = eval("(" + takeFn("archiveOnsiteSameVin", "persistCenterMedia") + ")");
const APP = { sendId: "", centerId: "open-other", vin: "", inviteName: "" };
const persistedMedia = [];
function persistCenterMedia(id, photos, docs) {
  persistedMedia.push({ id: id, photos: photos, docs: docs });
  return { catch: function () { return this; } };
}
const findCenterMatch = eval("(" + matchSrc + ")");
const teamSlot = eval("(" + html.match(/function teamSlot\(raw\)\{[\s\S]*?\n\}/)[0].replace("function teamSlot", "function") + ")");
const moneyShort = eval("(" + html.match(/function moneyShort\(v\)\{[\s\S]*?\n\}/)[0].replace("function moneyShort", "function") + ")");
const moneyPretty = eval("(" + html.match(/function moneyPretty\(v\)\{[\s\S]*?\n\}/)[0].replace("function moneyPretty", "function") + ")");
const emptyAppraisalFinal = eval("(" + html.match(/function emptyAppraisalFinal\(\)\{[\s\S]*?\n\}/)[0].replace("function emptyAppraisalFinal", "function") + ")");
const hasAppraisalFinalNumbers = eval("(" + html.match(/function hasAppraisalFinalNumbers\(min, target, max\)\{[\s\S]*?\n\}/)[0].replace("function hasAppraisalFinalNumbers", "function") + ")");
const resolveAppraisalFinal = eval("(" + html.match(/function resolveAppraisalFinal\(item\)\{[\s\S]*?\n\}/)[0].replace("function resolveAppraisalFinal", "function") + ")");
const hasStoredFinalRationale = eval("(" + html.match(/function hasStoredFinalRationale\(item\)\{[\s\S]*?\n\}/)[0].replace("function hasStoredFinalRationale", "function") + ")");
const seedSharedIncomingFinal = eval("(" + takeFn("seedSharedIncomingFinal", "applySharedIncoming") + ")");
const applySharedIncoming = eval("(" + applySrc + ")");
const landSendM = html.match(/function landingLaneForSend\(app, docs, leaderSend\)\{[\s\S]*?\n\}/);
assert.ok(landSendM, "landingLaneForSend extractable");
const landingLaneForSend = eval("(" + landSendM[0].replace("function landingLaneForSend", "function") + ")");
const slimSharedSrc = html.match(/function slimSharedCenterItem\(item\)\{[\s\S]*?\n\}/)[0].replace(
  "function slimSharedCenterItem",
  "function"
);
const slimSharedCenterItem = eval("(" + slimSharedSrc + ")");

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
    const d = src[k];
    const have = d === true || d === 1 || d === "true" || !!(d && (d.have || d.data || d.extract || d.preview || (d.shots && d.shots.length)));
    out[k] = { have: have, name: (d && d.name) || "", type: (d && d.type) || "" };
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
  assert.equal(row.lane, "needsdocs", "partial remote docs do not trust lane inbox");
  assert.equal(row.docsIncomplete, true);
  assert.ok(row.missingDocs && row.missingDocs.length >= 1, "missingDocs filled from remote");
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
  assert.equal(store.items[0].lane, "needsdocs", "empty remote docs land Needs docs");
  assert.equal(store.items[0].docsIncomplete, true);
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
  store.items.forEach(function (row) {
    assert.equal(row.lane, "needsdocs", row.ymmt + " empty docs → Needs docs");
    assert.equal(row.docsIncomplete, true);
    assert.ok(row.missingDocs && row.missingDocs.length >= 3, row.ymmt + " missingDocs lists the 3-pill set");
    assert.equal(centerLaneOf(row), "needsdocs");
  });
})();

(function testDoNotTrustRemoteInbox() {
  const item = applySharedIncoming({
    id: "guest-christine-blazer-20260913",
    lane: "inbox",
    source: "guest",
    docs: {}
  }, {
    sendId: "gmail-1a09c81f52172f4c",
    vin: "3GNKBHRS0LS577461",
    ymmt: "2020 Chevrolet Blazer LT",
    source: "guest",
    lane: "inbox",
    docs: {},
    customer: { name: "Christine Cyr" },
    photoCount: 12
  });
  assert.equal(item.lane, "needsdocs", "remote lane inbox is ignored when docs are empty");
  assert.equal(item.docsIncomplete, true);
  assert.ok(item.missingDocs.indexOf("V Auto documents") >= 0);
  assert.ok(item.missingDocs.indexOf("OpenLane documents") >= 0);
  assert.ok(item.missingDocs.indexOf("eBlock documents") >= 0);
})();

(function testCompleteDocsMoveOnsite() {
  const full = {};
  MARKET_DOC_REQ.forEach(function (s) { full[s.id] = { have: true }; });
  const item = applySharedIncoming({ id: "done-1", lane: "inbox" }, {
    sendId: "s-full",
    vin: "1HGCM82633A004352",
    docs: full,
    customer: { name: "Done Guest" }
  });
  assert.equal(item.lane, "onsite", "complete market docs leave Incoming for On-site");
  assert.equal(item.docsIncomplete, false);
  assert.deepStrictEqual(item.missingDocs, []);
  assert.equal(centerLaneOf(item), "onsite");
})();

(function testThreePillFlagsAreOnsite() {
  const item = applySharedIncoming({ id: "pills-1", lane: "inbox", archived: false, stage: "Waiting", sentAt: 1757792340000, docs: {} }, {
    id: "cmu0avif7rslu",
    sendId: "s1ex074",
    vin: "2T3B1RFVXRC466025",
    sentAt: 1789339609336,
    updatedAt: 1789339999999,
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    customer: { name: "Chris Cyr" }
  });
  assert.equal(item.archived, false, "live same-sendId apply stays live");
  assert.equal(item.stage, "Waiting");
  assert.equal(item.lane, "onsite", "V Auto + OpenLane + eBlock land On-site");
  assert.equal(item.sentAt, 1789339609336, "newer sentAt wins");
  assert.equal(centerLaneOf(item), "onsite");
})();

(function testOlderEmptyStubCannotHideNewerComplete() {
  const store = {
    seq: 1000,
    items: [{
      id: "guest-chris-rav4-20260913",
      sendId: "old-rav4",
      vin: "2T3B1RFVXRC466025",
      ymmt: "2024 Toyota RAV4",
      source: "guest",
      lane: "onsite",
      stage: "Waiting",
      archived: false,
      sentAt: 1757792340000,
      updatedAt: 1757792340000,
      photos: [{ title: "keep", data: "data:image/jpeg;base64,OLD" }],
      pdfUrl: "https://example.com/old-final.pdf",
      pdfName: "old-final.pdf",
      appraisalFinal: { min: "22800", target: "24000", max: "25000" },
      docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
      customer: { name: "Chris Cyr" }
    }]
  };
  function centerStore() { return store; }
  function saveCenterStore() {}
  const mergeIncomingShared = eval("(" + mergeSrc + ")");
  const changed = mergeIncomingShared([
    {
      id: "cmu0avif7rslu",
      sendId: "s1ex074",
      vin: "2T3B1RFVXRC466025",
      ymmt: "2024 TOYOTA RAV4",
      sentAt: 1789339609336,
      updatedAt: 1789339999999,
      source: "appraise",
      lane: "onsite",
      docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true }, summary: { have: true } },
      customer: { name: "Chris Cyr" },
      photoCount: 13
    },
    {
      id: "guest-chris-rav4-20260913",
      sendId: "old-rav4",
      vin: "2T3B1RFVXRC466025",
      ymmt: "2024 Toyota RAV4",
      sentAt: 1757792340000,
      docs: {},
      customer: { name: "Chris Cyr" }
    }
  ]);
  assert.equal(changed, true);
  assert.equal(store.items.length, 2, "same VIN different sendId stays two cards");
  const old = store.items.find(function (x) { return x.id === "guest-chris-rav4-20260913"; });
  const neu = store.items.find(function (x) { return x.sendId === "s1ex074"; });
  assert.ok(old && neu, "old tile and new Send both exist");
  assert.equal(old.sendId, "old-rav4", "pull does not overwrite the old card sendId");
  assert.equal(old.archived, true, "older On-site moves to History");
  assert.equal(old.supersedeMark, "New appraisal submitted");
  assert.equal(isSupersededCenter(old), true);
  assert.equal(centerLaneOf(old), "history");
  assert.equal(old.photos[0].data, "data:image/jpeg;base64,OLD", "History keeps photos");
  assert.equal(old.pdfUrl, "https://example.com/old-final.pdf", "History keeps PDF");
  assert.equal(old.appraisalFinal.target, "24000", "History keeps FINAL");
  assert.equal(neu.id, "cmu0avif7rslu");
  assert.notEqual(neu.id, old.id, "new Send is a separate card");
  assert.equal(neu.archived, false);
  assert.equal(neu.lane, "onsite", "new Send stays On-site");
  assert.equal(centerLaneOf(neu), "onsite");
  assert.equal(neu.sentAt, 1789339609336);
})();

(function testSlimSharedSendsTwoHomeLane() {
  const empty = slimSharedCenterItem({ source: "guest", docs: {}, stage: "Waiting" });
  assert.equal(empty.lane, "needsdocs", "submitted empty packet is Needs docs, not inbox");
  assert.ok(Array.isArray(empty.photos), "slim always includes photos[]");
  assert.equal(empty.photos.length, 0);
  const full = slimSharedCenterItem({
    source: "appraise",
    purpose: "appraise",
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } }
  });
  assert.equal(full.lane, "onsite", "3-pill slim lands On-site");
  const web = slimSharedCenterItem({ source: "website", purpose: "website", docs: {} });
  assert.equal(web.lane, "inbox", "website still lands Incoming");
})();

(function testApplySharedIncomingKeepsRemotePhotos() {
  persistedMedia.length = 0;
  const remotePhotos = [
    { title: "3/4 front", data: "data:image/jpeg;base64,AAA", name: "qfront.jpg", url: "", cap: "front" },
    { title: "Driver", data: "data:image/jpeg;base64,BBB", name: "driver.jpg", url: "", cap: "" }
  ];
  const item = applySharedIncoming({
    id: "cmu0avif7rslu",
    lane: "inbox",
    archived: false,
    stage: "Waiting",
    sentAt: 1757792340000,
    docs: {}
  }, {
    id: "cmu0avif7rslu",
    sendId: "s1ex074",
    vin: "2T3B1RFVXRC466025",
    sentAt: 1789339609336,
    updatedAt: 1789339999999,
    photoCount: 13,
    thumb: "data:image/jpeg;base64,THUMB",
    photos: remotePhotos,
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    customer: { name: "Chris Cyr" }
  });
  assert.equal(item.photos.length, 2, "remote photos land on the Center item");
  assert.equal(item.photos[0].title, "3/4 front");
  assert.equal(item.photos[0].data, "data:image/jpeg;base64,AAA");
  assert.equal(item.photos[1].name, "driver.jpg");
  assert.equal(item.photoCount, 13, "photoCount prefers remote.photoCount");
  assert.equal(item.thumb, "data:image/jpeg;base64,THUMB");
  assert.equal(item.archived, false, "live same-sendId photo land stays live");
  assert.equal(item.stage, "Waiting");
  assert.equal(item.lane, "onsite");
  assert.ok(persistedMedia.length >= 1, "apply persists Center media");
  assert.equal(persistedMedia[0].id, "cmu0avif7rslu");
  assert.equal(persistedMedia[0].photos.length, 2);
})();

(function testApplySharedIncomingCopiesPacketPdf() {
  persistedMedia.length = 0;
  const item = applySharedIncoming({
    id: "cmu0avif7rslu",
    lane: "inbox",
    archived: false,
    stage: "Waiting",
    sentAt: 1757792340000,
    docs: {},
    photos: [{ title: "keep", data: "data:image/jpeg;base64,OLD", name: "old.jpg", url: "", cap: "" }]
  }, {
    id: "cmu0avif7rslu",
    sendId: "s1ex074",
    vin: "2T3B1RFVXRC466025",
    sentAt: 1789339609336,
    updatedAt: 1789339999999,
    photoCount: 13,
    photos: [{ title: "3/4 front", data: "data:image/jpeg;base64,AAA", name: "qfront.jpg", url: "", cap: "" }],
    pdfUrl: "https://7codzfkcbtucfujs.public.blob.vercel-storage.com/incoming/s1ex074-sales-final.pdf",
    pdfName: "s1ex074-sales-final.pdf",
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    customer: { name: "Chris Cyr" }
  });
  assert.equal(item.pdfUrl, "https://7codzfkcbtucfujs.public.blob.vercel-storage.com/incoming/s1ex074-sales-final.pdf");
  assert.equal(item.pdfName, "s1ex074-sales-final.pdf");
  assert.equal(item.photos.length, 1, "pdf copy does not drop remote.photos");
  assert.equal(item.archived, false, "live same-sendId pdf land stays live");
  assert.ok(persistedMedia.length >= 1, "pdf land still persistCenterMedia");
  const keep = applySharedIncoming({
    id: "keep-pdf",
    pdfUrl: "https://example.com/kept.pdf",
    pdfName: "kept.pdf",
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } }
  }, {
    sendId: "s-keep",
    vin: "2T3B1RFVXRC466025",
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    customer: { name: "Chris Cyr" }
  });
  assert.equal(keep.pdfUrl, "https://example.com/kept.pdf", "empty remote pdfUrl does not wipe a local packet");
  assert.equal(keep.pdfName, "kept.pdf");
})();

(function testPacketPdfHrefIsHttpOnly() {
  const hrefSrc = html.match(/function packetPdfHref\(url\)\{[\s\S]*?\n\}/)[0].replace(
    "function packetPdfHref",
    "function"
  );
  const packetPdfHref = eval("(" + hrefSrc + ")");
  assert.equal(
    packetPdfHref("https://7codzfkcbtucfujs.public.blob.vercel-storage.com/incoming/s1ex074-sales-final.pdf"),
    "https://7codzfkcbtucfujs.public.blob.vercel-storage.com/incoming/s1ex074-sales-final.pdf"
  );
  assert.equal(packetPdfHref("http://example.com/x.pdf"), "http://example.com/x.pdf");
  assert.equal(packetPdfHref("javascript:alert(1)"), "", "rejects non-http packet URLs");
  assert.equal(packetPdfHref(""), "");
})();

(function testSlimSharedIncludesCompactPhotos() {
  const huge = "data:image/jpeg;base64," + new Array(120010).join("x");
  const many = [];
  for (let i = 0; i < 20; i++) {
    many.push({ title: "shot " + i, data: "data:image/jpeg;base64,ok" + i, name: "p" + i + ".jpg", url: "", cap: "" });
  }
  many[0].data = huge;
  const slim = slimSharedCenterItem({
    source: "guest",
    photoCount: 20,
    thumb: "data:image/jpeg;base64,THUMB",
    photos: many,
    docs: {}
  });
  assert.ok(Array.isArray(slim.photos), "slim includes photos");
  assert.equal(slim.photos.length, 16, "slim caps at 16 photos");
  assert.equal(slim.photos[0].data, "", "data over 120000 is skipped");
  assert.equal(slim.photos[1].data, "data:image/jpeg;base64,ok1");
  assert.equal(slim.photos[1].title, "shot 1");
  assert.equal(slim.photos[1].name, "p1.jpg");
  assert.equal(slim.thumb, "data:image/jpeg;base64,THUMB");
  assert.equal(slim.photoCount, 20);
  slim.photos.forEach(function (p) {
    assert.ok(Object.keys(p).join(",") === "title,data,name,url,cap", "compact photo fields only");
    assert.ok(String(p.data || "").length <= 120000, "each data string stays under MAX_THUMB");
  });
})();

(function testMergePersistsRemotePhotos() {
  persistedMedia.length = 0;
  const store = { seq: 1000, items: [] };
  function centerStore() { return store; }
  function saveCenterStore() {}
  const mergeIncomingShared = eval("(" + mergeSrc + ")");
  mergeIncomingShared([{
    id: "cmu0avif7rslu",
    sendId: "s1ex074",
    vin: "2T3B1RFVXRC466025",
    ymmt: "2024 TOYOTA RAV4",
    source: "guest",
    photoCount: 13,
    thumb: "data:image/jpeg;base64,THUMB",
    photos: [
      { title: "3/4 front", data: "data:image/jpeg;base64,AAA", name: "qfront.jpg", url: "", cap: "" },
      { title: "Rear", data: "data:image/jpeg;base64,CCC", name: "rear.jpg", url: "", cap: "" }
    ],
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    customer: { name: "Chris Cyr" }
  }]);
  assert.equal(store.items.length, 1);
  assert.equal(store.items[0].photos.length, 2, "merge copies remote photos");
  assert.ok(persistedMedia.length >= 1, "merge persistCenterMedia after apply");
  assert.equal(persistedMedia[persistedMedia.length - 1].photos.length, 2);
})();

(function testLeftoverLocalInboxPurged() {
  const store = {
    seq: 1000,
    items: [{
      id: "guest-christine-blazer-20260913",
      source: "guest",
      lane: "inbox",
      vin: "3GNKBHRS0LS577461",
      ymmt: "2020 Chevrolet Blazer LT",
      photoCount: 12,
      docs: {},
      customer: { name: "Christine Cyr" }
    }, {
      id: "guest-chris-rav4-20260913",
      source: "guest",
      lane: "onsite",
      vin: "2T3B1RFVXRC466025",
      ymmt: "2024 Toyota RAV4",
      photoCount: 8,
      sendId: "gmail-1a09c912c9542f04",
      docs: {},
      customer: { name: "Chris Cyr" }
    }, {
      id: "invite-wait",
      source: "trade-in",
      lane: "inbox",
      linkSent: true,
      photoCount: 0,
      ymmt: "Trade incoming",
      customer: { name: "Waiting Guest" }
    }]
  };
  function centerStore() { return store; }
  function saveCenterStore() {}
  const purgeSrc = sliceFn("purgeDocsLaneDrift", "centerLaneLabel").replace(
    "function purgeDocsLaneDrift",
    "function"
  );
  const purgeDocsLaneDrift = eval("(" + purgeSrc + ")");
  assert.equal(centerLaneOf(store.items[0]), "needsdocs", "leftover Blazer paints in Needs docs");
  assert.equal(centerLaneOf(store.items[1]), "onsite", "leftover RAV4 with lane=onsite stays On-site");
  assert.equal(centerLaneOf(store.items[2]), "inbox", "waiting trade-in invite stays Incoming");
  assert.equal(purgeDocsLaneDrift(), true);
  assert.equal(store.items[0].lane, "needsdocs");
  assert.equal(store.items[0].docsIncomplete, true);
  assert.equal(store.items[1].lane, "onsite", "purge does not downgrade remote/local onsite");
  assert.equal(store.items[1].docsIncomplete, false);
  assert.equal(store.items[2].lane, "inbox", "invite stub lane is not purged");
})();

(function testRemoteOnsiteOrPillFlagsWin() {
  const emptyOnsite = applySharedIncoming({
    id: "cmu0avif7rslu",
    lane: "inbox",
    source: "guest",
    docs: {}
  }, {
    id: "cmu0avif7rslu",
    sendId: "s1ex074",
    vin: "2T3B1RFVXRC466025",
    ymmt: "2024 TOYOTA RAV4",
    source: "guest",
    lane: "onsite",
    docs: {},
    customer: { name: "Chris Cyr" },
    photoCount: 13
  });
  assert.equal(emptyOnsite.lane, "onsite", "remote.lane=onsite wins even when slim docs are empty");
  assert.equal(emptyOnsite.docsIncomplete, false);
  assert.deepStrictEqual(emptyOnsite.missingDocs, []);
  assert.equal(centerLaneOf(emptyOnsite), "onsite");
  assert.equal(isNeedsDocsItem(emptyOnsite), false, "On-site row does not paint NEEDS DOCS");

  const flagOnly = applySharedIncoming({ id: "pills-flag", lane: "inbox", docs: {} }, {
    sendId: "s1ex074",
    vin: "2T3B1RFVXRC466025",
    lane: "inbox",
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true }, carfax: { have: true } },
    customer: { name: "Chris Cyr" }
  });
  assert.equal(flagOnly.lane, "onsite", "have:true flags without blobs are complete");
  assert.equal(flagOnly.docs.vauto.have, true);
  assert.equal(flagOnly.docs.vauto.data, undefined, "flags stay meta only");
  assert.equal(centerLaneOf(flagOnly), "onsite");

  const boolFlags = applySharedIncoming({ id: "pills-bool", lane: "inbox", docs: {} }, {
    sendId: "s-bool",
    vin: "2T3B1RFVXRC466025",
    lane: "inbox",
    docs: { vauto: true, openlane: true, eblock: true, carfax: true },
    customer: { name: "Chris Cyr" }
  });
  assert.equal(boolFlags.lane, "onsite", "boolean pill flags count as have");
  assert.equal(boolFlags.docs.vauto.have, true);
  assert.equal(centerLaneOf(boolFlags), "onsite");
})();

(function testLiveRav4IncomingPullLandsOnsite() {
  const store = { seq: 1000, items: [] };
  function centerStore() { return store; }
  function saveCenterStore() {}
  const mergeIncomingShared = eval("(" + mergeSrc + ")");
  mergeIncomingShared([{
    id: "cmu0avif7rslu",
    sendId: "s1ex074",
    vin: "2T3B1RFVXRC466025",
    ymmt: "2024 TOYOTA RAV4",
    source: "guest",
    lane: "onsite",
    photoCount: 13,
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true }, carfax: { have: true } },
    customer: { name: "Chris Cyr" }
  }]);
  assert.equal(store.items.length, 1);
  const row = store.items[0];
  assert.equal(row.vin, "2T3B1RFVXRC466025");
  assert.equal(row.lane, "onsite", "live Incoming GET RAV4 paints On-site after pull");
  assert.equal(row.docsIncomplete, false);
  assert.equal(centerLaneOf(row), "onsite");
  assert.equal(isNeedsDocsItem(row), false);
})();

function isOnsiteDeskItem(item) {
  if (!item) return false;
  if (typeof centerLaneOf === "function" && centerLaneOf(item) === "onsite") return true;
  return item.lane === "onsite";
}
function finalEsc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
const paintHost = { classList: { hide: true, toggle: function (name, on) { this.hide = !!on; } }, innerHTML: "", querySelector: function () { return this.btn; } };
function $(id) {
  if (id === "centerFinalBox") return paintHost;
  if (id === "centerFinalOpen") return paintHost.btn;
  return null;
}
const paintCenterFinalBox = eval("(" + (function () {
  const start = html.indexOf("function paintCenterFinalBox(");
  const end = html.indexOf("\nconst RAV4_ONSITE_VIN=", start);
  assert.ok(start > 0 && end > start, "paintCenterFinalBox found before RAV4 seed consts");
  return html.slice(start, end).replace("function paintCenterFinalBox", "function");
})() + ")");

(function testIncomingFinalSeedPaintsBox() {
  paintHost.classList.hide = true;
  paintHost.innerHTML = "";
  paintHost.btn = { onclick: null };
  const full = {};
  MARKET_DOC_REQ.forEach(function (s) { full[s.id] = { have: true }; });
  const item = applySharedIncoming({
    id: "final-seed-1",
    lane: "inbox",
    docs: {},
    team: emptyTeam()
  }, {
    sendId: "s-final",
    vin: "2T3B1RFVXRC466025",
    ymmt: "2024 TOYOTA RAV4",
    source: "guest",
    lane: "onsite",
    docs: full,
    customer: { name: "Chris Cyr" },
    appraisalFinal: { min: "22800", target: "24000", max: "25000", path: "Retail" }
  });
  const fin = resolveAppraisalFinal(item);
  assert.ok(fin, "Incoming appraisalFinal resolves on the Center item");
  assert.equal(fin.min, "22800");
  assert.equal(fin.target, "24000");
  assert.equal(fin.max, "25000");
  assert.equal(item.appraisalFinal.target, "24000");
  assert.equal(item.finalMin, "22800");
  assert.equal(item.finalTarget, "24000");
  assert.equal(item.finalMax, "25000");
  assert.equal(item.team.shabot.target, "24000", "Shabot slot is seeded from Incoming FINAL");
  assert.equal(item.lane, "onsite");
  paintCenterFinalBox(item);
  assert.equal(paintHost.classList.hide, false, "FINAL box is shown after Incoming seed");
  assert.ok(/\$22,800/.test(paintHost.innerHTML), "painted box includes seeded MIN via moneyPretty");
  assert.ok(/\$24,000/.test(paintHost.innerHTML), "painted box includes seeded TARGET via moneyPretty");
  assert.ok(/\$25,000/.test(paintHost.innerHTML), "painted box includes seeded MAX via moneyPretty");
  assert.ok(/Shabot FINAL/.test(paintHost.innerHTML), "painted box keeps the FINAL kicker");
})();

(function testIncomingTeamShabotAndRationaleSeed() {
  const item = applySharedIncoming({ id: "final-team-1", lane: "onsite", docs: {} }, {
    sendId: "s-shabot",
    vin: "2T3B1RFVXRC466025",
    lane: "onsite",
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    customer: { name: "Chris Cyr" },
    team: { shabot: { min: "22800", target: "24000", max: "25000", note: "Retail hold" } },
    finalRationale: { shabot: { min: "22800", target: "24000", max: "25000", note: "Sided with Rybot" } }
  });
  const fin = resolveAppraisalFinal(item);
  assert.equal(fin.target, "24000", "team.shabot numbers resolve after Incoming pull");
  assert.equal(item.finalRationale.shabot.note, "Sided with Rybot", "remote rationale lands");
  assert.equal(item.team.shabot.note, "Retail hold");
})();

(function testEmptyRemoteDoesNotWipeFinal() {
  const rich = {
    schema_version: "1.0",
    shabot: { min: "22800", target: "24000", max: "25000", note: "Local how-we-got-here" },
    marketEvidence: { vauto: [{ price: "24100", source: "V Auto" }], openlane: [], eblock: [], carfax: [] }
  };
  const item = applySharedIncoming({
    id: "keep-final",
    lane: "onsite",
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    appraisalFinal: { min: "22800", target: "24000", max: "25000", path: "Retail" },
    finalMin: "22800",
    finalTarget: "24000",
    finalMax: "25000",
    finalRationale: rich,
    team: { shabot: { min: "22800", target: "24000", max: "25000", note: "keep" } }
  }, {
    sendId: "s-empty-final",
    vin: "2T3B1RFVXRC466025",
    lane: "onsite",
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    customer: { name: "Chris Cyr" }
  });
  const fin = resolveAppraisalFinal(item);
  assert.equal(fin.target, "24000", "empty remote does not wipe FINAL numbers");
  assert.equal(item.finalRationale.shabot.note, "Local how-we-got-here", "empty remote does not wipe richer local rationale");
  assert.equal(item.team.shabot.note, "keep");
})();

(function testMergeIncomingSharedSeedsNewItemFinal() {
  const store = { seq: 1000, items: [] };
  function centerStore() { return store; }
  function saveCenterStore() {}
  const mergeIncomingShared = eval("(" + mergeSrc + ")");
  mergeIncomingShared([{
    id: "remote-final-new",
    sendId: "s-new-final",
    vin: "2T3B1RFVXRC466025",
    ymmt: "2024 TOYOTA RAV4",
    source: "guest",
    lane: "onsite",
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    customer: { name: "Chris Cyr" },
    appraisalFinal: { min: "22800", target: "24000", max: "25000" }
  }]);
  assert.equal(store.items.length, 1);
  const row = store.items[0];
  const fin = resolveAppraisalFinal(row);
  assert.equal(fin.min, "22800");
  assert.equal(fin.target, "24000");
  assert.equal(fin.max, "25000");
  assert.equal(row.finalTarget, "24000");
})();

(function testSlimSharedKeepsFinalOnReland() {
  const slim = slimSharedCenterItem({
    source: "guest",
    lane: "onsite",
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    appraisalFinal: { min: "22800", target: "24000", max: "25000", path: "Retail", at: 1, authors: ["Shabot"] },
    finalRationale: { shabot: { min: "22800", target: "24000", max: "25000", note: "Keep me" } },
    finalMin: "22800",
    finalTarget: "24000",
    finalMax: "25000",
    team: { shabot: { min: "22800", target: "24000", max: "25000", note: "slot" } }
  });
  assert.equal(slim.appraisalFinal.target, "24000", "slim keeps appraisalFinal");
  assert.equal(slim.finalRationale.shabot.note, "Keep me", "slim keeps finalRationale");
  assert.equal(slim.finalMin, "22800");
  assert.equal(slim.finalTarget, "24000");
  assert.equal(slim.finalMax, "25000");
  assert.ok(slim.team && slim.team.shabot, "slim keeps team.shabot when present");
  assert.equal(slim.team.shabot.target, "24000");
  const landed = applySharedIncoming({ id: "re-land", lane: "inbox", docs: {} }, slim);
  assert.equal(resolveAppraisalFinal(landed).target, "24000", "re-land slim does not strip FINAL");
  assert.equal(landed.finalRationale.shabot.note, "Keep me");
})();

(function testTwoRemotesSameVinStayTwoCards() {
  const store = { seq: 1000, items: [] };
  function centerStore() { return store; }
  function saveCenterStore() {}
  const mergeIncomingShared = eval("(" + mergeSrc + ")");
  mergeIncomingShared([
    {
      id: "send-a",
      sendId: "s-a",
      vin: "2T3B1RFVXRC466025",
      ymmt: "2024 TOYOTA RAV4",
      sentAt: 1000,
      lane: "onsite",
      docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
      customer: { name: "Chris Cyr" }
    },
    {
      id: "send-b",
      sendId: "s-b",
      vin: "2T3B1RFVXRC466025",
      ymmt: "2024 TOYOTA RAV4",
      sentAt: 2000,
      lane: "onsite",
      docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
      customer: { name: "Chris Cyr" }
    }
  ]);
  assert.equal(store.items.length, 2, "two remotes same VIN different sendId stay two cards");
  const older = store.items.find(function (x) { return x.sendId === "s-a"; });
  const newer = store.items.find(function (x) { return x.sendId === "s-b"; });
  assert.ok(older && newer);
  assert.notEqual(older.id, newer.id);
  assert.equal(older.archived, true, "older On-site moves to History");
  assert.equal(older.superseded, true, "older card is locked/superseded");
  assert.equal(older.supersedeMark, "New appraisal submitted");
  assert.equal(isSupersededCenter(older), true);
  assert.equal(centerLaneOf(older), "history");
  assert.equal(newer.archived, false, "newer Send stays On-site");
  assert.equal(centerLaneOf(newer), "onsite");
})();

(function testFindCenterMatchSharedNeverUsesVin() {
  const store = {
    items: [{
      id: "onsite-old",
      sendId: "s-old",
      vin: "2T3B1RFVXRC466025",
      lane: "onsite",
      source: "guest",
      customer: { name: "Chris Cyr" }
    }]
  };
  const hit = findCenterMatch(store, { shared: true, sendId: "s-new", vin: "2T3B1RFVXRC466025", customerName: "Chris Cyr" });
  assert.equal(hit, null, "Incoming remotes never match by VIN alone");
  const bySend = findCenterMatch(store, { shared: true, sendId: "s-old", vin: "2T3B1RFVXRC466025" });
  assert.equal(bySend && bySend.id, "onsite-old", "same sendId still matches");
  const byId = findCenterMatch(store, { shared: true, sendId: "s-missing", id: "onsite-old" });
  assert.equal(byId && byId.id, "onsite-old", "same id still matches");
})();

(function testCollapseVinDupesIsDisabled() {
  const store = {
    items: [
      { id: "a", sendId: "s-a", vin: "2T3B1RFVXRC466025", lane: "onsite", sentAt: 1 },
      { id: "b", sendId: "s-b", vin: "2T3B1RFVXRC466025", lane: "onsite", sentAt: 2 }
    ]
  };
  assert.equal(collapseCenterVinDupes(store), false);
  assert.equal(store.items.length, 2, "VIN collapse does not drop cards");
})();

(function testPullDoesNotUnarchiveHistoryWithPhotos() {
  const store = {
    seq: 1000,
    items: [{
      id: "hist-1",
      sendId: "s-hist",
      vin: "2T3B1RFVXRC466025",
      ymmt: "2024 Toyota RAV4",
      source: "guest",
      lane: "onsite",
      stage: "Appraised",
      archived: true,
      photos: [{ title: "keep", data: "data:image/jpeg;base64,OLD" }],
      pdfUrl: "https://example.com/final.pdf",
      docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
      appraisalFinal: { min: "22800", target: "24000", max: "25000" },
      customer: { name: "Chris Cyr" }
    }]
  };
  function centerStore() { return store; }
  function saveCenterStore() {}
  const mergeIncomingShared = eval("(" + mergeSrc + ")");
  mergeIncomingShared([{
    id: "hist-1",
    sendId: "s-hist",
    vin: "2T3B1RFVXRC466025",
    photos: [{ title: "keep", data: "data:image/jpeg;base64,OLD" }],
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    customer: { name: "Chris Cyr" },
    photoCount: 8
  }]);
  assert.equal(store.items.length, 1, "same sendId does not create a second card");
  assert.equal(store.items[0].archived, true, "Incoming pull does not unarchive History");
  assert.equal(store.items[0].stage, "Appraised", "History stage stays until Reactivate");
  assert.equal(centerLaneOf(store.items[0]), "history");
  assert.equal(store.items[0].photos[0].data, "data:image/jpeg;base64,OLD");
  assert.equal(store.items[0].pdfUrl, "https://example.com/final.pdf");
})();

(function testNewSendLeavesHistoryCardAndCreatesOnsite() {
  const store = {
    seq: 1000,
    items: [{
      id: "hist-old",
      sendId: "s-old-final",
      vin: "2T3B1RFVXRC466025",
      ymmt: "2024 Toyota RAV4",
      source: "guest",
      lane: "onsite",
      archived: true,
      photos: [{ title: "keep", data: "data:image/jpeg;base64,OLD" }],
      docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
      customer: { name: "Chris Cyr" }
    }]
  };
  function centerStore() { return store; }
  function saveCenterStore() {}
  const mergeIncomingShared = eval("(" + mergeSrc + ")");
  mergeIncomingShared([{
    id: "new-send",
    sendId: "s-new",
    vin: "2T3B1RFVXRC466025",
    ymmt: "2024 TOYOTA RAV4",
    lane: "onsite",
    sentAt: Date.now(),
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    customer: { name: "Chris Cyr" }
  }]);
  assert.equal(store.items.length, 2);
  const hist = store.items.find(function (x) { return x.id === "hist-old"; });
  const neu = store.items.find(function (x) { return x.sendId === "s-new"; });
  assert.equal(hist.archived, true, "History card is not yanked back On-site");
  assert.equal(hist.supersedeMark, "New appraisal submitted");
  assert.equal(isSupersededCenter(hist), true);
  assert.equal(hist.photos[0].data, "data:image/jpeg;base64,OLD");
  assert.equal(neu.id, "new-send");
  assert.equal(neu.archived, false);
  assert.equal(centerLaneOf(neu), "onsite");
})();

(function testS1a09d264StaysOwnOnsiteCard() {
  const store = {
    seq: 1000,
    items: [{
      id: "cmu0avif7rslu",
      sendId: "s1ex074",
      vin: "2T3B1RFVXRC466025",
      ymmt: "2024 Toyota RAV4",
      km: "72000",
      source: "guest",
      lane: "onsite",
      archived: true,
      photos: [{ title: "keep", data: "data:image/jpeg;base64,OLD" }],
      docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
      appraisalFinal: { min: "22800", target: "24000", max: "25000" },
      customer: { name: "Chris Cyr" }
    }]
  };
  function centerStore() { return store; }
  function saveCenterStore() {}
  const mergeIncomingShared = eval("(" + mergeSrc + ")");
  mergeIncomingShared([{
    id: "send-86100",
    sendId: "s1a09d264",
    vin: "2T3B1RFVXRC466025",
    ymmt: "2024 TOYOTA RAV4",
    km: "86100",
    lane: "onsite",
    sentAt: Date.now(),
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    customer: { name: "Chris Cyr" }
  }]);
  assert.equal(store.items.length, 2, "s1a09d264 does not collapse onto s1ex074");
  const hist = store.items.find(function (x) { return x.sendId === "s1ex074"; });
  const neu = store.items.find(function (x) { return x.sendId === "s1a09d264"; });
  assert.equal(hist.id, "cmu0avif7rslu", "History keeps cmu0avif7rslu");
  assert.equal(hist.archived, true, "History keeps s1ex074");
  assert.equal(hist.supersedeMark, "New appraisal submitted");
  assert.equal(isSupersededCenter(hist), true, "prior card is locked");
  assert.equal(centerLaneOf(hist), "history");
  assert.equal(neu.km, "86100", "On-site shows km 86100 on its own card");
  assert.equal(neu.archived, false);
  assert.equal(centerLaneOf(neu), "onsite");
  assert.notEqual(neu.id, hist.id);
})();

assert.ok(/scheduleIncomingPull\(\)/.test(html), "Center boot/paint schedules the Incoming pull");
assert.ok(/build d31a/.test(html), "build stamp bumped to d30h");
assert.ok(/function archiveOnsiteSameVin\(/.test(html), "new Send archives the prior On-site card");
assert.ok(/enrichRav4OnsiteFinal/.test(html), "Incoming land seeds the RAV4 FINAL");
assert.ok(/openCarfaxRecreate/.test(html), "Carfax recreate is wired");
assert.ok(/24000/.test(html), "RAV4 TARGET 24000 is seeded");
assert.ok(/s1ex074-sales-final/.test(html), "sales-final PDF url is present");
assert.ok(/carfax-sample/.test(html), "carfax-sample path is present");
assert.ok(/openlane:\s*\[\]/.test(html), "OpenLane solds stay openlane:[]");
assert.ok(/New appraisal submitted/.test(html), "superseded watermark copy is exact");
assert.ok(/id="exitBack">Back/.test(html), "Back sits in exit chrome");
assert.ok(/id="exitHome">Home/.test(html), "Home sits in exit chrome");
assert.ok(!/id="exitRefresh"/.test(html), "Refresh is gone from exit chrome");
assert.ok(/Continue abandoned session/.test(html), "abandoned Continue label");
assert.ok(/Start a new one/.test(html), "abandoned Start a new one label");
assert.ok(/shared && hint\.id/.test(html), "Incoming remotes also match by id");
assert.ok(/function seedSharedIncomingFinal\(/.test(html), "Incoming FINAL seed helper exists");
assert.ok(/seedSharedIncomingFinal\(item, remote\)/.test(html), "applySharedIncoming copies Incoming FINAL");
assert.ok(/appraisalFinal:\{/.test(html), "slimSharedCenterItem includes appraisalFinal");
assert.ok(/finalRationale:item\.finalRationale/.test(html), "slimSharedCenterItem includes finalRationale");
assert.ok(/finalMin:item\.finalMin/.test(html), "slimSharedCenterItem includes finalMin");
assert.ok(/finalTarget:item\.finalTarget/.test(html), "slimSharedCenterItem includes finalTarget");
assert.ok(/finalMax:item\.finalMax/.test(html), "slimSharedCenterItem includes finalMax");
assert.ok(/item\.team && item\.team\.shabot/.test(html), "slimSharedCenterItem keeps team.shabot when present");
assert.ok(/item\.pdfUrl=remote\.pdfUrl\|\|item\.pdfUrl/.test(html), "applySharedIncoming copies remote.pdfUrl");
assert.ok(/item\.pdfName=remote\.pdfName\|\|item\.pdfName/.test(html), "applySharedIncoming copies remote.pdfName");
assert.ok(/id="centerPacketPdf"/.test(html), "detail sheet has Open packet PDF control");
assert.ok(/Open packet PDF/.test(html), "Open packet PDF label is on the sheet");
assert.ok(/function paintCenterPacketPdf\(/.test(html), "detail paint wires the packet PDF control");
assert.ok(/packetPdfHref\(item&&item\.pdfUrl\)/.test(html), "Open packet PDF uses item.pdfUrl");
assert.ok(/item\.photos=remote\.photos\.map/.test(html), "applySharedIncoming assigns remote.photos");
assert.ok(/photos:photos/.test(html), "slimSharedCenterItem includes photos");
assert.ok(/pdfUrl:item\.pdfUrl/.test(html), "slimSharedCenterItem includes pdfUrl for the wire");
assert.ok(/function slimSharedHttpUrl\(/.test(html), "shared slim keeps only http(s) doc urls");
assert.ok(/function persistMarketDocUrls\(/.test(html), "Send/Incoming hosts market docs before the mailer POST");
assert.ok(/Promise\.resolve\(persistMarketDocUrls\(item\)\)/.test(html), "doc url persist is best-effort before land");

(function testSlimSharedDocsKeepsHttpUrlsNotBase64() {
  const slimSharedHttpUrl = eval("(" + html.match(/function slimSharedHttpUrl\(v\)\{[\s\S]*?\n\}/)[0].replace("function slimSharedHttpUrl", "function") + ")");
  const appendMarketDocShots = eval("(" + html.slice(html.indexOf("function appendMarketDocShots("), html.indexOf("\nfunction slimSharedDocs(")).replace("function appendMarketDocShots", "function") + ")");
  const slimSharedDocs = eval("(" + html.slice(html.indexOf("function slimSharedDocs("), html.indexOf("\nfunction firstMarketDocPayload(")).replace("function slimSharedDocs", "function") + ")");
  assert.equal(slimSharedHttpUrl("https://blob.vercel-storage.com/vauto.mp4"), "https://blob.vercel-storage.com/vauto.mp4");
  assert.equal(slimSharedHttpUrl("data:image/jpeg;base64,XXXX"), "", "data URLs are not kept");
  const slim = slimSharedDocs({
    vauto: {
      have: true,
      name: "vauto.mp4",
      type: "video/mp4",
      url: "https://example.com/vauto.mp4",
      data: "data:video/mp4;base64,HUGE",
      preview: "https://example.com/vauto.jpg",
      extract: "javascript:alert(1)",
      shots: ["https://example.com/shot.jpg", "data:image/jpeg;base64,NOPE", { url: "https://example.com/shot2.jpg" }]
    },
    openlane: { have: true, name: "ol.pdf", type: "pdf", data: "data:application/pdf;base64,NOPE" }
  });
  assert.equal(slim.vauto.have, true);
  assert.equal(slim.vauto.url, "https://example.com/vauto.mp4");
  assert.equal(slim.vauto.preview, "https://example.com/vauto.jpg");
  assert.equal(slim.vauto.data, undefined, "base64 data stays off the wire");
  assert.equal(slim.vauto.extract, undefined, "non-http extract is dropped");
  const shotUrls = slim.vauto.shots.map(function (s) { return s.url; });
  assert.ok(shotUrls.indexOf("https://example.com/shot.jpg") >= 0);
  assert.ok(shotUrls.indexOf("https://example.com/shot2.jpg") >= 0);
  assert.ok(shotUrls.indexOf("https://example.com/vauto.mp4") >= 0, "primary url is kept in shots[]");
  assert.equal(slim.vauto.shots.length, 3);
  assert.equal(slim.openlane.url, undefined);
  assert.equal(slim.openlane.data, undefined);
})();
assert.ok(/persistCenterMedia\(item\.id, item\.photos, item\.docs\|\|\{\}\)/.test(html), "shared land persists Center media");
assert.ok(/item\.lanePick/.test(html), "Incoming pull honors lanePick");

(function testPullDoesNotOverwriteLanePickOrSlimFatPacket() {
  persistedMedia.length = 0;
  const fat = {
    id: "fat-1",
    sendId: "s-fat",
    vin: "2T3B1RFVXRC466025",
    ymmt: "2024 Toyota RAV4",
    source: "guest",
    lane: "onsite",
    lanePick: "history",
    stage: "Appraised",
    archived: true,
    photos: [{ title: "3/4 front", data: "data:image/jpeg;base64," + new Array(120010).join("F") }],
    pdfUrl: "https://example.com/sales-final.pdf",
    pdfName: "sales-final.pdf",
    docs: { vauto: { have: true, preview: "data:image/jpeg,v" }, openlane: { have: true }, eblock: { have: true } },
    appraisalFinal: { min: "22800", target: "24000", max: "25000" },
    finalRationale: { shabot: { target: "24000" } },
    team: { shabot: { min: "22800", target: "24000", max: "25000", note: "seed" } },
    story: "Clean trade. One key.",
    customer: { name: "Chris Cyr" }
  };
  const slimEcho = slimSharedCenterItem(fat);
  slimEcho.lane = "history";
  slimEcho.archived = true;
  slimEcho.updatedAt = Date.now() + 5000;
  const after = applySharedIncoming(Object.assign({}, fat), slimEcho);
  assert.equal(after.lanePick, "history", "user lanePick is not overwritten");
  assert.equal(after.archived, true, "History card stays archived");
  assert.equal(after.lane, "history", "lanePick history sticks");
  assert.equal(after.photos[0].data, fat.photos[0].data, "slim echo does not strip fat photos");
  assert.equal(after.pdfUrl, "https://example.com/sales-final.pdf", "slim echo keeps pdfUrl");
  assert.equal(after.docs.vauto.preview, "data:image/jpeg,v", "slim echo keeps fat docs");
  assert.equal(after.appraisalFinal.target, "24000", "slim echo keeps FINAL");
  assert.equal(after.story, "Clean trade. One key.", "slim echo keeps story");
  assert.equal(after.team.shabot.target, "24000", "slim echo keeps team");
  assert.ok(!after.superseded && !after.locked && !after.supersedeLock, "lane-move echo does not lock the current card");
})();

(function testPullDoesNotUnarchiveBecausePhotosWhenLanePickedHistory() {
  const item = applySharedIncoming({
    id: "hist-pick",
    sendId: "s-pick",
    archived: true,
    stage: "Appraised",
    lane: "history",
    lanePick: "history",
    photos: [{ title: "keep", data: "data:image/jpeg;base64,OLD" }],
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } }
  }, {
    id: "hist-pick",
    sendId: "s-pick",
    lane: "onsite",
    photos: [{ title: "keep", data: "data:image/jpeg;base64,OLD" }],
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    photoCount: 8,
    customer: { name: "Chris Cyr" }
  });
  assert.equal(item.lanePick, "history");
  assert.equal(item.archived, true, "photos do not unarchive a History pick");
  assert.equal(item.lane, "history");
  assert.equal(centerLaneOf(item), "history");
})();

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("center-incoming: ok");
