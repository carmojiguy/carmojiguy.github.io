#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
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
function slice(start, endMarker) {
  const a = html.indexOf(start);
  const b = html.indexOf(endMarker, a);
  assert.ok(a > 0 && b > a, "slice not found: " + start);
  return html.slice(a, b);
}
function sha(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

must(/id="buildStamp">build d31w</, "footer stamp stays d31w");
must(/<!--[\s\S]*build d31w[\s\S]*911 Incoming FINAL/, "header names the 911 FINAL fold-in");
must(/<!--[\s\S]*s1af19al[\s\S]*sir78n6|<!--[\s\S]*sir78n6[\s\S]*s1af19al/, "header names Blazer and F-150 sendIds");
must(/function oldestReadyCenter\(/, "FIFO oldest home stays");
must(/id="centerLanes"[^>]*center-rail|class="center-lanes center-rail"/, "Acre left rail stays");
must(/function pullUsersRemote\(/, "users persist stays");
must(/function paintCenterDetail\(\)\{[\s\S]{0,280}settleTeamRunIfFinal\(item\)/, "desk paint settles Incoming FINAL before chrome");
must(/settleTeamRunIfFinal\(item, remote\)/, "Incoming pull passes the remote FINAL into settle");
must(/scheduleIncomingPull\(true\)/, "Center open forces an Incoming pull");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
mustNot(/id="exitRefresh"/, "Refresh stays gone");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");

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
function teamSlot(raw) {
  raw = raw || {};
  return { min: raw.min || "", target: raw.target || "", max: raw.max || "", note: raw.note || "" };
}
function emptyTeam() {
  return { shabot: teamSlot(), rybot: teamSlot(), webot: teamSlot(), drebot: teamSlot(), tbot: teamSlot() };
}
function botHasCompleteNumbers(slot) {
  slot = slot || {};
  return !!(String(slot.min || "").trim() && String(slot.target || "").trim() && String(slot.max || "").trim());
}
function hasStoredFinalRationale() { return false; }
function hydrateTeamFromIncoming(item) { return item; }
function syncAppraisalFinalFromTeam() {}

const hasCompleteAppraisalFinal = eval("(" + sliceFn("hasCompleteAppraisalFinal", "settleTeamRunIfFinal").replace("function hasCompleteAppraisalFinal", "function") + ")");
const settleTeamRunIfFinal = eval("(" + sliceFn("settleTeamRunIfFinal", "landTeamRunFromFile").replace("function settleTeamRunIfFinal", "function") + ")");
const landTeamRunFromFile = eval("(" + sliceFn("landTeamRunFromFile", "clearTeamRunTimers").replace("function landTeamRunFromFile", "function") + ")");

const painted = { btnText: "" };
function $(id) {
  if (id === "centerRunTeamWrap") return { classList: { toggle: function () {} } };
  if (id === "centerRunTeam") return {
    set textContent(v) { painted.btnText = v; },
    get textContent() { return painted.btnText; },
    disabled: false,
    onclick: null
  };
  if (id === "centerRunTeamNote") return { textContent: "" };
  return null;
}
const APP = { role: "employee" };
function isTeamActivated(item) {
  return !!(item && (item.teamActivated === true || item.teamStatus === "running" || item.teamStatus === "final"));
}
function isCenterLocked() { return false; }
function toast() {}
const paintCenterRunTeam = eval("(" + sliceFn("paintCenterRunTeam", "paintCenterTeam").replace("function paintCenterRunTeam", "function") + ")");

const blazer = {
  id: "cmu0a6138006k",
  sendId: "s1af19al",
  vin: "3GNKBHRS0LS577461",
  ymmt: "2020 Chevrolet Blazer 2LT",
  lane: "onsite",
  teamActivated: true,
  teamStatus: "running",
  teamRun: { shabot: "running", rybot: "waiting", webot: "waiting", drebot: "waiting", tbot: "waiting" },
  team: { shabot: { min: "", target: "", max: "", note: "" } },
  appraisalFinal: { min: "15500", target: "17000", max: "18000", path: "Retail" },
  customer: { name: "larry laydown" }
};
assert.ok(hasCompleteAppraisalFinal(blazer), "Blazer Incoming FINAL is complete");
settleTeamRunIfFinal(blazer);
assert.strictEqual(blazer.sendId, "s1af19al");
assert.strictEqual(blazer.teamStatus, "final", "Blazer Incoming FINAL clears Running");
assert.strictEqual(blazer.teamRun.shabot, "ready");
assert.strictEqual(blazer.teamRun.rybot, "ready");
assert.strictEqual(blazer.team.shabot.min, "15500");
assert.strictEqual(blazer.team.shabot.target, "17000");
assert.strictEqual(blazer.team.shabot.max, "18000");
paintCenterRunTeam(blazer);
assert.strictEqual(painted.btnText, "Rerun Appraisal Team", "Blazer button is not Running");
assert.ok(!/Running/.test(painted.btnText));

const f150 = {
  id: "cmu0kchd1rgc1",
  sendId: "sir78n6",
  vin: "1FTFW1E87PKE74233",
  ymmt: "2023 Ford F-150 Lariat",
  lane: "onsite",
  teamActivated: true,
  teamStatus: "running",
  teamRun: { shabot: "running", rybot: "waiting", webot: "waiting", drebot: "waiting", tbot: "waiting" },
  team: { shabot: { min: "", target: "", max: "", note: "" } },
  appraisalFinal: { min: "45200", target: "47000", max: "49000", path: "Retail" },
  customer: { name: "" }
};
settleTeamRunIfFinal(f150);
assert.strictEqual(f150.sendId, "sir78n6");
assert.strictEqual(f150.teamStatus, "final", "F-150 Incoming FINAL clears Running");
assert.strictEqual(f150.team.shabot.min, "45200");
assert.strictEqual(f150.team.shabot.target, "47000");
assert.strictEqual(f150.team.shabot.max, "49000");
paintCenterRunTeam(f150);
assert.strictEqual(painted.btnText, "Rerun Appraisal Team", "F-150 button is not Running");

const localNewer = {
  id: "cmu0a6138006k",
  sendId: "s1af19al",
  teamActivated: true,
  teamStatus: "running",
  teamRun: { shabot: "running", rybot: "waiting", webot: "waiting", drebot: "waiting", tbot: "waiting" },
  team: emptyTeam(),
  appraisalFinal: {},
  updatedAt: Date.now()
};
const remoteBlazer = {
  id: "cmu0a6138006k",
  sendId: "s1af19al",
  appraisalFinal: { min: "15500", target: "17000", max: "18000" },
  team: { shabot: { min: "15500", target: "17000", max: "18000", note: "Sided Wes" } },
  teamActivated: true,
  teamStatus: "running"
};
function seedSharedIncomingFinal(item, remote) {
  const af = remote && remote.appraisalFinal;
  if (af && af.min && af.target && af.max) item.appraisalFinal = { min: af.min, target: af.target, max: af.max };
  if (remote && remote.team && remote.team.shabot) item.team = item.team || {};
  if (remote && remote.team && remote.team.shabot) item.team.shabot = teamSlot(remote.team.shabot);
  return item;
}
settleTeamRunIfFinal(localNewer, remoteBlazer);
assert.strictEqual(localNewer.appraisalFinal.target, "17000", "newer local still adopts Incoming FINAL");
assert.strictEqual(localNewer.teamStatus, "final", "newer local Running clears from Incoming FINAL");
assert.strictEqual(localNewer.team.shabot.target, "17000");

const emptyF150 = {
  id: "cmu0kchd1rgc1",
  sendId: "sir78n6",
  teamActivated: true,
  teamStatus: "running",
  team: emptyTeam()
};
settleTeamRunIfFinal(emptyF150, { sendId: "sir78n6", teamActivated: true, teamStatus: "running" });
assert.strictEqual(emptyF150.teamStatus, "running", "empty F-150 stays Running");
assert.ok(!emptyF150.appraisalFinal || !emptyF150.appraisalFinal.target, "do not invent F-150 FINAL");
assert.ok(!emptyF150.team.shabot.target, "do not invent F-150 TARGET");

incoming.resetStore();
incoming.route("POST", {
  kind: "land",
  item: {
    id: "cmu0a6138006k",
    sendId: "s1af19al",
    vin: "3GNKBHRS0LS577461",
    ymmt: "2020 Chevrolet Blazer 2LT",
    appraisalFinal: { min: "15500", target: "17000", max: "18000" },
    team: { shabot: { min: "15500", target: "17000", max: "18000", note: "Sided Wes" } },
    customer: { name: "larry laydown" }
  }
});
incoming.route("POST", {
  kind: "team",
  sendId: "s1af19al",
  id: "cmu0a6138006k",
  vin: "3GNKBHRS0LS577461",
  ymmt: "2020 Chevrolet Blazer 2LT"
});
const storedBlazer = incoming.listItems()[0];
assert.equal(storedBlazer.sendId, "s1af19al");
assert.equal(storedBlazer.appraisalFinal.min, "15500");
assert.equal(storedBlazer.appraisalFinal.target, "17000");
assert.equal(storedBlazer.appraisalFinal.max, "18000");
assert.equal(storedBlazer.teamStatus, "final", "mailer kind:team with Incoming FINAL is not Running");
assert.equal(storedBlazer.team.shabot.target, "17000", "mailer keeps Blazer team numbers");

incoming.resetStore();
incoming.route("POST", {
  kind: "land",
  item: {
    id: "cmu0kchd1rgc1",
    sendId: "sir78n6",
    vin: "1FTFW1E87PKE74233",
    ymmt: "2023 Ford F-150 Lariat",
    appraisalFinal: { min: "45200", target: "47000", max: "49000" },
    team: { shabot: { min: "45200", target: "47000", max: "49000", note: "Sided Wes" } }
  }
});
incoming.route("POST", {
  kind: "land",
  item: {
    id: "cmu0kchd1rgc1",
    sendId: "sir78n6",
    teamActivated: true,
    teamStatus: "running"
  }
});
const storedF150 = incoming.listItems()[0];
assert.equal(storedF150.sendId, "sir78n6");
assert.equal(storedF150.appraisalFinal.target, "47000", "empty land does not wipe F-150 FINAL");
assert.equal(storedF150.teamStatus, "final", "mailer running land settles when FINAL is already on the file");

incoming.resetStore();
incoming.route("POST", {
  kind: "team",
  sendId: "sir78n6",
  id: "cmu0kchd1rgc1",
  vin: "1FTFW1E87PKE74233",
  ymmt: "2023 Ford F-150"
});
assert.equal(incoming.listItems()[0].teamActivated, true);
assert.equal(incoming.listItems()[0].teamStatus, "running", "empty F-150 kind:team stays Running");
assert.ok(!incoming.listItems()[0].appraisalFinal || !incoming.listItems()[0].appraisalFinal.target, "kind:team does not invent F-150 FINAL");

const share = slice("async function sharePacket(){", "\nfunction resetAll()");
const kick = slice("function kickShare(){", "\nfunction packetSendId(");
const send = slice("async function sendFromMe(", "\nfunction openEml(");
assert.equal(sha(share), "89ddee81289962020d2a4277f941f60a93d110d42312da85ad94eaeaf8cdb170", "sharePacket is byte-identical to d25s");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare is byte-identical to d25s");
assert.equal(sha(send), "a87ba1cb730ce79683938a05a22d839878d60319f35418efb408cabdcf9a9b49", "sendFromMe is byte-identical to d25s");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("d31c-911-final-running: ok");
