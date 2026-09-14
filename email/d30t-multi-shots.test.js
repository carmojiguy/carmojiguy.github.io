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

must(/id="buildStamp">build d30t</, "footer stamp is d30t");
must(/<!--[\s\S]*build d30t[\s\S]*shots\[\]/, "header stamp is d30t multi-file shots");
must(/id="typeSheet"[\s\S]*build d30t/, "type sheet stamp is d30t");
must(/id="marketDocFile"[^>]*multiple/, "sheet file input accepts multiple files");
must(/accept="application\/pdf,image\/\*,video\/\*/, "sheet accepts PDF, screenshots, and video");
must(/id="marketDocAdd">Add files</, "sheet add button is Add files");
must(/id="marketDocList"/, "sheet lists saved files");
must(/function appendMarketDocShots\(/, "shots helper appends unique http urls");
must(/function uploadMarketDocFiles\(/, "sheet uploads several files");
must(/function paintMarketDocList\(/, "sheet paints saved shots");
must(/uploadMarketDocFiles\(files\)/, "change handler sends the whole FileList");
must(/n\?"Add more files":"Add files"/, "saved files keep Add more, not Replace");
must(/Phone and desk: videos, screenshots, or PDFs/, "V Auto / OpenLane / eBlock accept all types on both");
must(/\.research-add \{[\s\S]{0,180}min-height:32px/, "compact d30q pills stay");
must(/#center \.desk-tool, #center \.research-add \{ min-height:32px/, "Center compact chips stay");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
mustNot(/id="exitRefresh"/, "Refresh stays gone");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");

const sheet = sliceFn("openMarketDocSheet", "readMarketDocFile");
assert.ok(/files saved/.test(sheet), "sheet says files already saved stay");
assert.ok(!/Replace file/.test(sheet), "sheet does not replace saved files");

const upload = sliceFn("uploadMarketDocFiles", "teamWhyHtml");
assert.ok(/applyMarketDocToItem/.test(upload), "each uploaded file is applied to the item");
assert.ok(/shots:\[\{url:got\.url/.test(upload), "each upload is appended as a shot");
assert.ok(/postIncomingFile/.test(upload), "each file POSTs kind:file");

const apply = sliceFn("applyMarketDocToItem", "marketDocShotLabel");
assert.ok(/appendMarketDocShots\(prev\.shots, prev\.url, extra\)/.test(apply), "apply appends onto shots already saved");
assert.ok(/item\.docs\[key\]\.sample=false/.test(apply), "Carfax sample flag still clears");

const persist = sliceFn("persistMarketDocUrls", "slimSharedCenterItem");
assert.ok(/kind:"shot"/.test(persist), "persist walks every data-url shot");

const incomingMerge = sliceFn("applySharedIncoming", "mergeIncomingShared");
assert.ok(/appendMarketDocShots/.test(incomingMerge), "Incoming pull unions shots[]");

const paint = sliceFn("paintPacketDocs", "paintDerivedMarket");
assert.ok(/openMarketDocSheet/.test(paint), "Center pills still open the sheet");
assert.ok(/shotN>1 \? shotN\+" on file"/.test(paint), "pill subtitle shows the saved count");

must(/function marketPackAccept\(/, "Appraise home market accept stays");
must(/id="marketDocFile"[^>]*accept="application\/pdf,image\/\*,video\/\*/, "Center pill sheet accepts pdf/image/video on phone and desk");

const slimSharedHttpUrl = eval("(" + sliceFn("slimSharedHttpUrl", "appendMarketDocShots").replace("function slimSharedHttpUrl", "function") + ")");
const appendMarketDocShots = eval("(" + sliceFn("appendMarketDocShots", "slimSharedDocs").replace("function appendMarketDocShots", "function") + ")");
const slimSharedDocs = eval("(" + sliceFn("slimSharedDocs", "firstMarketDocPayload").replace("function slimSharedDocs", "function") + ")");
const applyMarketDocToItem = eval("(" + sliceFn("applyMarketDocToItem", "marketDocShotLabel").replace("function applyMarketDocToItem", "function") + ")");

const merged = appendMarketDocShots(
  [{ url: "https://example.com/a.jpg" }],
  "https://example.com/a.jpg",
  [{ url: "https://example.com/b.mp4" }, { url: "data:image/jpeg;base64,NO" }],
  "https://example.com/c.pdf"
);
assert.deepStrictEqual(merged.map(function (s) { return s.url; }), [
  "https://example.com/a.jpg",
  "https://example.com/b.mp4",
  "https://example.com/c.pdf"
], "append keeps saved shots and drops data urls");

global.APP = { docs: {} };
const item = applyMarketDocToItem({ id: "c-d30t", sendId: "s-d30t", docs: {} }, "vauto", {
  name: "walk.mp4",
  type: "video/mp4",
  url: "https://blob.example/walk.mp4"
});
assert.equal(item.docs.vauto.shots.length, 1);
assert.equal(item.docs.vauto.url, "https://blob.example/walk.mp4");
applyMarketDocToItem(item, "vauto", {
  name: "guide.pdf",
  type: "application/pdf",
  url: "https://blob.example/guide.pdf"
});
assert.equal(item.docs.vauto.shots.length, 2, "second file appends, does not replace");
assert.equal(item.docs.vauto.shots[0].url, "https://blob.example/walk.mp4");
assert.equal(item.docs.vauto.shots[1].url, "https://blob.example/guide.pdf");
assert.equal(item.docs.vauto.name, "guide.pdf");
applyMarketDocToItem(item, "vauto", {
  name: "walk.mp4",
  type: "video/mp4",
  url: "https://blob.example/walk.mp4"
});
assert.equal(item.docs.vauto.shots.length, 2, "same url is not duplicated");

const slim = slimSharedDocs({
  openlane: {
    have: true,
    url: "https://example.com/ol.mp4",
    shots: [{ url: "https://example.com/ol.jpg" }, "data:image/jpeg;base64,NOPE"]
  }
});
assert.equal(slim.openlane.shots.length, 2);
assert.equal(slimSharedHttpUrl("data:image/jpeg;base64,xxxx"), "");

incoming.resetStore();
incoming.route("POST", {
  kind: "land",
  item: { id: "c-d30t", sendId: "s-d30t", vin: "2T3B1RFVXRC466025", customer: { name: "Chris" } }
});
const first = incoming.route("POST", {
  kind: "file",
  sendId: "s-d30t",
  key: "vauto",
  name: "walk.mp4",
  type: "video/mp4",
  data: "data:video/mp4;base64,AAAA"
});
assert.equal(first.body.ok, true);
assert.ok(/^https:\/\//.test(first.body.url));
assert.equal(incoming.listItems()[0].docs.vauto.shots.length, 1, "first Incoming file seeds shots[]");
const second = incoming.route("POST", {
  kind: "file",
  sendId: "s-d30t",
  key: "vauto",
  name: "screen.jpg",
  type: "image/jpeg",
  data: "data:image/jpeg;base64,BBBB"
});
assert.equal(second.body.ok, true);
assert.notEqual(second.body.url, first.body.url, "each file gets its own blob url");
const afterTwo = incoming.listItems()[0].docs.vauto;
assert.equal(afterTwo.shots.length, 2, "second Incoming file appends into shots[]");
assert.equal(afterTwo.shots[0].url, first.body.url);
assert.equal(afterTwo.shots[1].url, second.body.url);
assert.equal(afterTwo.url, second.body.url, "latest file is the primary url");

incoming.route("POST", {
  kind: "land",
  item: {
    id: "c-d30t",
    sendId: "s-d30t",
    docs: { vauto: { have: true, name: "screen.jpg", type: "image/jpeg", url: second.body.url } }
  }
});
const afterLand = incoming.listItems()[0].docs.vauto;
assert.equal(afterLand.shots.length, 2, "later land without shots keeps both saved files");
assert.equal(afterLand.shots[0].url, first.body.url);
assert.equal(afterLand.shots[1].url, second.body.url);

incoming.route("POST", {
  kind: "land",
  item: {
    id: "c-d30t",
    sendId: "s-d30t",
    docs: {
      vauto: {
        have: true,
        url: second.body.url,
        shots: [{ url: second.body.url }, { url: "https://example.com/extra.pdf" }]
      }
    }
  }
});
const afterAppend = incoming.listItems()[0].docs.vauto;
assert.equal(afterAppend.shots.length, 3, "Incoming land appends a new shot and keeps the old ones");
assert.ok(afterAppend.shots.some(function (s) { return s.url === first.body.url; }));
assert.ok(afterAppend.shots.some(function (s) { return s.url === "https://example.com/extra.pdf"; }));

const third = incoming.route("POST", {
  kind: "file",
  sendId: "s-d30t",
  key: "openlane",
  name: "ol.pdf",
  type: "application/pdf",
  data: "data:application/pdf;base64,CCCC"
});
assert.equal(third.body.ok, true);
assert.equal(incoming.listItems()[0].docs.vauto.shots.length, 3, "another pack does not wipe V Auto shots");
assert.equal(incoming.listItems()[0].docs.openlane.shots.length, 1);

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("d30t-multi-shots: ok");
