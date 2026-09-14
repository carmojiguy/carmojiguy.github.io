#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ws = fs.readFileSync(path.join(root, "web-studio.js"), "utf8");

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

must(/id="btnSendAsIs">Send</, "Send as-is button");
must(/#photos \.dock \{ display:flex; flex-direction:column/, "photos choices stack on mobile");
must(/if\(isWeb\(\) && APP\.role!=="guest" && window\.WebStudio\)\{ WebStudio\.open\("studio"\); return; \}/, "Retouch still opens studio");
must(/startWebsitePost\(\)/, "website post start stays");
must(/openStoryMic\(\)/, "story still opens first");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");

const sendWeb = slice("async function sendWebsitePacket(){", "\nfunction applyMode()");
assert.ok(/disp:"attachment"/.test(sendWeb), "JPEG disp is attachment");
assert.ok(/mime:"image\/jpeg"/.test(sendWeb), "JPEG mime");
assert.ok(/mime:"application\/pdf"/.test(sendWeb), "PDF mime");
assert.ok(/buildPdf\(\)/.test(sendWeb), "listing PDF");
assert.ok(/websiteCopy\(\)/.test(sendWeb), "car description in packet");
assert.ok(/capturedFiles\(\)/.test(sendWeb), "every photo in the set");
assert.ok(/sendFromMe\(/.test(sendWeb), "uses sendFromMe");
assert.ok(/finishGuest\(\)/.test(sendWeb), "thanks after send");
assert.ok(!/cid:/.test(sendWeb), "no CID inline photos");
assert.ok(!/sharePacket\(/.test(sendWeb), "does not call sharePacket");
assert.ok(!/landIncomingPacket\(/.test(sendWeb), "does not land Incoming");

assert.ok(/root\.sendWebsitePacket\(\)/.test(ws), "retouch Post sends the same packet");

const share = slice("async function sharePacket(){", "\nfunction resetAll()");
const kick = slice("function kickShare(){", "\nfunction packetSendId(");
const send = slice("async function sendFromMe(", "\nfunction openEml(");
assert.equal(sha(share), "89ddee81289962020d2a4277f941f60a93d110d42312da85ad94eaeaf8cdb170", "sharePacket SHA locked");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare SHA locked");
assert.equal(sha(send), "a87ba1cb730ce79683938a05a22d839878d60319f35418efb408cabdcf9a9b49", "sendFromMe SHA locked");

must(/#startCenter::before \{[\s\S]*content:"Coming Soon"/, "Coming Soon stamp stays");
must(/\$\("startCenter"\)\.onclick = openCenter/, "Center stays clickable");
must(/id="exitTradeLanes"/, "quiet trade chrome stays");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("d31a-website-photo-send: ok");
