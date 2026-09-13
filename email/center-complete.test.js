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
function mustNot(re, msg) {
  assert.ok(!re.test(html), msg);
}
function sliceFn(name, next) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start > 0, name + " found");
  const end = html.indexOf("\nfunction " + next + "(", start);
  assert.ok(end > start, name + " ends before " + next);
  return html.slice(start, end);
}

must(/id="buildStamp">build d30b</, "footer stamp is build d30b");
must(/<!--[\s\S]*build d30b[\s\S]*Thank-you frozen/, "HTML comment stamp is d30b");
must(/id="typeSheet"[\s\S]*build d30b/, "type sheet stamp is d30b");
must(/function hasShabotFinal\(/, "COMPLETE detector");
must(/function isCenterComplete\(/, "Center-side complete flag helper");
must(/function parkCompletedAppraisal\(/, "FINAL parks to History");
must(/function reactivateHistoryAppraisal\(/, "Reactivate helper");
must(/function unlockShabotFinal\(/, "Reactivate unlocks FINAL numbers");
must(/id="centerReactivateBtn"/, "History detail Reactivate button");
must(/class="reactivate-btn"/, "sales-grade Reactivate style");
must(/class="acre-reactivate"/, "History row Reactivate");
must(/function reopenHistoryAppraisal\(/, "History tap-to-reopen stays");
mustNot(/2T3B1RFVXRC466025/, "no RAV4 VIN special-case");
mustNot(/function hasShabotFinal\([\s\S]{0,400}2T3B/, "COMPLETE detector is VIN-agnostic");

const kick = sliceFn("kickShare", "packetSendId");
const share = (function () {
  const start = html.indexOf("async function sharePacket(){");
  const end = html.indexOf("\nfunction resetAll()", start);
  assert.ok(start > 0 && end > start, "sharePacket found");
  return html.slice(start, end);
})();
assert.ok(!/api\/incoming/.test(kick), "kickShare does not touch /api/incoming");
assert.ok(!/api\/incoming/.test(share), "sharePacket does not touch /api/incoming");
assert.ok(/sentOk=true;\s*finish\(""\);\s*try\{ finishGuest\(\); \}/.test(share), "Thank-you path stays frozen");
assert.ok(!/parkCompletedAppraisal/.test(share), "Send does not park COMPLETE");
assert.ok(!/reactivateHistoryAppraisal/.test(share), "Send does not Reactivate");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "finishGuest stays Thank-you-only");

const reopen = sliceFn("reopenHistoryAppraisal", "reactivateHistoryAppraisal");
assert.ok(reopen.indexOf("applyCenterItemToApp") >= 0, "tap-to-reopen still hydrates the job");
assert.ok(/show\("photos"\)/.test(reopen), "reopen can land on photos");
assert.ok(/show\("home"\)/.test(reopen), "reopen can land on home");

const react = sliceFn("reactivateHistoryAppraisal", "closeTradeLane");
assert.ok(react.indexOf("unlockShabotFinal") >= 0, "Reactivate clears the FINAL lock");
assert.ok(react.indexOf('x.lane="onsite"') >= 0, "Reactivate sets lane=onsite");
assert.ok(react.indexOf("reopenHistoryAppraisal") >= 0, "Reactivate opens full edit");
assert.ok(react.indexOf("kickShare") < 0, "Reactivate does not Send");

const applySrc = html.slice(
  html.indexOf("function applySharedIncoming("),
  html.indexOf("\nlet incomingPullAt=")
);
assert.ok(/keepComplete/.test(applySrc), "Incoming apply honors Center COMPLETE");
assert.ok(/parkCompletedAppraisal/.test(applySrc), "Incoming apply re-parks COMPLETE");

const mergeSrc = sliceFn("mergeIncomingShared", "scheduleIncomingPull");
assert.ok(/isCenterComplete/.test(mergeSrc), "Incoming merge will not un-park COMPLETE");

const sandbox = {
  Date: Date,
  APP: { sendId: "", centerId: "", inviteUnit: "" },
  persistCenterMedia: function () { return { catch: function () { return this; } }; }
};
vm.createContext(sandbox);

const teamSlotSrc = html.match(/function teamSlot\(raw\)\{[\s\S]*?\n\}/)[0];
const emptyTeamSrc = html.match(/function emptyTeam\(\)\{[\s\S]*?\n\}/)[0];
const finalFrom = html.indexOf("function emptyAppraisalFinal(){");
const finalTo = html.indexOf("\nfunction centerStore(){", finalFrom);
const completeFrom = html.indexOf("function shabotFinalLocked(");
const completeTo = html.indexOf("\nfunction isTradeLinkItem(", completeFrom);
assert.ok(finalFrom > 0 && finalTo > finalFrom, "FINAL helpers extractable");
assert.ok(completeFrom > 0 && completeTo > completeFrom, "COMPLETE helpers extractable");

const laneFrom = html.match(/function laneFromMarketDocs\(docs(?:, prefer)?\)\{[\s\S]*?\n\}/)[0];
const haveM = html.match(/function packetDocHave\(docs, spec\)\{[\s\S]*?\n\}/)[0];
const missM = html.match(/function missingMarketDocs\(docs\)\{[\s\S]*?\n\}/)[0];
const doneM = html.match(/function marketDocsComplete\(docs\)\{[\s\S]*?\n\}/)[0];
const landedM = html.match(/function isLandedCenterPacket\(item\)\{[\s\S]*?\n\}/)[0];
const needsM = html.match(/function isNeedsDocsItem\(item\)\{[\s\S]*?\n\}/)[0];
const laneOfM = html.match(/function centerLaneOf\(item\)\{[\s\S]*?\n\}/)[0];
const MARKET_DOC_REQ = eval("(" + html.match(/const MARKET_DOC_REQ=(\[[\s\S]*?\]);/)[1] + ")");

function takeFn(name, next) {
  return sliceFn(name, next);
}

vm.runInContext(
  "const MARKET_DOC_REQ=" + JSON.stringify(MARKET_DOC_REQ) + ";\n" +
  emptyTeamSrc + "\n" + teamSlotSrc + "\n" +
    html.slice(finalFrom, finalTo) + "\n" +
    html.slice(completeFrom, completeTo) + "\n" +
    haveM + "\n" + missM + "\n" + doneM + "\n" + laneFrom + "\n" + landedM + "\n" +
    "function isCenterArchived(item){ return !!(item && (item.archived || item.stage===\"Appraised\")); }\n" +
    needsM + "\n" + laneOfM + "\n" +
    takeFn("sharedItemStamp", "sharedDocsHaveCount") + "\n" +
    takeFn("sharedDocsHaveCount", "sharedRemoteBeats") + "\n" +
    takeFn("reviveSharedCenterItem", "collapseSharedRemotes") + "\n" +
    "function slimSharedDocs(docs){ var src=docs||{}, out={}; Object.keys(src).forEach(function(k){ var d=src[k]; var have=d===true||d===1||d===\"true\"||!!(d&&(d.have||d.data||d.extract||d.preview||(d.shots&&d.shots.length))); out[k]={have:have,name:(d&&d.name)||\"\",type:(d&&d.type)||\"\"}; }); return out; }\n" +
    applySrc + "\n" +
    "this.hasShabotFinal=hasShabotFinal;" +
    "this.isCenterComplete=isCenterComplete;" +
    "this.parkCompletedAppraisal=parkCompletedAppraisal;" +
    "this.unlockShabotFinal=unlockShabotFinal;" +
    "this.resolveAppraisalFinal=resolveAppraisalFinal;" +
    "this.centerLaneOf=centerLaneOf;" +
    "this.isNeedsDocsItem=isNeedsDocsItem;" +
    "this.applySharedIncoming=applySharedIncoming;" +
    "this.marketDocsComplete=marketDocsComplete;",
  sandbox
);

(function testFinalParksToHistory() {
  const item = {
    id: "c-final-1",
    source: "appraise",
    lane: "onsite",
    stage: "Waiting",
    archived: false,
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    team: { shabot: { min: "18000", target: "19500", max: "21000", note: "Retail hold." } }
  };
  assert.ok(sandbox.hasShabotFinal(item), "Shabot min/target/max is FINAL");
  assert.ok(sandbox.isCenterComplete(item), "FINAL is Center COMPLETE");
  sandbox.parkCompletedAppraisal(item);
  assert.equal(item.lane, "history", "FINAL auto-routes to History");
  assert.equal(item.centerComplete, true, "Center-side complete flag is stamped");
  assert.equal(sandbox.centerLaneOf(item), "history", "centerLaneOf paints History");
  assert.equal(sandbox.isNeedsDocsItem(item), false, "COMPLETE is not Needs docs");
})();

(function testSendPhotosPillsAreNotComplete() {
  const sent = {
    id: "c-sent",
    source: "guest",
    lane: "onsite",
    sendId: "s-send",
    sentAt: Date.now(),
    photoCount: 12,
    photos: [{ title: "3/4 front", data: "data:image/jpeg;base64,AAA" }],
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    team: { shabot: { min: "", target: "", max: "", note: "" } }
  };
  assert.equal(sandbox.hasShabotFinal(sent), false, "Send + photos + 3-pill flags are not FINAL");
  assert.equal(sandbox.isCenterComplete(sent), false, "Send + photos + 3-pills are not COMPLETE");
  sandbox.parkCompletedAppraisal(sent);
  assert.equal(sent.lane, "onsite", "without FINAL the item stays On-site");
  assert.equal(sandbox.centerLaneOf(sent), "onsite", "d29t flags-complete still On-site when no FINAL");
})();

(function testReactivateReturnsOnsite() {
  const item = {
    id: "c-re-1",
    source: "appraise",
    lane: "history",
    stage: "Appraised",
    archived: true,
    centerComplete: true,
    team: { shabot: { min: "1", target: "2", max: "3", note: "keep the why" } },
    appraisalFinal: { min: "1", target: "2", max: "3", path: "Retail" }
  };
  sandbox.unlockShabotFinal(item);
  item.archived = false;
  item.stage = "Waiting";
  item.lane = "onsite";
  assert.equal(item.centerComplete, false, "Reactivate clears complete flag");
  assert.equal(item.needsRelock, true, "Reactivate requires a new FINAL lock");
  assert.equal(sandbox.hasShabotFinal(item), false, "cleared numbers are not FINAL");
  assert.equal(sandbox.isCenterComplete(item), false, "reactivated file is not COMPLETE");
  assert.equal(item.lane, "onsite", "Reactivate lands On-site");
  assert.equal(item.team.shabot.note, "keep the why", "thought process stays for the re-run");
})();

(function testIncomingDoesNotUnparkComplete() {
  const item = {
    id: "c-parked",
    source: "guest",
    lane: "history",
    stage: "Appraised",
    archived: true,
    centerComplete: true,
    sentAt: 100,
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    team: { shabot: { min: "18000", target: "19500", max: "21000" } },
    customer: { name: "Pat Lee" }
  };
  const out = sandbox.applySharedIncoming(item, {
    sendId: "s-newer",
    vin: "1HGCM82633A004352",
    sentAt: 999999,
    updatedAt: 999999,
    lane: "onsite",
    photoCount: 8,
    photos: [{ title: "3/4 front", data: "data:image/jpeg;base64,AAA" }],
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
    customer: { name: "Pat Lee" }
  });
  assert.equal(out.lane, "history", "Incoming pull does not yank COMPLETE to On-site");
  assert.equal(out.centerComplete, true, "Center COMPLETE flag survives Incoming");
  assert.equal(out.archived, true, "COMPLETE stays archived");
  assert.equal(out.stage, "Appraised", "COMPLETE stage stays Appraised");
  assert.equal(out.photos.length, 8 > 0 ? 1 : 0, "Incoming can still copy photos onto a parked file");
})();

(function testFlagsCompleteInProgressStaysOnsite() {
  const item = sandbox.applySharedIncoming({
    id: "c-progress",
    lane: "inbox",
    source: "guest",
    docs: {},
    team: { shabot: { min: "", target: "", max: "" } }
  }, {
    sendId: "s-flags",
    vin: "1HGCM82633A004352",
    lane: "onsite",
    docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true }, carfax: { have: true } },
    customer: { name: "In Progress" },
    photoCount: 4
  });
  assert.equal(sandbox.hasShabotFinal(item), false, "in-progress has no FINAL");
  assert.equal(item.lane, "onsite", "remote.lane=onsite + 3-pill flags still win On-site");
  assert.equal(sandbox.centerLaneOf(item), "onsite");
  assert.equal(sandbox.isNeedsDocsItem(item), false);
})();

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("center-complete: ok");
