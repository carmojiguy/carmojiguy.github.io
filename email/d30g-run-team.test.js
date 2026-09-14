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

must(/id="buildStamp">build d30m</, "home footer stamp is d30h");
must(/<!--[\s\S]*build d30m[\s\S]*Run Appraisal Team/, "file header stamp is d30h activate");
must(/id="typeSheet"[\s\S]*build d30m/, "type sheet stamp is d30h");
must(/id="centerRunTeam"/, "staff activate button id");
must(/id="centerRunTeamWrap"/, "staff activate wrap");
must(/>Run Appraisal Team</, "button label is Run Appraisal Team");
must(/function activateAppraisalTeam\(/, "activate helper exists");
must(/function paintCenterRunTeam\(/, "button paint exists");
must(/function isTeamActivated\(/, "activated flag helper exists");
must(/function notifyTeamActivated\(/, "existing remind path is reused");
must(/x\.teamActivated=true/, "activate sets teamActivated");
must(/x\.teamActivatedAt=Date\.now\(\)/, "activate stamps teamActivatedAt");
must(/x\.teamStatus="running"/, "activate sets teamStatus running");
must(/shareIncomingBestEffort\(item\)/, "activate POSTs the existing Center item");
must(/MAIL_HOST\+"\/api\/remind"/, "activate note reuses /api/remind");
must(/details:"Appraisal Team activated"/, "remind note is Appraisal Team activated");
must(/toEmail:"shawn@myloan\.ca"/, "activate note goes to Shawn");
must(/APP\.role==="guest"\) return null/, "guests cannot activate");
must(/wrap\.classList\.toggle\("hide", !staff\)/, "guests never see the button");
must(/btn\.textContent=on\?"Running…"|"Run Appraisal Team"/, "button shows Running… when activated");
must(/host\.classList\.toggle\("running", running\)/, "team rail paints running");
must(/pair\[2\]==="FINAL"\?"Running":"Waiting"/, "Shabot running + four opinions waiting");
must(/placeholder="MIN"/, "running panel keeps empty MIN");
must(/placeholder="TARGET"/, "running panel keeps empty TARGET");
must(/placeholder="MAX"/, "running panel keeps empty MAX");
must(/item\.teamActivated===true/, "slim posts the activate flag");
must(/remote\.teamActivated===true/, "Incoming pull copies the activate flag");
must(/kind:"land"/, "Incoming POST stays kind:land");

mustNot(/function kickShare\(\)\{[\s\S]{0,80}activateAppraisalTeam/, "Send does not activate the team");
mustNot(/async function sharePacket\(\)\{[\s\S]{0,120}activateAppraisalTeam/, "sharePacket does not activate the team");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");

const kick = sliceFn("kickShare", "packetSendId");
const shareStart = html.indexOf("async function sharePacket(){");
const shareEnd = html.indexOf("\nfunction resetAll()", shareStart);
const share = html.slice(shareStart, shareEnd);
assert.ok(!/activateAppraisalTeam/.test(kick), "kickShare does not call activate");
assert.ok(!/activateAppraisalTeam/.test(share), "sharePacket does not call activate");
assert.ok(!/teamActivated/.test(kick), "kickShare does not write teamActivated");
assert.ok(!/teamActivated/.test(share), "sharePacket does not write teamActivated");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare Thank-you hash unchanged");

must(/function applyCenterLaneMove\(/, "d30f lane dropdown stays");
must(/function moveCenterLane\(/, "d30f lane move stays");
must(/class="lane-dd-sel"/, "on-tile status select stays");
must(/id="exitBack">Back/, "Back stays in chrome");
must(/id="exitHome">Home/, "Home stays in chrome");
mustNot(/id="exitRefresh"/, "Refresh button is gone");
mustNot(/class="exit-refresh"/, "Refresh class is gone");
mustNot(/function pageRefresh\(/, "pageRefresh helper is gone");
must(/min-height:24px/, "Back/Home are quieter chrome");
must(/font-size:11px; font-weight:500/, "Back/Home type is quieter");

const activateSrc = sliceFn("activateAppraisalTeam", "paintCenterRunTeam");
const notifySrc = sliceFn("notifyTeamActivated", "activateAppraisalTeam");
const isOnSrc = sliceFn("isTeamActivated", "notifyTeamActivated");
const paintRunSrc = sliceFn("paintCenterRunTeam", "paintCenterTeam");
const paintTeamSrc = sliceFn("paintCenterTeam", "paintCenterTags");
const slimSrc = html.match(/function slimSharedCenterItem\(item\)\{[\s\S]*?\n\}/)[0];

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
    team: { shabot: { min: "", target: "", max: "", note: "" } }
  }]
};
const APP = { role: "employee", centerViewId: "c-team-1" };
const painted = { wrapHide: true, btnDisabled: false, btnText: "", note: "", onclick: null, rail: "", running: false };
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
    classList: { toggle: function (name, on) { if (name === "running") painted.running = !!on; } }
  };
  return null;
}
function patchCenter(id, fn) {
  const item = store.items.find(function (x) { return x.id === id; });
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
function paintCenterDetail() { painted.detail = true; }
const MAIL_HOST = "https://gnm-guest-mailer-shawn-6802.vercel.app";

const isTeamActivated = eval("(" + isOnSrc.replace("function isTeamActivated", "function") + ")");
const notifyTeamActivated = eval("(" + notifySrc.replace("function notifyTeamActivated", "function") + ")");
const activateAppraisalTeam = eval("(" + activateSrc.replace("function activateAppraisalTeam", "function") + ")");
const paintCenterRunTeam = eval("(" + paintRunSrc.replace("function paintCenterRunTeam", "function") + ")");

assert.strictEqual(isTeamActivated(store.items[0]), false);
paintCenterRunTeam(store.items[0]);
assert.strictEqual(painted.wrapHide, false, "staff see the activate wrap");
assert.strictEqual(painted.btnText, "Run Appraisal Team");
assert.strictEqual(painted.btnDisabled, false);

const beforeId = store.items[0].id;
const beforeSend = store.items[0].sendId;
const got = activateAppraisalTeam("c-team-1");
assert.ok(got);
assert.strictEqual(got.id, beforeId, "activate does not create a new card");
assert.strictEqual(got.sendId, beforeSend, "sendId is preserved");
assert.strictEqual(got.teamActivated, true);
assert.ok(got.teamActivatedAt > 0);
assert.strictEqual(got.teamStatus, "running");
assert.strictEqual(store.items.length, 1, "no extra Center card");
assert.ok(posts.some(function (p) { return p.kind === "incoming" && p.id === beforeId && p.sendId === beforeSend && p.teamActivated === true; }), "Incoming POST is the same row");
assert.ok(posts.some(function (p) {
  return p.url === MAIL_HOST + "/api/remind" && p.body && p.body.details === "Appraisal Team activated" && p.body.toEmail === "shawn@myloan.ca";
}), "remind note fired to Shawn");

paintCenterRunTeam(got);
assert.strictEqual(painted.btnText, "Running…");
assert.strictEqual(painted.btnDisabled, true);
assert.ok(/waiting/i.test(painted.note), "running note mentions waiting opinions");

APP.role = "guest";
paintCenterRunTeam(got);
assert.strictEqual(painted.wrapHide, true, "guests never see the button");
assert.strictEqual(activateAppraisalTeam("c-team-1"), null, "guest activate is a no-op");

function slimSharedDocs(docs) { return docs || {}; }
function laneFromMarketDocs(docs, prefer) { return { lane: prefer || "onsite", docsIncomplete: false, missingDocs: [] }; }
function landingLaneForSend() { return "onsite"; }
function teamSlot(raw) { raw = raw || {}; return { min: raw.min || "", target: raw.target || "", max: raw.max || "", note: raw.note || "" }; }
function resolveAppraisalFinal() { return null; }
const slimSharedCenterItem = eval("(" + slimSrc.replace("function slimSharedCenterItem", "function") + ")");
const slim = slimSharedCenterItem(got);
assert.strictEqual(slim.id, beforeId);
assert.strictEqual(slim.sendId, beforeSend);
assert.strictEqual(slim.teamActivated, true);
assert.strictEqual(slim.teamStatus, "running");
assert.ok(!slim.team || !slim.team.rybot || slim.team.rybot.target === "" || slim.team.shabot, "slim does not invent opinion numbers");
assert.ok(!got.team.shabot.target, "activate does not invent Shabot TARGET");

incoming.resetStore();
incoming.route("POST", {
  kind: "land",
  item: {
    id: "c-team-1",
    sendId: "s-team-1",
    vin: "2T3B1RFVXRC466025",
    ymmt: "2024 TOYOTA RAV4",
    lane: "onsite",
    customer: { name: "Chris Cyr" }
  }
});
incoming.route("POST", {
  kind: "land",
  item: {
    id: "c-team-1",
    sendId: "s-team-1",
    vin: "2T3B1RFVXRC466025",
    ymmt: "2024 TOYOTA RAV4",
    lane: "onsite",
    teamActivated: true,
    teamActivatedAt: 1700000000000,
    teamStatus: "running",
    customer: { name: "Chris Cyr" }
  }
});
assert.equal(incoming.listItems().length, 1, "mailer same sendId/id does not create a new card");
assert.equal(incoming.listItems()[0].teamActivated, true, "mailer keeps the activate flag");
assert.equal(incoming.listItems()[0].teamStatus, "running");
incoming.route("POST", {
  kind: "land",
  item: {
    id: "c-team-1",
    sendId: "s-team-1",
    vin: "2T3B1RFVXRC466025",
    story: "later land",
    customer: { name: "Chris Cyr" }
  }
});
assert.equal(incoming.listItems().length, 1, "later land still one card");
assert.equal(incoming.listItems()[0].teamActivated, true, "later land without the flag does not wipe activate");

mustNot(/activateAppraisalTeam\([\s\S]{0,40}24000/, "activate does not seed invented 24000");
assert.ok(!/TARGET 24000/.test(paintTeamSrc) && !/min:"22800"/.test(paintTeamSrc), "paintCenterTeam does not invent MIN/TARGET/MAX");

console.log("d30g run appraisal team: ok");
