#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const incoming = require(path.join(__dirname, "..", "api", "incoming.js"));

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

must(/id="buildStamp">build d31c</, "footer stamp is d30n");
must(/<!--[\s\S]*build d31c[\s\S]*kind:file carfax/, "header stamp is d30n real Carfax");
must(/id="typeSheet"[\s\S]*build d31c/, "type sheet stamp is d30n");
must(/function realCarfaxDoc\(/, "realCarfaxDoc helper");
must(/function openCarfaxFile\(/, "openCarfaxFile helper");
must(/function openCarfaxControl\(/, "openCarfaxControl helper");
must(/function openCarfaxAdd\(/, "openCarfaxAdd helper");
must(/id="carfaxRecreateAdd">Add official Carfax/, "sample page can add the official file");
must(/if\(typeof openCarfaxFile==="function" && openCarfaxFile/, "recreate yields to a real http url");
must(/k==="carfax"\|\|k==="carfax_docs"\|\|k==="carfax_pdf"/, "marketDocKey maps carfax");
must(/item\.docs\[key\]\.sample=false/, "upload clears the sample flag");
must(/item\.docs\[key\]\.pending=false/, "upload clears the pending flag");
must(/openCarfaxControl\(live, store\)/, "huge Carfax card uses the real-file control");
must(/kind==="carfax"[\s\S]{0,180}openCarfaxControl/, "Carfax square uses the real-file control");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
must(/function applyCenterLaneMove\(/, "d30h lane move stays");
must(/function openMarketDocSheet\(/, "d30i market pills stay");
must(/function matchStoryTrim\(/, "d30k spoken trim stays");
must(/function unlockCenterItem\(/, "d30l Unlock stays");
mustNot(/id="exitRefresh"/, "Refresh stays gone");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");
mustNot(/desktop bulk photo drop|ondrop=.*photos/, "do not touch desktop bulk photo drop");

const control = sliceFn("openCarfaxControl", "openCarfaxPaste");
assert.ok(/openCarfaxFile\(item, store\)/.test(control), "control opens the real file first");
assert.ok(/openCarfaxRecreate/.test(control), "sample recreate stays when no http url");
assert.ok(/openCarfaxAdd/.test(control), "control can add when no sample path");

const recreate = sliceFn("openCarfaxRecreate", "printCarfaxRecreatePdf");
assert.ok(/openCarfaxFile\(item, APP\.docs\)/.test(recreate), "openCarfaxRecreate checks the real url first");
assert.ok(/carfaxRecreateAdd/.test(recreate), "recreate wires Add official");

const storeFn = sliceFn("storeRav4CarfaxDoc", "openCarfaxRecreate");
assert.ok(/realCarfaxDoc\(\{carfax:prevItem\}\)/.test(storeFn), "sample store will not overwrite a real item url");
assert.ok(/realCarfaxDoc\(\{carfax:prevApp\}\)/.test(storeFn), "sample store will not overwrite a real APP url");

const enrich = sliceFn("enrichRav4OnsiteFinal", "centerStore");
assert.ok(/slimSharedHttpUrl\(cf\.url\)/.test(enrich), "RAV4 seed keeps a real http Carfax url");
assert.ok(/sample:false/.test(enrich), "real url clears sample on the RAV4 seed");

const slimSharedHttpUrl = eval("(" + html.match(/function slimSharedHttpUrl\(v\)\{[\s\S]*?\n\}/)[0].replace("function slimSharedHttpUrl", "function") + ")");
const realCarfaxDoc = eval("(" + html.match(/function realCarfaxDoc\(docs\)\{[\s\S]*?\n\}/)[0].replace("function realCarfaxDoc", "function") + ")");
const marketDocKey = eval("(" + html.match(/function marketDocKey\(id\)\{[\s\S]*?\n\}/)[0].replace("function marketDocKey", "function") + ")");

assert.equal(slimSharedHttpUrl("docs/rav4-2T3B1RFVXRC466025-carfax-sample.pdf"), "", "sample path is not http");
assert.equal(realCarfaxDoc({ carfax: { have: true, url: "docs/rav4-2T3B1RFVXRC466025-carfax-sample.pdf", sample: true } }), null, "sample recreate is not a real file");
assert.equal(realCarfaxDoc({ carfax: { have: false } }), null);
const real = realCarfaxDoc({
  carfax: { have: true, url: "https://7codzfkcbtucfujs.public.blob.vercel-storage.com/docs/s1/carfax/report.pdf", type: "application/pdf", name: "report.pdf" }
});
assert.ok(real);
assert.equal(real.url, "https://7codzfkcbtucfujs.public.blob.vercel-storage.com/docs/s1/carfax/report.pdf");
assert.equal(marketDocKey("carfax"), "carfax");
assert.equal(marketDocKey("carfax_docs"), "carfax");

const views = [];
const recreates = [];
const sheets = [];
function viewMarketDocUrl(url, type, title) { views.push({ url: url, type: type, title: title }); }
function openCarfaxRecreate() { recreates.push(true); }
function openMarketDocSheet(item, spec) { sheets.push({ id: item && item.id, key: spec && spec.pack }); }
function openMarketTab() {}
function copyVin() {}
function isRav4OnsiteDemo(item) { return !!(item && /2T3B1RFVXRC466025/i.test(String(item.vin || ""))); }
function currentVin() { return ""; }
const APP = { docs: {} };
const gatherCarfaxDocs = eval("(" + html.match(/function gatherCarfaxDocs\(item, store\)\{[\s\S]*?\n\}/)[0].replace("function gatherCarfaxDocs", "function") + ")");
const openCarfaxFile = eval("(" + html.match(/function openCarfaxFile\(item, store\)\{[\s\S]*?\n\}/)[0].replace("function openCarfaxFile", "function") + ")");
const openCarfaxAdd = eval("(" + html.match(/function openCarfaxAdd\(item\)\{[\s\S]*?\n\}/)[0].replace("function openCarfaxAdd", "function") + ")");
const openCarfaxControl = eval("(" + sliceFn("openCarfaxControl", "openCarfaxPaste").replace("function openCarfaxControl", "function") + ")");

const item = {
  id: "c-d30n",
  sendId: "s-d30n",
  vin: "2T3B1RFVXRC466025",
  docs: { carfax: { have: true, url: "https://example.com/official-carfax.pdf", type: "application/pdf", name: "official-carfax.pdf" } }
};
openCarfaxControl(item, item.docs);
assert.equal(views.length, 1, "real url opens the uploaded file");
assert.equal(views[0].url, "https://example.com/official-carfax.pdf");
assert.equal(recreates.length, 0, "recreate does not win when a real url exists");
assert.equal(sheets.length, 0, "sheet does not win when a real url exists");

views.length = 0;
const pending = { id: "c-d30n-p", vin: "2T3B1RFVXRC466025", docs: { carfax: { have: true, url: "docs/rav4-2T3B1RFVXRC466025-carfax-sample.pdf", sample: true, pending: true } } };
openCarfaxControl(pending, pending.docs);
assert.equal(views.length, 0, "sample path does not open as the real file");
assert.equal(recreates.length, 1, "sample/pending still opens the recreate");

APP.docs = { carfax: { have: true, url: "https://example.com/keep.pdf", type: "application/pdf" } };
const RAV4_CARFAX_SAMPLE = "docs/rav4-2T3B1RFVXRC466025-carfax-sample.pdf";
function patchCenter() {}
const storeRav4CarfaxDoc = eval("(" + sliceFn("storeRav4CarfaxDoc", "openCarfaxRecreate").replace("function storeRav4CarfaxDoc", "function") + ")");
const kept = storeRav4CarfaxDoc({ docs: { carfax: { have: true, url: "https://example.com/keep.pdf" } } });
assert.equal(kept.url, "https://example.com/keep.pdf", "sample store keeps the real url");
assert.equal(APP.docs.carfax.url, "https://example.com/keep.pdf", "APP sample store does not clobber the real url");

incoming.resetStore();
incoming.route("POST", {
  kind: "land",
  item: { id: "c-d30n", sendId: "s-d30n", vin: "2T3B1RFVXRC466025", customer: { name: "Chris" } }
});
const badKey = incoming.route("POST", { kind: "file", sendId: "s-d30n", key: "mmr", name: "x.pdf", type: "application/pdf", data: "data:application/pdf;base64,AAAA" });
assert.equal(badKey.body.ok, false);
assert.equal(badKey.body.error, "key");
const file = incoming.route("POST", {
  kind: "file",
  sendId: "s-d30n",
  key: "carfax",
  name: "official-carfax.pdf",
  type: "application/pdf",
  data: "data:application/pdf;base64,AAAA"
});
assert.equal(file.body.ok, true);
assert.ok(/^https:\/\//.test(file.body.url), "kind:file carfax returns an http url");
assert.equal(file.body.key, "carfax");
incoming.route("POST", {
  kind: "land",
  item: {
    id: "c-d30n",
    sendId: "s-d30n",
    docs: { carfax: { have: true, name: "official-carfax.pdf", type: "application/pdf", url: file.body.url } }
  }
});
assert.equal(incoming.listItems()[0].docs.carfax.url, file.body.url);
incoming.route("POST", {
  kind: "land",
  item: {
    id: "c-d30n",
    sendId: "s-d30n",
    docs: { carfax: { have: true, name: "official-carfax.pdf", type: "application/pdf" } }
  }
});
assert.equal(incoming.listItems()[0].docs.carfax.url, file.body.url, "later land does not wipe carfax url");
assert.equal(incoming.listItems().length, 1, "same sendId stays one card");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("d30n-carfax-real: ok");
