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

must(/id="buildStamp">build d30s</, "footer stamp is d30i");
must(/<!--[\s\S]*build d30s[\s\S]*kind:file/, "header stamp is d30i file pills");
must(/id="marketDocSheet"/, "per-doc sheet exists");
must(/id="marketDocView">View/, "sheet has View");
must(/id="marketDocAdd">Add files</, "sheet has Add files");
must(/id="marketDocFile"/, "sheet has a file input");
must(/function openMarketDocSheet\(/, "pill opens the per-doc sheet");
must(/function uploadMarketDocFile\(/, "sheet uploads the file");
must(/function postIncomingFile\(/, "Center POSTs kind:file");
must(/kind:"file"/, "Incoming file kind is explicit");
must(/function viewMarketDocUrl\(/, "saved url opens in the viewer");
must(/openViewer\("vid"/, "video url plays");
must(/openViewer\("pdf"/, "pdf url opens");
must(/item && typeof openMarketDocSheet/, "Center pills open the sheet");
must(/url:url/, "slimCenterDocs keeps url");
must(/got\.url/, "packet have treats url as present");
must(/d\.have \|\| d\.data \|\| d\.extract \|\| d\.preview \|\| d\.url/, "shared have-count treats url as present");
must(/slot\.url=old\.url/, "Incoming pull keeps a local docs.url when the echo is flags-only");
must(/pdf\.classList\.remove\("hide"\)/, "PDF viewer unhides the iframe");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
mustNot(/id="exitRefresh"/, "Refresh stays gone");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");

const paint = sliceFn("paintPacketDocs", "paintDerivedMarket");
assert.ok(/openMarketDocSheet/.test(paint), "Center add pills open the doc sheet");
assert.ok(/pickPhotoLibrary/.test(paint), "Appraise home still picks files when no Center item");

const kick = sliceFn("kickShare", "packetSendId");
assert.ok(!/uploadMarketDocFile/.test(kick), "Send does not run the pill uploader");
assert.ok(!/openMarketDocSheet/.test(kick), "Send does not open the doc sheet");

const slimSharedHttpUrl = eval("(" + html.match(/function slimSharedHttpUrl\(v\)\{[\s\S]*?\n\}/)[0].replace("function slimSharedHttpUrl", "function") + ")");
const appendMarketDocShots = eval("(" + html.slice(html.indexOf("function appendMarketDocShots("), html.indexOf("\nfunction slimSharedDocs(")).replace("function appendMarketDocShots", "function") + ")");
const slimSharedDocs = eval("(" + html.slice(html.indexOf("function slimSharedDocs("), html.indexOf("\nfunction firstMarketDocPayload(")).replace("function slimSharedDocs", "function") + ")");
const slim = slimSharedDocs({
  vauto: {
    have: true,
    name: "walk.mp4",
    type: "video/mp4",
    url: "https://7codzfkcbtucfujs.public.blob.vercel-storage.com/docs/s1/vauto/walk.mp4",
    data: "data:video/mp4;base64," + new Array(2000).join("A"),
    preview: "data:image/jpeg;base64,NOPE"
  }
});
assert.equal(slim.vauto.url, "https://7codzfkcbtucfujs.public.blob.vercel-storage.com/docs/s1/vauto/walk.mp4");
assert.equal(slim.vauto.data, undefined, "base64 stays off Incoming JSON");
assert.equal(slim.vauto.preview, undefined, "data preview is not slimed onto Incoming");
assert.equal(slimSharedHttpUrl("data:image/jpeg;base64,xxxx"), "");

incoming.resetStore();
incoming.route("POST", {
  kind: "land",
  item: { id: "c-d30i", sendId: "s-d30i", vin: "2T3B1RFVXRC466025", customer: { name: "Chris" } }
});
const empty = incoming.route("POST", { kind: "file" });
assert.equal(empty.body.ok, false);
assert.equal(empty.body.error, "sendId");
const file = incoming.route("POST", {
  kind: "file",
  sendId: "s-d30i",
  key: "vauto",
  name: "walk.mp4",
  type: "video/mp4",
  data: "data:video/mp4;base64,AAAA"
});
assert.equal(file.body.ok, true);
assert.ok(/^https:\/\//.test(file.body.url), "kind:file returns an http url");
assert.equal(file.body.key, "vauto");
incoming.route("POST", {
  kind: "land",
  item: {
    id: "c-d30i",
    sendId: "s-d30i",
    docs: { vauto: { have: true, name: "walk.mp4", type: "video/mp4", url: file.body.url } }
  }
});
assert.equal(incoming.listItems()[0].docs.vauto.url, file.body.url);
incoming.route("POST", {
  kind: "land",
  item: {
    id: "c-d30i",
    sendId: "s-d30i",
    docs: { vauto: { have: true, name: "walk.mp4", type: "video/mp4" } }
  }
});
assert.equal(incoming.listItems()[0].docs.vauto.url, file.body.url, "later land does not wipe docs.url");
assert.equal(incoming.listItems().length, 1, "same sendId stays one card");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("d30i-doc-pills: ok");
