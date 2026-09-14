#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");
const incoming = require(path.join(__dirname, "..", "api", "incoming.js"));

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function must(re, msg) {
  assert.ok(re.test(html), msg);
}
function mustNot(re, msg) {
  assert.ok(!re.test(html), msg);
}
function sliceFn(name, next) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start > 0, name + " found");
  const end = next
    ? html.indexOf("\nfunction " + next + "(", start)
    : html.indexOf("\nfunction ", start + 10);
  assert.ok(end > start, name + " end found");
  return html.slice(start, end);
}
function sha(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

must(/id="buildStamp">build d30l</, "footer stamp is d30j");
must(/<!--[\s\S]*build d30l[\s\S]*staff Unlock/, "header stamp is d30j Unlock");
must(/id="centerUnlock">Unlock</, "Unlock control exists");
must(/function isCenterLocked\(/, "lock helper exists");
must(/function unlockCenterItem\(/, "unlock helper exists");
must(/APP\.role!=="employee"\) return null/, "Unlock is staff only");
must(/x\.locked=false/, "Unlock clears locked");
must(/x\.superseded=false/, "Unlock clears superseded");
must(/x\.supersedeLock=false/, "Unlock clears supersedeLock");
must(/x\.centerLocked=false/, "Unlock clears centerLocked");
must(/x\.staffUnlocked=true/, "Unlock stamps staffUnlocked");
must(/shareIncomingBestEffort\(item\)/, "Unlock POSTs the same Center item");
must(/item\.staffUnlocked/, "same-VIN archive skips staff-unlocked cards");
must(/Unlock this appraisal first/, "locked lane/doc moves ask for Unlock");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
mustNot(/id="exitRefresh"/, "Refresh stays gone");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");

const kick = sliceFn("kickShare", "packetSendId");
assert.ok(!/unlockCenterItem/.test(kick), "Send does not Unlock");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare Thank-you hash unchanged");

const isCenterLocked = eval("(" + html.match(/function isCenterLocked\(item\)\{[\s\S]*?\n\}/)[0].replace("function isCenterLocked", "function") + ")");
const lockSupersededCard = eval("(" + html.match(/function lockSupersededCard\(item, remote\)\{[\s\S]*?\n\}/)[0].replace("function lockSupersededCard", "function") + ")");
assert.equal(isCenterLocked({ locked: true }), true);
assert.equal(isCenterLocked({ superseded: true }), true);
assert.equal(isCenterLocked({ supersedeLock: true }), true);
assert.equal(isCenterLocked({ centerLocked: true }), true);
assert.equal(isCenterLocked({ archived: true, lane: "history" }), false, "History alone is not locked");
assert.equal(isCenterLocked({}), false);

const skipped = lockSupersededCard({ id: "old", staffUnlocked: true, locked: false, superseded: false }, { sendId: "newer" });
assert.equal(skipped.staffUnlocked, true);
assert.equal(skipped.locked, false, "staff-unlocked card is not re-locked");

const store = {
  items: [{
    id: "c-old",
    sendId: "s-old",
    vin: "2T3B1RFVXRC466025",
    ymmt: "2024 Toyota RAV4",
    lane: "history",
    lanePick: "history",
    archived: true,
    stage: "Appraised",
    locked: true,
    superseded: true,
    supersedeLock: true,
    centerLocked: true,
    supersededBy: "s-new",
    teamActivated: true,
    teamStatus: "running",
    appraisalFinal: { min: "22800", target: "24000", max: "25000" },
    finalRationale: { shabot: { target: "24000" } },
    photos: [{ title: "front", data: "data:image/jpeg;base64,AAA" }],
    docs: { vauto: { have: true, name: "walk.mp4", type: "video/mp4", url: "https://example.com/walk.mp4" } },
    customer: { name: "Chris Cyr" }
  }, {
    id: "c-new",
    sendId: "s-new",
    vin: "2T3B1RFVXRC466025",
    lane: "onsite",
    customer: { name: "Chris Cyr" }
  }]
};
const posts = [];
const APP = { role: "employee", centerViewId: "c-old" };
function getCenter(id) { return store.items.find(function (x) { return x.id === id; }) || null; }
function patchCenter(id, fn) {
  const item = getCenter(id);
  if (!item) return null;
  fn(item);
  return item;
}
function shareIncomingBestEffort(item) { posts.push({ id: item.id, sendId: item.sendId, locked: item.locked, staffUnlocked: item.staffUnlocked }); }
function paintCenter() {}
function paintCenterDetail() {}
function toast() {}
function slimSharedDocs(docs) { return docs || {}; }
function laneFromMarketDocs(docs, prefer) { return { lane: prefer || "onsite", docsIncomplete: false, missingDocs: [] }; }
function landingLaneForSend() { return "onsite"; }
function teamSlot(raw) { raw = raw || {}; return raw; }
function resolveAppraisalFinal(item) { return item && item.appraisalFinal; }
const unlockCenterItem = eval("(" + sliceFn("unlockCenterItem", "slimSharedHttpUrl").replace("function unlockCenterItem", "function") + ")");
const applyCenterLaneMove = eval("(" + html.match(/function applyCenterLaneMove\(item, lane\)\{[\s\S]*?\n\}/)[0].replace("function applyCenterLaneMove", "function") + ")");
const normalizeCenterLane = eval("(" + html.match(/function normalizeCenterLane\(lane\)\{[\s\S]*?\n\}/)[0].replace("function normalizeCenterLane", "function") + ")");

APP.role = "guest";
assert.equal(unlockCenterItem("c-old"), null, "guest cannot Unlock");
APP.role = "employee";
const got = unlockCenterItem("c-old");
assert.ok(got);
assert.equal(got.locked, false);
assert.equal(got.superseded, false);
assert.equal(got.supersedeLock, false);
assert.equal(got.centerLocked, false);
assert.equal(got.staffUnlocked, true);
assert.equal(got.lane, "history", "Unlock keeps History");
assert.equal(got.lanePick, "history");
assert.equal(got.archived, true);
assert.equal(got.appraisalFinal.target, "24000", "Unlock keeps FINAL");
assert.equal(got.docs.vauto.url, "https://example.com/walk.mp4", "Unlock keeps docs.url");
assert.equal(got.photos[0].title, "front", "Unlock keeps photos");
assert.equal(got.supersededBy, "s-new", "Unlock does not delete the newer card pointer");
assert.equal(got.teamActivated, false, "Unlock lets Run Appraisal Team fire again");
assert.equal(store.items.length, 2, "Unlock does not delete the newer card");
assert.equal(store.items[1].id, "c-new");
assert.ok(posts.some(function (p) { return p.id === "c-old" && p.sendId === "s-old" && p.locked === false && p.staffUnlocked === true; }), "Incoming POST is the same sendId unlocked");

applyCenterLaneMove(got, "onsite");
assert.equal(got.lane, "onsite");
assert.equal(got.archived, false);
applyCenterLaneMove(got, "history");
assert.equal(got.lane, "history");
assert.equal(got.archived, true);

const slimSrc = sliceFn("slimSharedCenterItem", "shareIncomingBestEffort");
const slimSharedCenterItem = eval("(" + slimSrc.replace("function slimSharedCenterItem", "function") + ")");
const slim = slimSharedCenterItem(got);
assert.equal(slim.locked, false);
assert.equal(slim.staffUnlocked, true);
assert.equal(slim.docs.vauto.url, "https://example.com/walk.mp4");
assert.equal(slim.id, "c-old");
assert.equal(slim.sendId, "s-old");

incoming.resetStore();
incoming.route("POST", { kind: "land", item: slimSharedCenterItem(Object.assign({}, store.items[0], { locked: true, superseded: true, staffUnlocked: false })) });
incoming.route("POST", { kind: "land", item: slim });
const mailer = incoming.listItems()[0];
assert.equal(incoming.listItems().length, 1);
assert.equal(mailer.locked, false);
assert.equal(mailer.staffUnlocked, true);
assert.equal(mailer.docs.vauto.url, "https://example.com/walk.mp4");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("d30j-unlock: ok");
