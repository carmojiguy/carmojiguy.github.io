#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const vm = require("vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function must(re, msg) {
  assert.ok(re.test(html), msg);
}

must(/id="buildStamp">build d30b</, "footer stamp is build d30b");
must(/<!--[\s\S]*build d30b[\s\S]*sales PDF packet stays; zero Center samples/, "HTML comment stamp is d30b and keeps the sales PDF / zero-sample lock");
must(/id="typeSheet"[\s\S]*build d30b/, "type sheet stamp is build d30b");

must(/item\.appraisalFinal/, "durable appraisalFinal shape");
must(/item\.finalRationale/, "durable finalRationale shape");
must(/function emptyFinalRationale\(/, "emptyFinalRationale helper");
must(/function normalizeFinalRationale\(/, "normalizeFinalRationale helper");
must(/function resolveAppraisalFinal\(/, "resolveAppraisalFinal helper");
must(/function buildFinalDecisionHtml\(/, "buildFinalDecisionHtml helper");
must(/function openFinalDecision\(/, "openFinalDecision helper");
must(/function paintCenterFinalBox\(/, "paintCenterFinalBox helper");
must(/function syncAppraisalFinalFromTeam\(/, "syncAppraisalFinalFromTeam helper");
must(/item\.finalMin/, "resolveAppraisalFinal seeds finalMin alias");
must(/item\.finalTarget/, "resolveAppraisalFinal seeds finalTarget alias");
must(/item\.finalMax/, "resolveAppraisalFinal seeds finalMax alias");

must(/id="centerFinalBox"/, "FINAL box host in markup");
must(/paintCenterFinalBox\(item\)/, "paintCenterDetail paints the FINAL box");
must(/class="final-decision-box"/, "tappable FINAL box class");
must(/class="final-decision-doc"/, "sales-grade decision document class");
must(/openViewer\("packet", buildFinalDecisionHtml\(item\)/, "FINAL opens via openViewer packet");
must(/botId==="shabot"/, "openTeamWhy routes Shabot through the rich FINAL doc");

must(/function kickShare\(/, "kickShare still present");
must(/async function sharePacket\(/, "sharePacket still present");
must(/async function sendFromMe\(/, "sendFromMe still present");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "finishGuest still Thank-you-only");
must(/function restoreSend\(\)/, "restoreSend stays");

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
const guest = html.slice(html.indexOf("function finishGuest(){"), html.indexOf("\nfunction paintGuestStory("));
assert.ok(/sentOk=true;\s*finish\(""\);\s*try\{ finishGuest\(\); \}/.test(share), "Thank-you path stays frozen");
assert.ok(/sharePacket\(\);/.test(kick), "kickShare still goes to silent mailer");
assert.ok(/withTimeout\(storeSend\(/.test(send) || /STORE_SEND/.test(send) || /function sendFromMe\(/.test(send), "sendFromMe body untouched in shape");
assert.ok(/finishThanks\(\);/.test(guest), "finishGuest still only finishes Thank you");

const teamSlotSrc = html.match(/function teamSlot\(raw\)\{[\s\S]*?\n\}/)[0];
const moneySrc = html.match(/function moneyShort\(v\)\{[\s\S]*?\n\}/)[0];
const from = html.indexOf("function emptyAppraisalFinal(){");
const to = html.indexOf("\nfunction centerStore(){", from);
assert.ok(from > 0 && to > from, "final-decision helpers extractable");
const src = teamSlotSrc + "\n" + moneySrc + "\n" + html.slice(from, to);

const sandbox = { Date: Date };
vm.createContext(sandbox);
vm.runInContext(
  src +
    "\nthis.emptyFinalRationale=emptyFinalRationale;" +
    "this.normalizeFinalRationale=normalizeFinalRationale;" +
    "this.resolveAppraisalFinal=resolveAppraisalFinal;" +
    "this.buildFinalDecisionHtml=buildFinalDecisionHtml;" +
    "this.syncAppraisalFinalFromTeam=syncAppraisalFinalFromTeam;" +
    "this.emptyAppraisalFinal=emptyAppraisalFinal;",
  sandbox
);

const empty = sandbox.emptyFinalRationale();
assert.equal(empty.schema_version, "1.0", "rationale schema 1.0");
assert.ok(empty.panel.rybot && empty.panel.webot && empty.panel.drebot && empty.panel.tbot, "panel bots");
assert.ok(Array.isArray(empty.marketEvidence.vauto), "vauto comps array");
assert.ok(Array.isArray(empty.marketEvidence.openlane), "openlane comps array");
assert.ok(Array.isArray(empty.marketEvidence.eblock), "eblock comps array");
assert.ok(Array.isArray(empty.marketEvidence.carfax), "carfax comps array");

assert.equal(sandbox.resolveAppraisalFinal({}), null, "no FINAL without numbers");
const fromAf = sandbox.resolveAppraisalFinal({ appraisalFinal: { min: "18000", target: "19500", max: "21000", path: "Retail" } });
assert.equal(fromAf.min, "18000", "prefers appraisalFinal min");
assert.equal(fromAf.target, "19500", "prefers appraisalFinal target");
assert.equal(fromAf.max, "21000", "prefers appraisalFinal max");
assert.equal(fromAf.path, "Retail", "prefers appraisalFinal path");
assert.equal(
  sandbox.resolveAppraisalFinal({ team: { shabot: { min: "1", target: "2", max: "3" } } }).target,
  "2",
  "seeds from team.shabot"
);
assert.equal(
  sandbox.resolveAppraisalFinal({ finalMin: "9", finalTarget: "10", finalMax: "11" }).target,
  "10",
  "seeds from finalMin/Target/Max aliases"
);

const seeded = sandbox.emptyFinalRationale();
seeded.vehicle = { ymmt: "2022 Toyota RAV4 XLE", vin: "JTMRWRFV0NJ123456", km: "48200", stock: "ST-88", customer: "Pat Lee", lane: "onsite" };
seeded.shabot = { min: "18500", target: "19800", max: "21200", path: "Retail", note: "Sided with Rybot on the clean retail path." };
seeded.panel.rybot = { min: "18400", target: "19700", max: "21000", sidedWith: true, why: "Retail comps hold." };
seeded.panel.webot = { min: "17000", target: "18200", max: "19000", sidedWith: false, why: "Wholesale pressure." };
seeded.marketEvidence.vauto = [];
for (let i = 1; i <= 20; i++) {
  seeded.marketEvidence.vauto.push({
    price: String(17000 + i * 100),
    km: String(40000 + i * 250),
    date: "2026-08-" + String((i % 28) + 1).padStart(2, "0"),
    notes: "V Auto comp " + i,
    source: "V Auto"
  });
}
seeded.marketEvidence.openlane = [{ price: "19100", km: "51000", date: "2026-07-12", notes: "OL unit", source: "OpenLane" }];
seeded.missingData = ["T1", "T2"];
seeded.risks = ["Tire replacement"];
seeded.whatMovesNumber = ["Clean Carfax would lift TARGET"];
seeded.authors = ["Shabot"];
seeded.timestamp = Date.parse("2026-09-13T12:00:00Z");

const doc = sandbox.buildFinalDecisionHtml({
  ymmt: "2022 Toyota RAV4 XLE",
  vin: "JTMRWRFV0NJ123456",
  km: "48200",
  stock: "ST-88",
  customer: { name: "Pat Lee" },
  lane: "onsite",
  team: { shabot: { min: "18500", target: "19800", max: "21200", note: "live" } },
  appraisalFinal: { min: "18500", target: "19800", max: "21200", path: "Retail" },
  finalRationale: seeded
});

[
  "Vehicle",
  "Shabot FINAL",
  "Panel",
  "Market evidence",
  "V Auto",
  "OpenLane",
  "eBlock",
  "Carfax",
  "Seasonality",
  "Condition",
  "Missing",
  "Risks",
  "Timestamp",
  "Authors"
].forEach(function (heading) {
  assert.ok(doc.indexOf(heading) >= 0, "decision HTML includes " + heading);
});

const vautoComps = doc.match(/V Auto comp \d+/g) || [];
assert.ok(vautoComps.length === 20, "builder lists all 20 seeded V Auto comps, not a 3-comp cap");
assert.ok((doc.match(/class="comp"/g) || []).length >= 21, "every extracted comp is rendered");
assert.ok(doc.indexOf("No eBlock comps extracted") >= 0, "honest empty eBlock callout");
assert.ok(doc.indexOf("T1") >= 0 && doc.indexOf("T2") >= 0, "missing T1/T2 called out");

const emptyDoc = sandbox.buildFinalDecisionHtml({
  ymmt: "2021 Honda CR-V",
  lane: "onsite",
  appraisalFinal: { min: "12000", target: "13000", max: "14000" },
  finalRationale: sandbox.emptyFinalRationale()
});
assert.ok(/No V Auto comps extracted/.test(emptyDoc), "never invents V Auto comps");
assert.ok(/No OpenLane comps extracted/.test(emptyDoc), "never invents OpenLane comps");

const live = { team: { shabot: { min: "", target: "", max: "", note: "keep" } }, finalRationale: { schema_version: "1.0", authors: ["Wes"] } };
live.team.shabot.target = "22200";
sandbox.syncAppraisalFinalFromTeam(live);
assert.equal(live.appraisalFinal.target, "22200", "Shabot inputs sync appraisalFinal");
assert.equal(live.finalRationale.authors[0], "Wes", "sync does not wipe finalRationale");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("final-decision: ok");
