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
const APP = { sendId: "", centerId: "open-other", vin: "", inviteName: "" };
const persistedMedia = [];
function persistCenterMedia(id, photos, docs) {
  persistedMedia.push({ id: id, photos: photos, docs: docs });
  return { catch: function () { return this; } };
}
const findCenterMatch = eval("(" + matchSrc + ")");
const teamSlot = eval("(" + html.match(/function teamSlot\(raw\)\{[\s\S]*?\n\}/)[0].replace("function teamSlot", "function") + ")");
const moneyShort = eval("(" + html.match(/function moneyShort\(v\)\{[\s\S]*?\n\}/)[0].replace("function moneyShort", "function") + ")");
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
  const item = applySharedIncoming({ id: "pills-1", lane: "inbox", archived: true, stage: "Appraised", sentAt: 1757792340000, docs: {} }, {
    id: "cmu0avif7rslu",
    sendId: "s1ex074",
    vin: "2T3B1RFVXRC466025",
    sentAt: 1789339609336,
    updatedAt: 1789339999999,
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    customer: { name: "Chris Cyr" }
  });
  assert.equal(item.archived, false, "newer complete pull un-archives");
  assert.equal(item.stage, "Waiting", "false Appraised from a stale date is cleared");
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
      lane: "inbox",
      stage: "Appraised",
      archived: true,
      sentAt: 1757792340000,
      updatedAt: 1757792340000,
      docs: {},
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
  assert.equal(store.items.length, 1, "one live row per VIN");
  const row = store.items[0];
  assert.equal(row.archived, false, "stale archive is cleared");
  assert.equal(row.lane, "onsite", "complete 3-pill file is On-site");
  assert.equal(row.sentAt, 1789339609336, "older stub does not win sentAt");
  assert.equal(row.docs.vauto.have, true, "empty stub does not wipe pills");
  assert.equal(row.sendId, "s1ex074", "newer sendId stays");
  assert.equal(centerLaneOf(row), "onsite");
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
    archived: true,
    stage: "Appraised",
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
  assert.equal(item.archived, false, "fresh photo land unarchives");
  assert.equal(item.stage, "Waiting", "fresh photo land clears Appraised");
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
    archived: true,
    stage: "Appraised",
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
  assert.equal(item.archived, false, "pdf land still unarchives");
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
const paintCenterFinalBox = eval("(" + takeFn("paintCenterFinalBox", "centerStore") + ")");

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
  assert.ok(/\$23k/.test(paintHost.innerHTML), "painted box includes seeded MIN");
  assert.ok(/\$24k/.test(paintHost.innerHTML), "painted box includes seeded TARGET");
  assert.ok(/\$25k/.test(paintHost.innerHTML), "painted box includes seeded MAX");
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

assert.ok(/scheduleIncomingPull\(\)/.test(html), "Center boot/paint schedules the Incoming pull");
assert.ok(/build d30c/.test(html), "build stamp bumped to d30c");
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
assert.ok(/persistCenterMedia\(item\.id, item\.photos, item\.docs\|\|\{\}\)/.test(html), "shared land persists Center media");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("center-incoming: ok");
