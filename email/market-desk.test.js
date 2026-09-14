#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");
const vm = require("vm");

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

must(/id="buildStamp">build d30q</, "footer stamp is build d30q");
must(/id="typeSheet"[\s\S]*build d30/, "type sheet stamp is build d30");
must(/PACKET_LAUNCH/, "research tool launchers");
must(/PACKET_ADDS/, "three add-doc pills");
must(/V Auto documents/, "V Auto documents pill");
must(/OpenLane documents/, "OpenLane documents pill");
must(/eBlock documents/, "eBlock documents pill");
must(/research-adds/, "add pills share one row");
must(/research-tools/, "tool buttons share a 2x2");
must(/\.research-tools \{ display:grid; grid-template-columns:1fr 1fr/, "tools are 2 across: V Auto | Carfax then OpenLane | eBlock");
must(/\.research-adds \{ display:grid; grid-template-columns:1fr 1fr 1fr/, "three smaller document pills");
must(/docs\/carfax\.jpg/, "standing Carfax guy logo is restored");
must(/desk-tool\.carfax-sq/, "Carfax tile uses the standing-guy square");
must(/object-fit:contain/, "Carfax guy is not cropped into a wordmark");
must(/\{id:"vauto"[\s\S]{0,180}\{id:"carfax"[\s\S]{0,180}\{id:"openlane"[\s\S]{0,180}\{id:"eblock"/, "launch order is V Auto, Carfax, OpenLane, eBlock");
must(/Canadian Black Book/, "Canadian Black Book card");
must(/function blackBookCard\(/, "Black Book card painter");
must(/Average · before km|BEFORE kilometre/, "uses average before km adjust");
must(/function applyVautoDerived\(/, "V Auto pack derives BB / MMR / Carfax / offer");
must(/no separate MMR upload/, "MMR is extracted, not uploaded");
must(/function vautoOfferCard\(/, "V Auto predicted offer pill");
must(/95% of market/, "purchase number shows 95% of market");
must(/\$3,500 profit/, "$3500 profit is on the offer");
must(/\$1,200 recon/, "$1200 recon is on the offer");
must(/function vautoBuyFromMarket\(/, "buy number is 95% minus profit minus recon");
must(/minus \$3,500 profit minus \$1,200 recon|−  \$3,500 profit/, "buy math is written on the card");
must(/function vautoCompCard\(/, "V Auto competitive set is its own card");
must(/function eblockOfferCard\(/, "eBlock predicted offer is its own card");
must(/function carfaxCard\(/, "Carfax data card from V Auto");
must(/function openVautoOfferPdf\(/, "offer tap builds a PDF");
must(/function openScrollPdf\(/, "mobile PDF fills the screen and scrolls");
must(/pdf-fill/, "scrollable full-screen PDF surface");
must(/function openlaneOfferCard\(/, "OpenLane predicted offer");
must(/function openlaneCompCard\(/, "OpenLane competitive set document");
must(/function eblockAvgCard\(/, "eBlock average synopsis");
must(/listings data, not video/, "eBlock is listings, not video");
must(/Created document — not the video/, "OpenLane comps are a document");
must(/never the raw video|not the raw video|never the raw recording/, "raw video is not the deliverable");
must(/function deriveMarketPack\(/, "derive starts as soon as uploads land");
must(/Appraisal started/, "adding docs starts the appraisal");
must(/provision\.vauto\.app\.coxautoinc\.com/, "V Auto URL is Provision");
must(/go-vauto\.html\?u=/, "V Auto uses the same-origin hop");
must(/function openMarketTab\(/, "opens a full tab");
must(/www\.carfax\.ca/, "Carfax launcher opens live Carfax");
must(/open:"carfax"/, "Carfax is a launcher, not an upload tile");
mustNot(/Default\.aspx\?new=true/, "broken www2 ASPX is gone from the desk");

(function testVautoOpenIsFullTab() {
  const a = html.indexOf("function openMarketSite(");
  const b = html.indexOf("\nfunction openVauto(", a);
  assert.ok(a > 0 && b > a, "openMarketSite found");
  const src = html.slice(a, b);
  assert.ok(/openMarketTab\(hop\)/.test(src), "V Auto uses a full-tab hop");
  assert.ok(!/window\.open\(url, "_blank", "noopener"\)/.test(src), "openMarketSite does not use a windowFeatures popup");
})();
must(/vauto_docs/, "V Auto pack id");
must(/isDesk\(\)[\s\S]{0,180}application\/pdf/, "V Auto desk accept is PDFs");
must(/function marketPackAccept\(/, "pack accept differs by source / desk");
must(/typeof missingMarketDocs==="function"\) return missingMarketDocs\(docs\)/, "Needs-docs still uses MARKET_DOC_REQ");

mustNot(/raw video as the viewed artifact/, "no raw-video copy leftover");

const share = slice("async function sharePacket(){", "\nfunction resetAll()");
const kick = slice("function kickShare(){", "\nfunction packetSendId(");
const send = slice("async function sendFromMe(", "\nfunction openEml(");
assert.equal(sha(share), "89ddee81289962020d2a4277f941f60a93d110d42312da85ad94eaeaf8cdb170", "sharePacket is byte-identical to d25s");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare is byte-identical to d25s");
assert.equal(sha(send), "a87ba1cb730ce79683938a05a22d839878d60319f35418efb408cabdcf9a9b49", "sendFromMe is byte-identical to d25s");
assert.ok(html.indexOf("function finishGuest(){") > 0, "finishGuest stays");
assert.ok(html.indexOf("function restoreSend(){") > 0, "restoreSend stays");

const hop = fs.readFileSync(path.join(root, "go-vauto.html"), "utf8");
assert.ok(/provision\.vauto\.app\.coxautoinc\.com/.test(hop), "bounce defaults to Provision");
assert.ok(!/Default\.aspx\?new=true/.test(hop) || /provision/.test(hop), "bounce is not locked to broken www2 ASPX");

const from = html.indexOf("function moneyNum(");
const to = html.indexOf("function demoExtractFor(", from);
assert.ok(from > 0 && to > from, "market helpers extractable");
const sandbox = {
  APP: { year: "2021", km: "92000", vin: "1FTEW1EP4JFA20331", make: "Ford", model: "F-150" },
  currentVin: function () { return "1FTEW1EP4JFA20331"; }
};
vm.createContext(sandbox);
vm.runInContext(
  html.slice(from, to) +
  "\nthis.moneyFmt=moneyFmt;this.seedMarketNumbers=seedMarketNumbers;this.round50=round50;this.vautoBuyFromMarket=vautoBuyFromMarket;",
  sandbox
);
const seed = sandbox.seedMarketNumbers();
assert.ok(seed.average > 0 && seed.rough < seed.average && seed.average < seed.clean, "CBB ladder is rough < average < clean");
assert.ok(seed.extraClean > seed.clean, "extra clean is the top book");
assert.equal(seed.offer, sandbox.vautoBuyFromMarket(seed.market).offer, "buy is 95% of market minus $3500 minus $1200");
assert.equal(seed.offer, sandbox.round50(sandbox.round50(seed.market * 0.95) - 3500 - 1200), "buy math is explicit");
assert.equal(seed.profit, 3500, "profit assumption is $3500");
assert.equal(seed.recon, 1200, "recon assumption is $1200");
assert.ok(seed.average !== seed.adjustedAverage || seed.kmAdjust === 0, "average before km is distinct when there is a km adjust");
assert.equal(sandbox.moneyFmt(18400), "$18,400", "Canadian money format");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("market-desk: ok");
