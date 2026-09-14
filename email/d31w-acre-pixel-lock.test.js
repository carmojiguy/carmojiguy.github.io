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
must(/<!--[\s\S]*pixel-faithful Acre GR Corolla desk/, "header names the pixel lock");
must(/<!--[\s\S]*white hero\|mid\|market/, "header names the screenshot columns");
must(/function oldestReadyCenter\(/, "FIFO oldest home stays");
must(/id="centerLanes"[^>]*center-rail|class="center-lanes center-rail"/, "left rail stays");
must(/#centerNavHistBtn \{ display:none/, "top hist pills stay killed");
mustNot(/32 up/, "no 32-up KPI copy");
mustNot(/9 hist/, "no 9-hist KPI copy");
mustNot(/8 on-site/, "no 8-on-site KPI copy");

must(/id="acreDesk"/, "Acre desk wrapper");
must(/class="acre-col-hero"/, "hero column");
must(/class="acre-notes-block"/, "notes sit under the hero");
must(/class="acre-thumbs-row"/, "thumbs are a bottom strip");
must(/class="acre-col-mid"/, "title / metrics / offers column");
must(/class="acre-col-market"/, "right market cards column");
must(/CENTER_PHOTO_DOCS/, "photo card list");
must(/Documents\/VAUTO\/BLACK BOOK/, "header names the photo cards");
must(/id="centerSources"/, "source pills");
must(/id="centerMayaStrip"/, "Maya note strip under notes");
must(/id="centerHero"/, "hero photo");
must(/id="centerThumbs"/, "thumbs");
must(/id="centerMetrics"/, "metrics strip");
must(/\["range","Appraisal range"\]/, "appraisal range");
must(/\["compete","Competing offer"\]/, "competing offer");
must(/\["ask","Customer ask"\]/, "customer ask");
must(/id="centerValStrip"/, "offer rows");
must(/id="centerMarket"/, "market cards");
must(/id="centerNotes"/, "notes");
must(/id="centerMayaBar"/, "Ask Maya");
must(/placeholder="Ask Maya"/, "Ask Maya placeholder");
must(/id="centerStageBtn">Complete</, "Complete");
must(/class="dock acre-dock"/, "Maya + Complete share the dock");
must(/#center \.acre-desk\{[\s\S]{0,280}grid-template-areas:"hero mid market"/, "desktop is hero | mid | market");
must(/#center\.screen \{[\s\S]{0,220}background:#F5F6F8/, "white Acre page");
mustNot(/#center\.screen \{[\s\S]{0,280}--purple:#1F6B6A/, "teal accent reverted");
mustNot(/#center\.screen \{[\s\S]{0,220}background:#F3F1EA/, "stone page reverted");
must(/function pullUsersRemote\(/, "users persist stays");
must(/function settleTeamRunIfFinal\(/, "FINAL still clears Running");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
mustNot(/id="exitRefresh"/, "Refresh stays gone");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");

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

console.log("d31w-acre-pixel-lock: ok");
