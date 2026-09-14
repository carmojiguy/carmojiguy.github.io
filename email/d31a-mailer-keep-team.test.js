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

must(/id="buildStamp">build d31a</, "footer stamp stays d31a");
must(/<!--[\s\S]*build d31a[\s\S]*mailer keeps rich team\/rationale on Center refresh/, "header names mailer keep");
must(/<!--[\s\S]*build d31a[\s\S]*911 Acre team reads finalRationale\.markdown/, "header keeps panel how-we-got-here");
must(/<!--[\s\S]*hides boxes with no numbers/, "header hides empty boxes");
must(/<!--[\s\S]*pixel-faithful Acre GR Corolla desk/, "pixel desk stays");
must(/<!--[\s\S]*drop the verbal-only tag forever/, "CA workbench stays");
must(/function oldestReadyCenter\(/, "FIFO oldest home stays");
must(/id="centerLanes"[^>]*center-rail|class="center-lanes center-rail"/, "Acre left rail stays");
must(/function pullUsersRemote\(/, "users persist stays");
must(/function settleTeamRunIfFinal\(/, "FINAL still clears Running");
must(/if\(typeof botHasCompleteNumbers==="function" && !botHasCompleteNumbers\(slot\)\) return;/, "paint hides a box with no numbers");
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
  return !!(r && (r.markdown || r.title || (r.panel && Object.keys(r.panel).some(function (k) {
    const s = r.panel[k];
    return s && (s.min || s.target || s.max || s.why || s.note);
  }))));
}
function emptyTeam() {
  return { shabot: teamSlot(), rybot: teamSlot(), webot: teamSlot(), drebot: teamSlot(), tbot: teamSlot() };
}

const teamSlot = eval("(" + sliceFn("teamSlot", "moneyShort").replace("function teamSlot", "function") + ")");
const panelSlotOf = eval("(" + sliceFn("panelSlotOf", "botHasCompleteNumbers").replace("function panelSlotOf", "function") + ")");
const botHasCompleteNumbers = eval("(" + sliceFn("botHasCompleteNumbers", "shabotHowWeGotHere").replace("function botHasCompleteNumbers", "function") + ")");
const shabotHowWeGotHere = eval("(" + sliceFn("shabotHowWeGotHere", "hydrateTeamFromIncoming").replace("function shabotHowWeGotHere", "function") + ")");
const hydrateTeamFromIncoming = eval("(" + sliceFn("hydrateTeamFromIncoming", "isOnsiteDeskItem").replace("function hydrateTeamFromIncoming", "function") + ")");

const f150Rich = {
  id: "cmu0kchd1rgc1",
  sendId: "sir78n6",
  vin: "1FTFW1E87PKE74233",
  ymmt: "2023 Ford F-150 Lariat",
  lane: "onsite",
  teamActivated: true,
  teamStatus: "final",
  appraisalFinal: { min: "45200", target: "47000", max: "49000", path: "Retail" },
  team: {
    shabot: { min: "45200", target: "47000", max: "49000", note: "Sided Wes direction; overruled Ryan high exit; photo-blind cap" },
    rybot: { min: "51000", target: "54000", max: "56000", note: "Exit too rich without photos" },
    webot: { min: "44500", target: "46500", max: "48000", note: "Blind-packet exit" },
    drebot: { min: "46500", target: "49500", max: "52000", note: "Shaved for zero photos" },
    tbot: { min: "43000", target: "45500", max: "48000", note: "Slightly too bear" }
  },
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
  },
  customer: { name: "F-150" }
};

incoming.resetStore();
incoming.route("POST", { kind: "land", item: f150Rich });
incoming.route("POST", {
  kind: "land",
  item: {
    id: "cmu0kchd1rgc1",
    sendId: "sir78n6",
    teamActivated: true,
    teamStatus: "running",
    team: { shabot: { min: "45200", target: "47000", max: "49000", note: "" } },
    customer: { name: "F-150" }
  }
});
let stored = incoming.listItems()[0];
assert.equal(stored.sendId, "sir78n6");
assert.equal(stored.team.rybot.min, "51000");
assert.equal(stored.team.rybot.target, "54000");
assert.equal(stored.team.rybot.max, "56000");
assert.equal(stored.team.rybot.note, "Exit too rich without photos");
assert.equal(stored.team.webot.note, "Blind-packet exit");
assert.equal(stored.team.drebot.note, "Shaved for zero photos");
assert.equal(stored.team.tbot.note, "Slightly too bear");
assert.ok(/Sided Wes/.test(stored.team.shabot.note), "shabot how-we-got-here note stays");
assert.equal(stored.finalRationale.schema_version, "1.0");
assert.ok(stored.finalRationale.markdown.indexOf("# HOW WE GOT HERE — Shabot FINAL") >= 0);
assert.equal(stored.finalRationale.panel.Rybot.why, "Exit too rich without photos");

incoming.route("POST", {
  kind: "land",
  item: {
    id: "cmu0kchd1rgc1",
    sendId: "sir78n6",
    team: {
      shabot: { min: "45200", target: "47000", max: "49000", note: "" },
      rybot: { min: "51000", target: "54000", max: "56000", note: "" },
      webot: { min: "44500", target: "46500", max: "48000", note: "" },
      drebot: { min: "46500", target: "49500", max: "52000", note: "" },
      tbot: { min: "43000", target: "45500", max: "48000", note: "" }
    },
    finalRationale: { schema_version: "1.0" },
    customer: { name: "F-150" }
  }
});
stored = incoming.listItems()[0];
assert.equal(stored.team.rybot.note, "Exit too rich without photos", "numbers-without-notes land keeps Incoming notes");
assert.equal(stored.team.webot.note, "Blind-packet exit");
assert.equal(stored.team.drebot.note, "Shaved for zero photos");
assert.equal(stored.team.tbot.note, "Slightly too bear");
assert.ok(stored.finalRationale.markdown.indexOf("HOW WE GOT HERE") >= 0, "thin schema_version 1.0 stub does not wipe markdown");
assert.equal(stored.finalRationale.panel.Webot.why, "Blind-packet exit");

incoming.route("POST", {
  kind: "land",
  item: {
    id: "cmu0kchd1rgc1",
    sendId: "sir78n6",
    finalRationale: {
      schema_version: "1.0",
      title: "",
      markdown: "",
      panel: {
        rybot: { min: "", target: "", max: "", why: "" },
        webot: { min: "", target: "", max: "", why: "" },
        drebot: { min: "", target: "", max: "", why: "" },
        tbot: { min: "", target: "", max: "", why: "" }
      }
    },
    customer: { name: "F-150" }
  }
});
stored = incoming.listItems()[0];
assert.ok(stored.finalRationale.markdown.indexOf("HOW WE GOT HERE — Shabot FINAL") >= 0, "empty panel stub does not wipe markdown");
assert.equal(stored.finalRationale.schema_version, "1.0");
assert.equal(stored.finalRationale.panel.TBot.why, "Slightly too bear");

const kept = incoming.keepExistingFinal(
  { team: { rybot: { min: "1", target: "2", max: "3", note: "long Incoming thought" } }, finalRationale: { schema_version: "1.0", markdown: "# HOW WE GOT HERE — Shabot FINAL" } },
  { team: { rybot: { min: "1", target: "2", max: "3", note: "" } }, finalRationale: { schema_version: "1.0" } }
);
assert.equal(kept.team.rybot.note, "long Incoming thought");
assert.ok(kept.finalRationale.markdown.indexOf("HOW WE GOT HERE") >= 0);

const thinLocal = {
  id: "cmu0kchd1rgc1",
  sendId: "sir78n6",
  team: {
    shabot: { min: "45200", target: "47000", max: "49000", note: "short" },
    rybot: { min: "51000", target: "54000", max: "56000", note: "" },
    webot: { min: "", target: "", max: "", note: "" },
    drebot: { min: "", target: "", max: "", note: "" },
    tbot: { min: "", target: "", max: "", note: "" }
  },
  finalRationale: { schema_version: "1.0", panel: { rybot: {}, webot: {}, drebot: {}, tbot: {} } }
};
hydrateTeamFromIncoming(thinLocal, stored);
assert.ok(/HOW WE GOT HERE/.test(thinLocal.team.shabot.note), "hydrate prefers Incoming markdown over short keep");
assert.equal(thinLocal.team.rybot.note, "Exit too rich without photos", "hydrate prefers Incoming Rybot note over empty keep");
assert.equal(thinLocal.team.webot.target, "46500");
assert.equal(thinLocal.finalRationale.schema_version, "1.0");
assert.ok(thinLocal.finalRationale.markdown.indexOf("HOW WE GOT HERE") >= 0, "hydrate prefers Incoming schema 1.0 markdown");
assert.ok(botHasCompleteNumbers(thinLocal.team.rybot));
assert.ok(botHasCompleteNumbers(thinLocal.team.webot));
assert.ok(botHasCompleteNumbers(thinLocal.team.drebot));
assert.ok(botHasCompleteNumbers(thinLocal.team.tbot));

const empty = { id: "c-empty", team: emptyTeam() };
hydrateTeamFromIncoming(empty);
assert.ok(!botHasCompleteNumbers(empty.team.shabot), "empty file does not invent Shabot");
assert.ok(!botHasCompleteNumbers(empty.team.rybot), "empty file does not invent Rybot");
assert.ok(!botHasCompleteNumbers(empty.team.webot));
assert.ok(!botHasCompleteNumbers(empty.team.drebot));
assert.ok(!botHasCompleteNumbers(empty.team.tbot));

incoming.resetStore();
incoming.route("POST", {
  kind: "land",
  item: {
    id: "c-empty-keep",
    sendId: "s-empty-keep",
    ymmt: "Empty file",
    customer: { name: "Empty" }
  }
});
const emptyRow = incoming.listItems()[0];
assert.ok(!emptyRow.appraisalFinal || !emptyRow.appraisalFinal.target, "mailer empty file has no invented FINAL");
assert.ok(!emptyRow.team || !Object.keys(emptyRow.team).length, "mailer empty file has no invented team");

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

console.log("d31a-mailer-keep-team: ok");
