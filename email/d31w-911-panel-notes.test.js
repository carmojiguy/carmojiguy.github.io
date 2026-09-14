#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");

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
function slice(start, endMarker) {
  const a = html.indexOf(start);
  const b = html.indexOf(endMarker, a);
  assert.ok(a > 0 && b > a, "slice not found: " + start);
  return html.slice(a, b);
}
function sha(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

must(/id="buildStamp">build d31a</, "footer stamp stays d31w");
must(/<!--[\s\S]*build d31a[\s\S]*911 Acre team reads finalRationale\.markdown/, "header names markdown how-we-got-here");
must(/<!--[\s\S]*panel Rybot\/Webot\/Drebot\/TBot/, "header names capitalized panel keys");
must(/<!--[\s\S]*team\.shabot note/, "header names team.shabot note");
must(/<!--[\s\S]*hides boxes with no numbers/, "header hides empty boxes");
must(/function oldestReadyCenter\(/, "FIFO oldest home stays");
must(/id="centerLanes"[^>]*center-rail|class="center-lanes center-rail"/, "Acre left rail stays");
must(/function pullUsersRemote\(/, "users persist stays");
must(/function settleTeamRunIfFinal\(/, "FINAL still clears Running");
must(/if\(typeof botHasCompleteNumbers==="function" && !botHasCompleteNumbers\(slot\)\) return;/, "paint hides a box with no numbers");
mustNot(/if\(!running \|\| any\) return/, "blank Running boxes stay gone");
must(/panelSlotOf\(item\.finalRationale/, "land reads panel via Rybot / Webot / Drebot / TBot aliases");
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
  return null;
}
function syncAppraisalFinalFromTeam() {}
function hasStoredFinalRationale(item) {
  const r = item && item.finalRationale;
  return !!(r && (r.markdown || r.title || (r.panel && Object.keys(r.panel).length)));
}
function emptyTeam() {
  return { shabot: teamSlot(), rybot: teamSlot(), webot: teamSlot(), drebot: teamSlot(), tbot: teamSlot() };
}

const teamSlot = eval("(" + sliceFn("teamSlot", "moneyShort").replace("function teamSlot", "function") + ")");
const panelSlotOf = eval("(" + sliceFn("panelSlotOf", "botHasCompleteNumbers").replace("function panelSlotOf", "function") + ")");
const botHasCompleteNumbers = eval("(" + sliceFn("botHasCompleteNumbers", "shabotHowWeGotHere").replace("function botHasCompleteNumbers", "function") + ")");
const shabotHowWeGotHere = eval("(" + sliceFn("shabotHowWeGotHere", "hydrateTeamFromIncoming").replace("function shabotHowWeGotHere", "function") + ")");
const hydrateTeamFromIncoming = eval("(" + sliceFn("hydrateTeamFromIncoming", "isOnsiteDeskItem").replace("function hydrateTeamFromIncoming", "function") + ")");
const landTeamRunFromFile = eval("(" + sliceFn("landTeamRunFromFile", "clearTeamRunTimers").replace("function landTeamRunFromFile", "function") + ")");

assert.ok(panelSlotOf({ panel: { Rybot: { target: 54000 } } }, "rybot"), "Rybot key matches rybot");
assert.ok(panelSlotOf({ panel: { Webot: { target: 1 } } }, "webot"), "Webot key matches webot");
assert.ok(panelSlotOf({ panel: { Drebot: { target: 1 } } }, "drebot"), "Drebot key matches drebot");
assert.ok(panelSlotOf({ panel: { TBot: { target: 1 } } }, "tbot"), "TBot key matches tbot");
assert.ok(botHasCompleteNumbers({ min: 51000, target: 54000, max: 56000 }), "numeric panel counts as complete");

const f150 = {
  id: "cmu0kchd1rgc1",
  sendId: "sir78n6",
  vin: "1FTFW1E87PKE74233",
  ymmt: "2023 Ford F-150 Lariat",
  lane: "onsite",
  teamActivated: true,
  teamStatus: "final",
  team: {
    shabot: { min: "45200", target: "47000", max: "49000", note: "Sided Wes direction; overruled Ryan high exit; photo-blind cap" }
  },
  appraisalFinal: { min: "45200", target: "47000", max: "49000", path: "Retail" },
  finalRationale: {
    schema_version: "1.0",
    title: "HOW WE GOT HERE",
    markdown: "# HOW WE GOT HERE — Shabot FINAL\n## 2023 Ford F-150 Lariat · VIN 1FTFW1E87PKE74233",
    panel: {
      Rybot: { min: 51000, target: 54000, max: 56000, why: "Exit too rich without photos" },
      Webot: { min: 44500, target: 46500, max: 48000, why: "Blind-packet exit" },
      Drebot: { min: 46500, target: 49500, max: 52000, why: "Shaved for zero photos" },
      TBot: { min: 43000, target: 45500, max: 48000, why: "Slightly too bear" }
    }
  }
};
hydrateTeamFromIncoming(f150);
landTeamRunFromFile(f150);
assert.strictEqual(f150.sendId, "sir78n6");
assert.ok(/HOW WE GOT HERE/.test(f150.team.shabot.note), "Shabot how-we-got-here is Incoming markdown");
assert.strictEqual(f150.team.shabot.target, "47000", "Shabot FINAL stays the file numbers");
assert.strictEqual(f150.team.rybot.min, "51000", "Rybot min from capitalized panel");
assert.strictEqual(f150.team.rybot.target, "54000");
assert.strictEqual(f150.team.rybot.max, "56000");
assert.strictEqual(f150.team.rybot.note, "Exit too rich without photos");
assert.strictEqual(f150.team.webot.target, "46500", "Webot from capitalized panel");
assert.strictEqual(f150.team.webot.note, "Blind-packet exit");
assert.strictEqual(f150.team.drebot.target, "49500", "Drebot from capitalized panel");
assert.strictEqual(f150.team.tbot.max, "48000", "TBot from capitalized panel");
assert.ok(botHasCompleteNumbers(f150.team.rybot));
assert.ok(botHasCompleteNumbers(f150.team.webot));
assert.ok(botHasCompleteNumbers(f150.team.drebot));
assert.ok(botHasCompleteNumbers(f150.team.tbot));

const onlyShabotNote = {
  id: "c-note",
  team: { shabot: { min: "10000", target: "11000", max: "12000", note: "Sided Wes direction" } },
  appraisalFinal: { min: "10000", target: "11000", max: "12000" }
};
assert.ok(/Sided Wes/.test(shabotHowWeGotHere(onlyShabotNote)), "team.shabot note is how-we-got-here when markdown is missing");

const missingDre = {
  id: "c-hide",
  sendId: "sir78n6",
  team: { shabot: { min: "45200", target: "47000", max: "49000", note: "Sided Wes" } },
  appraisalFinal: { min: "45200", target: "47000", max: "49000" },
  finalRationale: {
    markdown: "# HOW WE GOT HERE — Shabot FINAL",
    panel: {
      Rybot: { min: 51000, target: 54000, max: 56000, why: "rich" }
    }
  }
};
hydrateTeamFromIncoming(missingDre);
landTeamRunFromFile(missingDre);
assert.strictEqual(missingDre.team.rybot.target, "54000");
assert.ok(!botHasCompleteNumbers(missingDre.team.drebot), "Drebot with no numbers stays hidden");
assert.ok(!botHasCompleteNumbers(missingDre.team.webot), "Webot with no numbers stays hidden");
assert.ok(!missingDre.team.drebot || !missingDre.team.drebot.target, "do not invent Drebot");

const empty = { id: "c-empty", team: emptyTeam() };
hydrateTeamFromIncoming(empty);
landTeamRunFromFile(empty);
assert.ok(!botHasCompleteNumbers(empty.team.shabot), "empty file does not invent Shabot");
assert.ok(!botHasCompleteNumbers(empty.team.rybot), "empty file does not invent Rybot");

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

console.log("d31w-911-panel-notes: ok");
