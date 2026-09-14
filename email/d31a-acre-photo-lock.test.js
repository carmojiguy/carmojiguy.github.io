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
must(/<!--[\s\S]*HARD LOCK photo desk/, "header names the photo hard lock");
must(/<!--[\s\S]*notes under hero/, "header names notes under hero");
must(/<!--[\s\S]*crops from 04-home-desk-exact\.png/, "header names lock-PNG crops");
must(/<!--[\s\S]*thumbs strip/, "header names the thumbs strip");
must(/<!--[\s\S]*blue Complete/, "header names blue Complete");
must(/<!--[\s\S]*pixel-faithful Acre GR Corolla desk/, "pixel-faithful phrase stays");
must(/<!--[\s\S]*white hero\|mid\|market/, "white columns stay");
must(/<!--[\s\S]*FIFO oldest home/, "FIFO stays");
must(/<!--[\s\S]*left-rail Incoming\/On-site\/Needs docs\/History/, "left rail stays");
must(/<!--[\s\S]*Thank-you frozen/, "Thank-you stays frozen");
mustNot(/32 up/, "no 32-up KPI copy");
mustNot(/9 hist/, "no 9-hist KPI copy");
mustNot(/8 on-site/, "no 8-on-site KPI copy");
must(/#centerNavHistBtn \{ display:none/, "top hist pills stay killed");

must(/id="acreDesk"/, "Acre desk wrapper");
must(/class="acre-col-hero"/, "hero column");
must(/acre-notes-block/, "notes block on the photo desk");
must(/class="acre-col-hero"[\s\S]*acre-col-mid[\s\S]*acre-notes-block/, "notes span under hero and mid like the lock");
must(/id="centerThumbsNext"/, "fifth-tile peek chevron");
must(/id="centerThumbsPrev"/, "first-tile prev chevron");
must(/id="centerMayaStrip"/, "Maya strip under notes");
must(/function seedPhotoLockGrCorolla\(/, "local white GR fixture seeder");
must(/start-bgs\/gr-corolla\/hero\.jpg/, "sunset/dusk hero crop is the fixture hero");
must(/start-bgs\/gr-corolla/, "fixture URLs point at the GR pack");
must(/openlane:"\/docs\/openlane\.jpg"/, "OpenLane uses the logo, not invented listing thumbs");
mustNot(/openlane:"\/start-bgs\/gr-corolla/, "OpenLane does not use GR walk-around listing thumbs");
must(/Documents<span>7\/7<\/span>/, "photo-lock Documents badge is the 7/7 fixture label");
must(/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/, "scores stay 4-wide MAYA / CLUTCH KILLER / VAUTO / PREDICTED");
must(/clutch:"40100"/, "Clutch Killer is $40.1K like the lock");
must(/competeSource:"Clutch"/, "Clutch source is selected like the lock");
must(/ask:"42000"/, "customer ask is $42,000 like the lock");
must(/prank:"6 of 12"/, "P rank is 6 of 12 like the lock");
must(/LET IT GO - Clutch Killer 40\.1K/, "Maya strip matches the lock");
must(/id="centerDeskHead"/, "title + VIN strip on the photo desk");
must(/id="centerWho"/, "S. Cyr / 0d row under badges");
must(/salesperson="S\. Cyr"/, "salesperson is S. Cyr");
must(/400\*86400000/, "photo-lock stays FIFO oldest");
must(/isPhotoLockItem\(item\) \? 0/, "photo-lock who-row shows 0d");
must(/pair\.appendChild\(photoDocCard\(item, vals, docs, \["eblock"/, "OPENLANE pairs with eBlock");
must(/pair\.appendChild\(photoDocCard\(item, vals, docs, \["mmr"/, "CARFAX pairs with MMR");
mustNot(/#center \.acre-sources \{ display:none/, "source pills stay visible like the lock");
must(/isPhotoLockItem\(item\)/, "photo-lock fixture never POSTs to the live mailer");
must(/acre-range-pair/, "appraisal range stays two boxes");
must(/class="acre-col-mid"/, "mid column");
must(/acre-score-row/, "Maya / Clutch / VAuto / Predicted row");
must(/Clutch Killer/, "Clutch Killer label");
must(/id="centerRankRow"/, "recon / profit / vrank chips");
must(/\["range","Appraisal range"\]/, "appraisal range");
must(/\["compete","Competing offer"\]/, "competing offer");
must(/\["ask","Customer ask"\]/, "customer ask");
must(/id="centerSources"/, "source pills");
must(/CarDoor/, "CarDoor source");
must(/class="acre-col-market"/, "far-right document cards");
must(/CENTER_PHOTO_DOCS/, "photo document cards");
must(/\["vauto","VAUTO"/, "VAUTO card");
must(/\["book","BLACK BOOK"/, "BLACK BOOK card");
must(/\["openlane","OPENLANE"/, "OPENLANE card");
must(/\["eblock","eBlock"/, "eBlock card");
must(/\["carfax","CARFAX"/, "CARFAX card");
must(/\["mmr","MMR"/, "MMR card");
must(/acre-doc-head/, "Documents heading");
must(/function normalizeCenterPhoto\(/, "string photo URLs become hero shots");
must(/parts\.length===1/, "appraisal range is not smashed into one dollar amount");
must(/#center \.center-desk-lane \{ display:none/, "desk HISTORY chip stays off the photo");
must(/#center #centerDocs \{ display:none/, "launch-tool overflow stays off the photo column");
must(/#center #centerWhyDocs/, "WHY slots stay off the photo desk");
must(/function openCenterDetail\(id\)\{[\s\S]{0,420}APP\.centerLane="";/, "opening a car closes the list so the photo desk is full width");
must(/class="acre-thumbs-row"/, "bottom thumbs strip");
must(/#center \.center-thumbs button\{[\s\S]*flex:0 0 23\.1%/, "photo thumbs are four chunky tiles plus a 5th peek");
must(/#center \.center-thumbs button\{[\s\S]*aspect-ratio:16 \/ 10/, "walk-around tiles are landscape frames like the Sept 6 photo");
must(/#center \.center-thumbs img\{ object-fit:contain/, "side shot is a full car, not a cover-crop");
must(/#center \.acre-desk\{[\s\S]{0,360}grid-template-areas:"hero mid market"/, "desktop is hero | mid | market");
must(/grid-template-areas:"hero mid market" "notes notes notes" "thumbs thumbs thumbs"/, "notes sit between the columns and the chunky tiles");
must(/"01","02","03","04","05"/, "walk-around order is 3/4 front, side, rear-3/4, rear-other");
must(/#center \.acre-col-mid\{ grid-area:mid; align-self:start/, "mid column packs instead of stretching airy");
must(/#center\.screen \{[\s\S]{0,220}background:#F5F6F8/, "white Acre page");
mustNot(/#center\.screen \{[\s\S]{0,280}--purple:#1F6B6A/, "teal accent stays gone");
mustNot(/#center\.screen \{[\s\S]{0,220}background:#F3F1EA/, "stone page stays gone");
must(/#center #centerDock\.acre-dock #centerStageBtn \{[\s\S]{0,180}background:#2F6BFF/, "Complete is photo blue");
must(/#centerMayaGo \{ display:none/, "Ask Maya is a field, not a second button");
must(/placeholder="Ask Maya"/, "Ask Maya placeholder");
must(/id="centerStageBtn">Complete</, "Complete");
must(/class="dock acre-dock"/, "Maya + Complete share the dock");
must(/id="centerLanes"[^>]*center-rail|class="center-lanes center-rail"/, "left rail stays");
must(/function oldestReadyCenter\(/, "FIFO oldest home stays");
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

assert.ok(fs.existsSync(path.join(root, "start-bgs/gr-corolla/hero.jpg")), "lot/sunset hero crop exists");
for (let i = 1; i <= 16; i++) {
  const shot = path.join(root, "start-bgs/gr-corolla/" + String(i).padStart(2, "0") + ".jpg");
  assert.ok(fs.existsSync(shot), "white GR pack " + path.basename(shot));
}

console.log("d31a-acre-photo-lock: ok");
