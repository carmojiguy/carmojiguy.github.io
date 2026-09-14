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
must(/function shareTeamWakeBestEffort\(/, "kind:team wake helper exists");
must(/function hasCompleteAppraisalFinal\(/, "complete FINAL helper exists");
must(/function settleTeamRunIfFinal\(/, "settle helper exists");
must(/kind:"team"/, "activate POSTs Incoming kind:team");
must(/\/api\/notify-appraisal/, "activate / kind:team hits notify-appraisal");
must(/btn\.disabled=false/, "staff button stays enabled for rerun");
must(/Rerun Appraisal Team/, "rerun label exists");
must(/item\.lanePick==="onsite" \|\| item\.lane==="onsite"/, "Needs-docs moved to On-site is not needs");
must(/paintCenterRunTeam\(item\)/, "run button paints even after a Needs-docs hide pass");
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
function shareTeamWakeBestEffort(item) {
  posts.push({ kind: "team", id: item.id, sendId: item.sendId, vin: item.vin, ymmt: item.ymmt, teamActivated: true });
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

const isTeamActivated = eval("(" + sliceFn("isTeamActivated", "hasCompleteAppraisalFinal").replace("function isTeamActivated", "function") + ")");
const hasCompleteAppraisalFinal = eval("(" + sliceFn("hasCompleteAppraisalFinal", "settleTeamRunIfFinal").replace("function hasCompleteAppraisalFinal", "function") + ")");
const settleTeamRunIfFinal = eval("(" + sliceFn("settleTeamRunIfFinal", "landTeamRunFromFile").replace("function settleTeamRunIfFinal", "function") + ")");
const landTeamRunFromFile = eval("(" + sliceFn("landTeamRunFromFile", "clearTeamRunTimers").replace("function landTeamRunFromFile", "function") + ")");
const notifyTeamActivated = eval("(" + sliceFn("notifyTeamActivated", "shareTeamWakeBestEffort").replace("function notifyTeamActivated", "function") + ")");
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
assert.strictEqual(got.teamStatus, "final", "Incoming/local complete FINAL settles Running");
assert.strictEqual(store.items.length, 3, "no extra Center card");
assert.ok(posts.some(function (p) { return p.kind === "incoming" && p.id === beforeId && p.sendId === beforeSend && p.teamActivated === true; }), "Incoming POST is the same row");
assert.ok(posts.some(function (p) { return p.kind === "team" && p.id === beforeId && p.sendId === beforeSend && p.vin === "2T3B1RFVXRC466025"; }), "kind:team wake is the same sendId/id");
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
assert.strictEqual(empty.teamStatus, "running", "empty FINAL stays Running");
assert.ok(!empty.team.shabot.target, "empty file does not invent Shabot TARGET");
assert.ok(!empty.team.rybot || !empty.team.rybot.target, "empty file does not invent Rybot");
landTeamRunFromFile(empty);
assert.ok(!empty.team.shabot.target, "land from file does not invent solds");
paintCenterRunTeam(empty);
assert.strictEqual(painted.btnText, "Running…", "empty FINAL button stays Running");

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

const blazer = {
  id: "cmu0a6138006k",
  sendId: "s1af19al",
  vin: "1GNKBHKDXPP123456",
  ymmt: "2023 Chevrolet Blazer",
  lane: "onsite",
  teamActivated: true,
  teamStatus: "running",
  team: { shabot: { min: "", target: "", max: "", note: "" } },
  appraisalFinal: { min: "15500", target: "17000", max: "18000" },
  customer: { name: "Blazer" }
};
store.items.push(blazer);
assert.ok(hasCompleteAppraisalFinal(blazer), "Blazer Incoming FINAL is complete");
settleTeamRunIfFinal(blazer);
assert.strictEqual(blazer.id, "cmu0a6138006k", "Blazer stays the same card");
assert.strictEqual(blazer.sendId, "s1af19al");
assert.strictEqual(blazer.teamStatus, "final", "Incoming min+target+max stops Running");
assert.strictEqual(blazer.team.shabot.min, "15500");
assert.strictEqual(blazer.team.shabot.target, "17000");
assert.strictEqual(blazer.team.shabot.max, "18000");
paintCenterRunTeam(blazer);
assert.strictEqual(painted.btnText, "Rerun Appraisal Team", "Blazer button is not Running");
assert.ok(!/Running/.test(painted.btnText));

const f150Live = {
  id: "cmu0kchd1rgc1",
  sendId: "sir78n6",
  vin: "1FTFW1E87PKE74233",
  ymmt: "2023 Ford F-150",
  lane: "onsite",
  teamActivated: true,
  teamStatus: "running",
  team: { shabot: { min: "", target: "", max: "", note: "" } },
  customer: { name: "" }
};
store.items.push(f150Live);
assert.ok(!hasCompleteAppraisalFinal(f150Live), "live F-150 has no FINAL");
settleTeamRunIfFinal(f150Live);
landTeamRunFromFile(f150Live);
assert.strictEqual(f150Live.teamStatus, "running", "empty F-150 stays Running");
assert.ok(!f150Live.team.shabot.target, "do not invent F-150 TARGET");
assert.ok(!f150Live.appraisalFinal, "do not invent F-150 appraisalFinal");
paintCenterRunTeam(f150Live);
assert.strictEqual(painted.btnText, "Running…", "empty F-150 button stays Running");

const ravLive = {
  id: "cmu0avif7rslu",
  sendId: "s1pvwj8g",
  vin: "2T3B1RFVXRC466025",
  ymmt: "2024 Toyota RAV4",
  teamActivated: true,
  teamStatus: "running",
  appraisalFinal: { min: "22800", target: "24000", max: "25000" },
  team: { shabot: { min: "", target: "", max: "", note: "" } }
};
settleTeamRunIfFinal(ravLive);
assert.strictEqual(ravLive.sendId, "s1pvwj8g");
assert.strictEqual(ravLive.appraisalFinal.min, "22800");
assert.strictEqual(ravLive.appraisalFinal.target, "24000");
assert.strictEqual(ravLive.appraisalFinal.max, "25000");
assert.strictEqual(ravLive.team.shabot.target, "24000", "RAV4 keeps existing FINAL");
assert.strictEqual(ravLive.teamStatus, "final");

function paintCenter() {}
const unlockCenterItem = eval("(" + sliceFn("unlockCenterItem", "slimSharedHttpUrl").replace("function unlockCenterItem", "function") + ")");
store.items.push({
  id: "c-rerun",
  sendId: "s-rerun",
  vin: "1FTFW1E87PKE74233",
  locked: true,
  superseded: true,
  teamActivated: true,
  teamStatus: "running",
  appraisalFinal: { min: "10000", target: "11000", max: "12000" },
  customer: { name: "Unlock Rerun" }
});
const unlockedRun = unlockCenterItem("c-rerun");
assert.ok(unlockedRun);
assert.strictEqual(unlockedRun.teamActivated, false, "Unlock clears teamActivated");
assert.strictEqual(unlockedRun.appraisalFinal.target, "11000", "Unlock keeps FINAL");
const rerun = activateAppraisalTeam("c-rerun");
assert.ok(rerun, "staff can activate after Unlock");
assert.strictEqual(rerun.id, "c-rerun");
assert.strictEqual(rerun.teamActivated, true);

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

incoming.resetStore();
incoming.route("POST", {
  kind: "team",
  sendId: "sir78n6",
  id: "cmu0kchd1rgc1",
  vin: "1FTFW1E87PKE74233",
  ymmt: "2023 Ford F-150",
  lane: "onsite",
  customer: { name: "" }
});
assert.equal(incoming.listItems().length, 1, "kind:team is the same card");
assert.equal(incoming.listItems()[0].id, "cmu0kchd1rgc1");
assert.equal(incoming.listItems()[0].sendId, "sir78n6");
assert.equal(incoming.listItems()[0].teamActivated, true, "kind:team persists teamActivated");
assert.ok(!incoming.listItems()[0].appraisalFinal || !incoming.listItems()[0].appraisalFinal.target, "F-150 kind:team does not invent FINAL");

incoming.resetStore();
incoming.route("POST", {
  kind: "land",
  item: {
    id: "cmu0avif7rslu",
    sendId: "s1pvwj8g",
    vin: "2T3B1RFVXRC466025",
    ymmt: "2024 Toyota RAV4",
    appraisalFinal: { min: "22800", target: "24000", max: "25000" },
    team: { shabot: { min: "22800", target: "24000", max: "25000", note: "keep" } },
    customer: { name: "Chris Cyr" }
  }
});
incoming.route("POST", {
  kind: "team",
  sendId: "s1pvwj8g",
  id: "cmu0avif7rslu",
  vin: "2T3B1RFVXRC466025",
  ymmt: "2024 Toyota RAV4"
});
assert.equal(incoming.listItems().length, 1, "RAV4 kind:team is the same card");
assert.equal(incoming.listItems()[0].appraisalFinal.min, "22800");
assert.equal(incoming.listItems()[0].appraisalFinal.target, "24000", "RAV4 kind:team keeps existing FINAL");
assert.equal(incoming.listItems()[0].appraisalFinal.max, "25000");
incoming.route("POST", {
  kind: "land",
  item: {
    id: "cmu0avif7rslu",
    sendId: "s1pvwj8g",
    vin: "2T3B1RFVXRC466025",
    teamActivated: true,
    teamStatus: "running",
    customer: { name: "Chris Cyr" }
  }
});
assert.equal(incoming.listItems()[0].appraisalFinal.target, "24000", "empty land does not wipe RAV4 FINAL");

const isNeedsDocsItem = eval("(" + html.match(/function isNeedsDocsItem\(item\)\{[\s\S]*?\n\}/)[0].replace("function isNeedsDocsItem", "function") + ")");
function isCenterArchived(item) { return !!(item && item.archived); }
function marketDocsComplete() { return false; }
function isLandedCenterPacket() { return true; }
function missingMarketDocs() { return ["vauto"]; }
assert.equal(isNeedsDocsItem({ lane: "needsdocs", docsIncomplete: true }), true);
assert.equal(isNeedsDocsItem({ lane: "needsdocs", lanePick: "onsite", docsIncomplete: true }), false, "move to On-site clears needs");
const applyCenterLaneMove = eval("(" + html.match(/function applyCenterLaneMove\(item, lane\)\{[\s\S]*?\n\}/)[0].replace("function applyCenterLaneMove", "function") + ")");
function normalizeCenterLane(lane) {
  const k = String(lane || "").toLowerCase().replace(/\s+/g, "");
  if (k === "onsite" || k === "on-site") return "onsite";
  if (k === "needsdocs") return "needsdocs";
  return "";
}
const moved = applyCenterLaneMove({ id: "c-docs", lane: "needsdocs", docsIncomplete: true }, "onsite");
assert.equal(moved.lane, "onsite");
assert.equal(moved.lanePick, "onsite");
assert.equal(isNeedsDocsItem(moved), false, "after lane move the Run button may paint");

mustNot(/activateAppraisalTeam\([\s\S]{0,40}24000/, "activate does not seed invented 24000");
mustNot(/landTeamRunFromFile[\s\S]{0,80}22800/, "land helper does not hardcode RAV4 numbers");

console.log("d30s run appraisal team tap: ok");
