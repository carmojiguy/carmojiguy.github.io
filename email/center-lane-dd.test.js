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

must(/id="buildStamp">build d31c</, "footer stamp is d30h");
must(/<!--[\s\S]*build d31c[\s\S]*status dropdown/, "header stamp is d30h dropdown");
must(/class="lane-dd inbox"/, "desk card ships on-tile lane dropdown markup");
must(/class="lane-dd-sel"/, "native status select is on the chip");
must(/<option value="inbox" selected>Incoming<\/option>/, "Incoming option");
must(/<option value="onsite">On-site<\/option>/, "On-site option");
must(/<option value="needsdocs">Needs docs<\/option>/, "Needs docs option");
must(/<option value="history">History<\/option>/, "History option");
must(/function applyCenterLaneMove\(/, "applyCenterLaneMove writes the local lane");
must(/function moveCenterLane\(/, "moveCenterLane is the tile action");
must(/function shareCenterLaneBestEffort\(/, "lane move posts the mailer");
must(/function centerLaneChipHtml\(/, "every tile paints the status chip select");
must(/function bindCenterLaneChip\(/, "chip tap does not open the row");
must(/centerLaneChipHtml\(item\)/, "acre rows use the on-tile dropdown");
must(/bindCenterLaneChip\(btn, item\)/, "list tiles bind the dropdown");
must(/bindCenterLaneChip\(\$\("centerDetailBadge"\), item\)/, "desk card binds the dropdown");
must(/MAIL_HOST\+"\/api\/incoming"/, "lane POST hits MAIL_HOST /api/incoming");
must(/kind:"land"/, "lane POST is kind:land");
must(/item\.lanePick=want/, "explicit pick sticks on the Center item");
must(/item\.archived=true/, "History sets archived true");
must(/item\.stage="Appraised"/, "History sets stage Appraised");
must(/slim\.lane=lane/, "mailer slim uses the picked lane");
must(/slim\.archived=true/, "mailer slim archives History");

mustNot(/function kickShare\(\)\{[\s\S]{0,80}moveCenterLane/, "Send is not rewritten by the dropdown");
mustNot(/function sharePacket\(\)\{[\s\S]{0,80}moveCenterLane/, "sharePacket is not rewritten by the dropdown");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");

const kick = sliceFn("kickShare", "packetSendId");
const shareStart = html.indexOf("async function sharePacket(){");
const shareEnd = html.indexOf("\nfunction resetAll()", shareStart);
const share = html.slice(shareStart, shareEnd);
assert.ok(!/moveCenterLane/.test(kick), "kickShare does not move lanes");
assert.ok(!/moveCenterLane/.test(share), "sharePacket does not move lanes");
assert.ok(!/shareCenterLaneBestEffort/.test(kick), "kickShare does not post lane moves");
assert.ok(!/shareCenterLaneBestEffort/.test(share), "sharePacket does not post lane moves");

const acre = sliceFn("acreRow", "paintCenter");
assert.ok(/centerLaneChipHtml\(item\)/.test(acre), "Incoming / On-site / Needs docs / History rows have the chip");
assert.ok(/bindCenterLaneChip\(btn, item\)/.test(acre), "row chip is live");
assert.ok(/openCenterDetail/.test(acre), "row tap still opens the desk");

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
const applyCenterLaneMove = eval("(" + html.match(/function applyCenterLaneMove\(item, lane\)\{[\s\S]*?\n\}/)[0].replace("function applyCenterLaneMove", "function") + ")");
const normalizeCenterLane = eval("(" + html.match(/function normalizeCenterLane\(lane\)\{[\s\S]*?\n\}/)[0].replace("function normalizeCenterLane", "function") + ")");

assert.equal(normalizeCenterLane("Incoming"), "inbox");
assert.equal(normalizeCenterLane("On-site"), "onsite");
assert.equal(normalizeCenterLane("Needs docs"), "needsdocs");
assert.equal(normalizeCenterLane("History"), "history");

const item = {
  id: "c-dd-1",
  lane: "inbox",
  docs: { vauto: { have: true, preview: "data:image/jpeg,v" }, openlane: { have: true }, eblock: { have: true } },
  source: "guest",
  stage: "Waiting",
  photos: [{ title: "3/4 front", data: "data:image/jpeg;base64,FATPHOTO" }],
  pdfUrl: "https://example.com/sales-final.pdf",
  appraisalFinal: { min: "22800", target: "24000", max: "25000" },
  finalRationale: { shabot: { min: "22800", target: "24000", max: "25000" } },
  team: { shabot: { min: "22800", target: "24000", max: "25000", note: "seed" } },
  story: "Clean trade. One key."
};
assert.equal(centerLaneOf(item), "onsite", "complete packet still paints On-site before a pick");
applyCenterLaneMove(item, "inbox");
assert.equal(item.lane, "inbox", "Incoming pick writes inbox");
assert.equal(item.lanePick, "inbox");
assert.equal(item.archived, false);
assert.equal(centerLaneOf(item), "inbox", "Incoming pick updates the lane immediately");

applyCenterLaneMove(item, "needsdocs");
assert.equal(item.lane, "needsdocs");
assert.equal(item.docsIncomplete, true);
assert.equal(centerLaneOf(item), "needsdocs", "Needs docs pick updates the lane immediately");

applyCenterLaneMove(item, "onsite");
assert.equal(item.lane, "onsite");
assert.equal(item.archived, false);
assert.equal(centerLaneOf(item), "onsite", "On-site pick updates the lane immediately");

applyCenterLaneMove(item, "history");
assert.equal(item.lane, "history");
assert.equal(item.archived, true, "History pick archives");
assert.equal(item.stage, "Appraised", "History pick is Appraised");
assert.equal(centerLaneOf(item), "history", "History pick updates the lane immediately");
assert.ok(!item.superseded && !item.locked && !item.supersedeLock, "manual History move does not lock/supersede");
assert.equal(item.photos[0].data, "data:image/jpeg;base64,FATPHOTO", "History move keeps photos");
assert.equal(item.pdfUrl, "https://example.com/sales-final.pdf", "History move keeps pdfUrl");
assert.equal(item.appraisalFinal.target, "24000", "History move keeps FINAL");
assert.equal(item.docs.vauto.preview, "data:image/jpeg,v", "History move keeps fat docs");
assert.equal(item.story, "Clean trade. One key.", "History move keeps story");
assert.equal(item.team.shabot.target, "24000", "History move keeps team");

applyCenterLaneMove(item, "onsite");
assert.equal(item.archived, false, "leaving History un-archives");
assert.equal(item.stage, "Waiting", "leaving History clears Appraised");
assert.equal(item.lane, "onsite");
assert.equal(centerLaneOf(item), "onsite");
assert.ok(!item.superseded && !item.locked && !item.supersedeLock, "History → On-site does not lock");
assert.equal(item.photos[0].data, "data:image/jpeg;base64,FATPHOTO", "On-site move keeps photos");
assert.equal(item.pdfUrl, "https://example.com/sales-final.pdf", "On-site move keeps pdfUrl");
assert.equal(item.appraisalFinal.target, "24000", "On-site move keeps FINAL");
assert.equal(item.docs.vauto.preview, "data:image/jpeg,v", "On-site move keeps fat docs");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("center-lane-dd: ok");
