#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const copy404 = fs.readFileSync(path.join(root, "404.html"), "utf8");
const inspect = fs.readFileSync(path.join(root, "inspect-vehicle.html"), "utf8");
const incoming = require(path.join(root, "api", "incoming.js"));

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

assert.equal(copy404, html, "404.html stays a byte-identical copy of index.html");
assert.equal(inspect, html, "inspect-vehicle.html stays a byte-identical copy of index.html");

must(/id="buildStamp">build d30s</, "home footer stamp is d30s");
must(/<!--[\s\S]*build d30s[\s\S]*Run Appraisal Team tap always fires/, "file header stamp is d30s tap");
must(/id="typeSheet"[\s\S]*build d30s/, "type sheet stamp is d30s");
must(/function activateAppraisalTeam\(/, "activate helper exists");
must(/function landTeamRunFromFile\(/, "panel lands existing file numbers");
must(/function startTeamRunProgress\(/, "panel progress helper exists");
must(/btn\.disabled=false/, "staff button stays enabled for rerun");
must(/Rerun Appraisal Team/, "rerun label exists");
must(/Unlock this appraisal first/, "locked tap toasts instead of swallowing");
must(/notifyAppraisal/, "activate also hits existing CoS notify HTTP");
must(/slim\.teamActivated=item\.teamActivated===true/, "slim always posts the activate boolean");
must(/remote\.teamActivated===true \|\| remote\.teamActivated===false/, "Incoming pull applies false");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
mustNot(/id="exitRefresh"/, "Refresh stays gone");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");

const kick = sliceFn("kickShare", "packetSendId");
assert.ok(!/activateAppraisalTeam/.test(kick), "Send does not activate");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare Thank-you hash unchanged");

const posts = [];
const store = {
  items: [{
    id: "c-team-1",
    sendId: "s-team-1",
    vin: "2T3B1RFVXRC466025",
    ymmt: "2024 TOYOTA RAV4",
    lane: "onsite",
    stage: "Waiting",
    source: "guest",
    customer: { name: "Chris Cyr" },
    team: { shabot: { min: "", target: "", max: "", note: "" } },
    appraisalFinal: { min: "22800", target: "24000", max: "25000", path: "Retail" },
    finalRationale: {
      shabot: { note: "Sided with Wes. BUY to TARGET $24,000 Retail." },
      panel: {
        rybot: { min: "24200", target: "25500", max: "26500", why: "Ryan velocity" },
        webot: { min: "22800", target: "24000", max: "24500", why: "Wes hold" },
        drebot: { min: "25500", target: "27000", max: "28500", why: "Drew rich" },
        tbot: { min: "19500", target: "20500", max: "21500", why: "Sean tight" }
      }
    }
  }, {
    id: "c-empty",
    sendId: "s-empty",
    vin: "1FTFW1E87PKE74233",
    ymmt: "2023 Ford F-150",
    lane: "onsite",
    team: { shabot: { min: "", target: "", max: "", note: "" } },
    customer: { name: "Lot" }
  }, {
    id: "c-unlocked",
    sendId: "s-old",
    vin: "2T3B1RFVXRC466025",
    lane: "onsite",
    locked: false,
    superseded: false,
    staffUnlocked: true,
    teamActivated: false,
    teamStatus: "",
    appraisalFinal: { min: "22800", target: "24000", max: "25000" },
    customer: { name: "Chris Cyr" }
  }]
};
const APP = { role: "employee", centerViewId: "c-team-1" };
const painted = { wrapHide: true, btnDisabled: true, btnText: "", note: "", onclick: null, clicks: 0 };
function $(id) {
  if (id === "centerRunTeamWrap") return { classList: { toggle: function (name, on) { if (name === "hide") painted.wrapHide = !!on; } } };
  if (id === "centerRunTeam") return {
    set disabled(v) { painted.btnDisabled = !!v; },
    get disabled() { return painted.btnDisabled; },
    set textContent(v) { painted.btnText = v; },
    get textContent() { return painted.btnText; },
    set onclick(fn) { painted.onclick = fn; }
  };
  if (id === "centerRunTeamNote") return { set textContent(v) { painted.note = v; } };
  if (id === "centerTeam") return {
    innerHTML: "",
    classList: { toggle: function () {} }
  };
  return null;
}
function getCenter(id) { return store.items.find(function (x) { return x.id === id; }) || null; }
function patchCenter(id, fn) {
  const item = getCenter(id);
  if (!item) return null;
  fn(item);
  item.updatedAt = Date.now();
  return item;
}
function shareIncomingBestEffort(item) {
  posts.push({ kind: "incoming", id: item.id, sendId: item.sendId, teamActivated: item.teamActivated, teamStatus: item.teamStatus });
}
function timedFetch(url, req) {
  posts.push({ url: url, body: JSON.parse(req.body) });
  return Promise.resolve({ ok: true });
}
function notifyAppraisal(payload) { posts.push({ kind: "notify", payload: payload }); }
function paintCenterDetail() { painted.detail = true; }
function paintCenterTeam() { painted.team = true; }
function paintCenterFinalBox() { painted.box = true; }
function toast(msg) { painted.toast = msg; }
function teamSlot(raw) { raw = raw || {}; return { min: raw.min || "", target: raw.target || "", max: raw.max || "", note: raw.note || "" }; }
function emptyTeam() {
  return { shabot: teamSlot(), rybot: teamSlot(), webot: teamSlot(), drebot: teamSlot(), tbot: teamSlot() };
}
function hasAppraisalFinalNumbers(min, target, max) {
  return !!(String(min || "").trim() || String(target || "").trim() || String(max || "").trim());
}
function resolveAppraisalFinal(item) {
  if (!item) return null;
  const af = item.appraisalFinal || {};
  if (hasAppraisalFinalNumbers(af.min, af.target, af.max)) return af;
  const slot = teamSlot((item.team || {}).shabot);
  if (hasAppraisalFinalNumbers(slot.min, slot.target, slot.max)) return slot;
  return null;
}
function syncAppraisalFinalFromTeam(item) {
  const slot = teamSlot((item.team || {}).shabot);
  if (!hasAppraisalFinalNumbers(slot.min, slot.target, slot.max)) return;
  item.appraisalFinal = Object.assign({}, item.appraisalFinal || {}, { min: slot.min, target: slot.target, max: slot.max });
}
function isCenterLocked(item) {
  return !!(item && (item.superseded || item.locked || item.supersedeLock || item.centerLocked));
}
const MAIL_HOST = "https://gnm-guest-mailer-shawn-6802.vercel.app";

const isTeamActivated = eval("(" + sliceFn("isTeamActivated", "landTeamRunFromFile").replace("function isTeamActivated", "function") + ")");
const landTeamRunFromFile = eval("(" + sliceFn("landTeamRunFromFile", "clearTeamRunTimers").replace("function landTeamRunFromFile", "function") + ")");
const notifyTeamActivated = eval("(" + sliceFn("notifyTeamActivated", "activateAppraisalTeam").replace("function notifyTeamActivated", "function") + ")");
const activateAppraisalTeam = eval("(" + sliceFn("activateAppraisalTeam", "paintCenterRunTeam").replace("function activateAppraisalTeam", "function") + ")");
const paintCenterRunTeam = eval("(" + sliceFn("paintCenterRunTeam", "paintCenterTeam").replace("function paintCenterRunTeam", "function") + ")");

const rav = store.items[0];
paintCenterRunTeam(rav);
assert.strictEqual(painted.wrapHide, false, "staff see the button");
assert.strictEqual(painted.btnDisabled, false, "FINAL card is still tappable");
assert.strictEqual(painted.btnText, "Rerun Appraisal Team", "FINAL card offers rerun");
assert.equal(typeof painted.onclick, "function", "click handler is attached on FINAL");

const beforeId = rav.id;
const beforeSend = rav.sendId;
posts.length = 0;
const got = activateAppraisalTeam("c-team-1");
assert.ok(got);
assert.strictEqual(got.id, beforeId, "activate does not create a new card");
assert.strictEqual(got.sendId, beforeSend, "sendId is preserved");
assert.strictEqual(got.teamActivated, true);
assert.ok(got.teamActivatedAt > 0);
assert.strictEqual(got.teamStatus, "running");
assert.strictEqual(store.items.length, 3, "no extra Center card");
assert.ok(posts.some(function (p) { return p.kind === "incoming" && p.id === beforeId && p.sendId === beforeSend && p.teamActivated === true; }), "Incoming POST is the same row");
assert.ok(posts.some(function (p) {
  return p.url === MAIL_HOST + "/api/remind" && p.body && p.body.details === "Appraisal Team activated";
}), "remind note fired");
assert.ok(posts.some(function (p) { return p.kind === "notify" && p.payload && p.payload.lane === "onsite-attention"; }), "CoS notify HTTP fired");

landTeamRunFromFile(got);
assert.strictEqual(got.team.shabot.target, "24000", "panel lands existing FINAL TARGET");
assert.strictEqual(got.team.webot.target, "24000", "existing Webot opinion lands");
assert.strictEqual(got.team.rybot.target, "25500", "existing Rybot opinion lands");
assert.strictEqual(got.teamStatus, "final", "existing FINAL marks the run complete");

paintCenterRunTeam(got);
assert.strictEqual(painted.btnDisabled, false, "running/FINAL is not a no-op");
assert.equal(typeof painted.onclick, "function", "rerun handler stays attached");
painted.onclick();
assert.strictEqual(store.items[0].teamActivated, true, "rerun keeps the same card activated");

const empty = activateAppraisalTeam("c-empty");
assert.ok(empty);
assert.strictEqual(empty.id, "c-empty");
assert.ok(!empty.team.shabot.target, "empty file does not invent Shabot TARGET");
assert.ok(!empty.team.rybot || !empty.team.rybot.target, "empty file does not invent Rybot");
landTeamRunFromFile(empty);
assert.ok(!empty.team.shabot.target, "land from file does not invent solds");

const unlocked = activateAppraisalTeam("c-unlocked");
assert.ok(unlocked, "Unlocked History card can run");
assert.strictEqual(unlocked.id, "c-unlocked");
assert.strictEqual(unlocked.sendId, "s-old");
assert.strictEqual(unlocked.teamActivated, true);
assert.strictEqual(store.items.filter(function (x) { return x.vin === "2T3B1RFVXRC466025"; }).length, 2, "does not overwrite the other VIN card");

store.items.push({
  id: "c-locked",
  sendId: "s-locked",
  locked: true,
  superseded: true,
  customer: { name: "Locked" }
});
painted.toast = "";
assert.strictEqual(activateAppraisalTeam("c-locked"), null, "still-locked card does not activate");
assert.ok(/Unlock/i.test(painted.toast || ""), "locked tap explains Unlock");

APP.role = "guest";
assert.strictEqual(activateAppraisalTeam("c-team-1"), null, "guest activate is a no-op");
paintCenterRunTeam(store.items[0]);
assert.strictEqual(painted.wrapHide, true, "guests never see the button");

function slimSharedDocs(docs) { return docs || {}; }
function laneFromMarketDocs(docs, prefer) { return { lane: prefer || "onsite", docsIncomplete: false, missingDocs: [] }; }
function landingLaneForSend() { return "onsite"; }
const CENTER_TEAM = [["shabot"], ["rybot"], ["webot"], ["drebot"], ["tbot"]];
const slimSrc = sliceFn("slimSharedCenterItem", "shareIncomingBestEffort");
const slimSharedCenterItem = eval("(" + slimSrc.replace("function slimSharedCenterItem", "function") + ")");
const slimOff = slimSharedCenterItem({
  id: "c-unlocked",
  sendId: "s-old",
  vin: "2T3B1RFVXRC466025",
  lane: "onsite",
  teamActivated: false,
  teamStatus: "",
  staffUnlocked: true,
  locked: false,
  customer: { name: "Chris Cyr" }
});
assert.strictEqual(slimOff.teamActivated, false, "slim posts teamActivated false so Unlock sticks");
assert.strictEqual(slimOff.id, "c-unlocked");
assert.strictEqual(slimOff.sendId, "s-old");

incoming.resetStore();
incoming.route("POST", {
  kind: "land",
  item: { id: "c-team-1", sendId: "s-team-1", vin: "2T3B1RFVXRC466025", lane: "onsite", teamActivated: true, teamStatus: "running", customer: { name: "Chris Cyr" } }
});
incoming.route("POST", {
  kind: "land",
  item: { id: "c-team-1", sendId: "s-team-1", vin: "2T3B1RFVXRC466025", lane: "onsite", teamActivated: false, teamStatus: "", staffUnlocked: true, customer: { name: "Chris Cyr" } }
});
assert.equal(incoming.listItems().length, 1, "mailer same sendId/id does not create a new card");
assert.equal(incoming.listItems()[0].teamActivated, false, "mailer persists Unlock/false");
incoming.route("POST", {
  kind: "land",
  item: {
    id: "c-team-1",
    sendId: "s-team-1",
    vin: "2T3B1RFVXRC466025",
    teamActivated: true,
    teamStatus: "running",
    appraisalFinal: { min: "22800", target: "24000", max: "25000" },
    team: { shabot: { min: "22800", target: "24000", max: "25000", note: "seed" } },
    customer: { name: "Chris Cyr" }
  }
});
assert.equal(incoming.listItems()[0].teamActivated, true);
assert.equal(incoming.listItems()[0].appraisalFinal.target, "24000", "mailer keeps existing FINAL");
assert.equal(incoming.listItems()[0].team.shabot.target, "24000");

mustNot(/activateAppraisalTeam\([\s\S]{0,40}24000/, "activate does not seed invented 24000");
mustNot(/landTeamRunFromFile[\s\S]{0,80}22800/, "land helper does not hardcode RAV4 numbers");

console.log("d30s run appraisal team tap: ok");
