#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

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

must(/id="buildStamp">build d30n</, "footer stamp is d30h");
must(/<!--[\s\S]*build d30n[\s\S]*status dropdown/, "header stamp is d30h dropdown");
must(/function applyCenterLaneMove\(/, "lane move stays");
must(/function moveCenterLane\(/, "tile action stays");
must(/bindCenterLaneChip\(\$\("centerDetailBadge"\), item\)/, "detail dropdown stays bound");
must(/centerLaneChipHtml\(item\)/, "every tile still has the status chip");
must(/class="lane-dd-sel"/, "native status select stays");
mustNot(/id="exitRefresh"/, "Refresh stays gone");
must(/min-height:24px/, "Back/Home are quieter");
must(/font-size:11px; font-weight:500/, "Back/Home type is quieter");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
must(/function persistMarketDocUrls\(/, "market docs host to a public url");
must(/function slimSharedHttpUrl\(/, "slim docs keep only http(s) urls");
mustNot(/openlane:\s*\[\{/, "do not invent OpenLane solds");

const acre = sliceFn("acreRow", "paintCenter");
assert.ok(/openCenterDetail/.test(acre), "Center tiles open the full desk");
assert.ok(!/reopenHistoryAppraisal/.test(acre), "History tile does not open the photo studio");
assert.ok(/bindCenterLaneChip\(btn, item\)/.test(acre), "History tile dropdown stays live");

const reopen = sliceFn("reopenHistoryAppraisal", "closeTradeLane");
assert.ok(/openCenterDetail/.test(reopen), "History reopen paints the Center sheet");
assert.ok(/canUseCenter/.test(reopen), "staff Center path is gated");

const detail = sliceFn("paintCenterDetail", "landInCenter");
assert.ok(/centerLaneChipHtml\(item\)/.test(detail), "History / archived detail keeps the dropdown");
assert.ok(/paintCenterFinalBox/.test(detail), "History detail paints FINAL");
assert.ok(/paintCenterDocs/.test(detail), "History detail paints docs");
assert.ok(/paintCenterTeam/.test(detail), "History detail paints team");
assert.ok(/paintCenterRunTeam/.test(detail), "History detail can Run Appraisal Team");

mustNot(/function kickShare\(\)\{[\s\S]{0,80}applyCenterLaneMove/, "Send is not rewritten by the dropdown");
mustNot(/async function sharePacket\(\)\{[\s\S]{0,120}slimSharedCenterItem\(item\);\s*Object\.assign/, "sharePacket does not replace the Center item with slim");

function isCenterArchived(item) {
  return !!(item && (item.archived || item.stage === "Appraised"));
}
function isNeedsDocsItem(item) {
  if (!item) return false;
  if (isCenterArchived(item)) return false;
  if (item.lane === "onsite") return false;
  if (item.docsIncomplete || item.lane === "needsdocs") return true;
  return false;
}
function isLandedCenterPacket() { return true; }
function marketDocsComplete() { return true; }
const centerLaneOf = eval("(" + html.match(/function centerLaneOf\(item\)\{[\s\S]*?\n\}/)[0].replace("function centerLaneOf", "function") + ")");
const normalizeCenterLane = eval("(" + html.match(/function normalizeCenterLane\(lane\)\{[\s\S]*?\n\}/)[0].replace("function normalizeCenterLane", "function") + ")");
const applyCenterLaneMove = eval("(" + html.match(/function applyCenterLaneMove\(item, lane\)\{[\s\S]*?\n\}/)[0].replace("function applyCenterLaneMove", "function") + ")");
const slimSharedHttpUrl = eval("(" + html.match(/function slimSharedHttpUrl\(v\)\{[\s\S]*?\n\}/)[0].replace("function slimSharedHttpUrl", "function") + ")");
const slimSharedDocs = eval("(" + html.match(/function slimSharedDocs\(docs\)\{[\s\S]*?\n\}/)[0].replace("function slimSharedDocs", "function") + ")");
function laneFromMarketDocs(docs, prefer) {
  return { lane: prefer === "onsite" || !prefer ? "onsite" : (prefer || "onsite"), docsIncomplete: prefer === "needsdocs", missingDocs: [] };
}
function sharedDocsHaveCount(docs) {
  docs = docs || {};
  let n = 0;
  Object.keys(docs).forEach(function (k) {
    const d = docs[k];
    if (d && (d.have || d.data || d.preview)) n++;
  });
  return n;
}
function sharedItemStamp(x) { return Number((x && (x.sentAt || x.updatedAt || x.createdAt)) || 0); }
function seedSharedIncomingFinal(item) { return item; }
function emptyAppraisalFinal() { return {}; }
function hasAppraisalFinalNumbers() { return false; }
function resolveAppraisalFinal() { return null; }
function hasStoredFinalRationale() { return false; }
function teamSlot(raw) { raw = raw || {}; return raw; }
const applyStart = html.indexOf("function applySharedIncoming(");
const applyEnd = html.indexOf("\nlet incomingPullAt=", applyStart);
const applySharedIncoming = eval("(" + html.slice(applyStart, applyEnd).replace("function applySharedIncoming", "function") + ")");
const slimSrc = html.match(/function slimSharedCenterItem\(item\)\{[\s\S]*?\n\}/)[0];
const APP = { sendId: "", inviteUnit: "" };
function landingLaneForSend() { return "onsite"; }
const slimSharedCenterItem = eval("(" + slimSrc.replace("function slimSharedCenterItem", "function") + ")");

const packet = {
  id: "c-d30h-1",
  sendId: "s-d30h",
  vin: "2T3B1RFVXRC466025",
  ymmt: "2024 Toyota RAV4",
  source: "guest",
  lane: "onsite",
  stage: "Waiting",
  archived: false,
  photos: [{ title: "3/4 front", data: "data:image/jpeg;base64," + new Array(120010).join("P") }],
  pdfUrl: "https://example.com/s1ex074-sales-final.pdf",
  pdfName: "s1ex074-sales-final.pdf",
  docs: { vauto: { have: true, preview: "data:image/jpeg,v" }, openlane: { have: true }, eblock: { have: true } },
  appraisalFinal: { min: "22800", target: "24000", max: "25000" },
  finalRationale: { shabot: { min: "22800", target: "24000", max: "25000" }, authors: ["shabot"] },
  team: { shabot: { min: "22800", target: "24000", max: "25000", note: "seed" } },
  story: "Clean trade. One key.",
  customer: { name: "Chris Cyr" }
};

applyCenterLaneMove(packet, "history");
assert.equal(packet.lane, "history");
assert.equal(packet.archived, true);
assert.equal(packet.lanePick, "history");
assert.ok(!packet.superseded && !packet.locked && !packet.supersedeLock, "manual History is not superseded");
assert.equal(packet.photos[0].data.indexOf("data:image/jpeg;base64,P"), 0, "History keeps photos");
assert.equal(packet.pdfUrl, "https://example.com/s1ex074-sales-final.pdf", "History keeps PDF");
assert.equal(packet.appraisalFinal.target, "24000", "History keeps FINAL");
assert.equal(centerLaneOf(packet), "history");

const echo = slimSharedCenterItem(packet);
echo.lane = "history";
echo.archived = true;
echo.updatedAt = Date.now() + 9999;
const afterEcho = applySharedIncoming(packet, echo);
assert.strictEqual(afterEcho, packet, "Incoming pull mutates the same fat item");
assert.equal(packet.photos[0].data.indexOf("data:image/jpeg;base64,P"), 0, "slim echo does not replace photos");
assert.equal(packet.pdfUrl, "https://example.com/s1ex074-sales-final.pdf");
assert.equal(packet.appraisalFinal.target, "24000");
assert.equal(packet.docs.vauto.preview, "data:image/jpeg,v");
assert.equal(packet.team.shabot.note, "seed");
assert.equal(packet.story, "Clean trade. One key.");
assert.equal(packet.lanePick, "history", "pull does not clear lanePick");
assert.equal(packet.archived, true, "photos do not unarchive History");

applyCenterLaneMove(packet, "onsite");
assert.equal(packet.archived, false, "History → On-site clears archived");
assert.equal(packet.stage, "Waiting");
assert.equal(packet.lane, "onsite");
assert.equal(centerLaneOf(packet), "onsite");
assert.equal(packet.photos[0].data.indexOf("data:image/jpeg;base64,P"), 0, "On-site keeps photos");
assert.equal(packet.pdfUrl, "https://example.com/s1ex074-sales-final.pdf", "On-site keeps PDF");
assert.equal(packet.appraisalFinal.target, "24000", "On-site keeps FINAL");
assert.ok(!packet.superseded && !packet.locked && !packet.supersedeLock);

applyCenterLaneMove(packet, "needsdocs");
assert.equal(centerLaneOf(packet), "needsdocs");
assert.equal(packet.docsIncomplete, true);
assert.equal(packet.photos[0].data.indexOf("data:image/jpeg;base64,P"), 0, "Needs docs keeps photos");
applyCenterLaneMove(packet, "onsite");
assert.equal(centerLaneOf(packet), "onsite");
assert.equal(packet.appraisalFinal.target, "24000", "Needs docs → On-site keeps FINAL");

["inbox", "onsite", "needsdocs", "history"].forEach(function (lane) {
  applyCenterLaneMove(packet, lane);
  assert.equal(packet.lanePick, lane);
  assert.equal(centerLaneOf(packet), lane);
  assert.ok(!packet.superseded && !packet.locked && !packet.supersedeLock, lane + " move does not lock");
});

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("d30h-history-sheet: ok");
