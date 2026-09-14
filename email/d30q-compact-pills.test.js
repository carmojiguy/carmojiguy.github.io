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

must(/id="buildStamp">build d30s</, "footer stamp is d30s");
must(/<!--[\s\S]*build d30s[\s\S]*compact V Auto \/ Carfax \/ OpenLane \/ eBlock chips/, "header stamp is d30s compact chips");
must(/id="typeSheet"[\s\S]*build d30s/, "type sheet stamp is d30s");

must(/\.research-tools \{ display:grid; grid-template-columns:1fr 1fr/, "launch chips stay 2 across");
must(/\.research-adds \{ display:grid; grid-template-columns:1fr 1fr 1fr/, "three add pills stay one row");
must(/desk-tool\.carfax-sq/, "Carfax square selector stays");
must(/object-fit:contain/, "Carfax guy is not cropped");
must(/\.desk-tool \{[\s\S]{0,220}min-height:32px/, "launch / Carfax chips are compact");
must(/\.desk-tool-art \{[\s\S]{0,160}min-height:28px/, "Carfax / brand art is a 28px chip mark");
must(/\.research-add \{[\s\S]{0,180}min-height:32px/, "add pills are compact chips");
must(/#center \.desk-tool, #center \.research-add \{ min-height:32px/, "Center detail locks the same compact chips");
must(/#center \.desk-tool-art \{ min-height:28px/, "Center Carfax mark stays 28px");
must(/border-radius:999px/, "chips are pill-shaped");

mustNot(/\.desk-tool-art \{[^}]*min-height:110px/, "desk-tool-art is no longer a 110px card");
mustNot(/\.research-add \{[^}]*min-height:68px/, "research-add is no longer a 68px card");
mustNot(/\.desk-tool \{[^}]*border-radius:20px/, "desk-tool is no longer a giant card radius");

must(/function openMarketDocSheet\(/, "add pills still open the doc sheet");
must(/function openCarfaxControl\(/, "Carfax square stays tappable");
must(/item && typeof openMarketDocSheet/, "Center add pills stay tappable");
must(/kind==="carfax"[\s\S]{0,180}openCarfaxControl/, "Carfax square still add/views");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
must(/function applyCenterLaneMove\(/, "lane dropdown stays");
must(/function unlockCenterItem\(/, "Unlock stays");
must(/function paintCenterVals\(/, "metrics strip painter stays");
must(/From V Auto · appraisal started/, "FROM V AUTO hide copy stays");
mustNot(/id="exitRefresh"/, "Refresh stays gone");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");

const paint = sliceFn("paintPacketDocs", "paintDerivedMarket");
assert.ok(/openMarketDocSheet/.test(paint), "Center add pills still open the sheet");
assert.ok(/openMarketSite/.test(paint), "launch chips still open sites / Carfax control");
assert.ok(/pickPhotoLibrary/.test(paint), "Appraise home still picks files when no Center item");

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

console.log("d30q-compact-pills: ok");
