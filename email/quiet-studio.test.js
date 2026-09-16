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

must(/<!--[\s\S]*Quiet Studio cool stone #F4F5F7 \+ sage #3D5A4C/, "stamp names Quiet Studio");
must(/<!--[\s\S]*Paper Desk abandoned/, "Paper Desk abandoned");
must(/<!--[\s\S]*911 Center click\/nav: #start hides when not \.on/, "start.on guard stays named");
must(/<!--[\s\S]*Thank-you frozen/, "Thank-you frozen");
must(/<!--[\s\S]*Off Acre #73 photo lock remix/, "Off Acre #73");
must(/id="buildStamp">build d31a</, "build stamp");

must(/\.screen:not\(\.on\) \{ display:none !important; \}/, "screens without .on stay hidden");
must(/#start\.screen\.start\.on \{/, "Home display:block is gated on .on");
must(/#start\.screen\.start:not\(\.on\) \{[\s\S]{0,80}display:none !important/, "Home without .on is hidden");
must(/#start:not\(\.on\) \.start-dock/, "startDock cannot receive taps when Home is off");
mustNot(/#start\.screen\.start \{\s*display:block/, "never display:block Home without .on");

must(/#start\.start \{[\s\S]*?background:#F4F5F7/, "Home canvas");
must(/#center\.screen \{[\s\S]{0,220}background:#F4F5F7/, "Center canvas");
must(/#users \{\s*background:#F4F5F7;/, "Users canvas");
must(/\.start-actions \.pill\.purple \{ background:#3D5A4C/, "Appraise sage");
must(/#center #centerDock\.acre-dock #centerStageBtn \{[\s\S]*?background:#3D5A4C/, "Complete sage");
must(/#centerLanes \.lane-pill\.inbox \{ background:#EEF0F3/, "Incoming muted status");
must(/#centerLanes \.lane-pill\.onsite \{ background:#E8F0EB/, "On-site muted status");
must(/#start \.start-bg,\s*#start \.start-veil \{ display:none !important/, "no car-hero wallpaper on staff Home");

mustNot(/--home-cream:#F5F3ED/, "no Paper Desk cream");
mustNot(/#users \{\s*background:#F5F3ED;/, "Users is not Paper Desk cream");
mustNot(/#centerLanes \.lane-pill\.inbox \{ background:#2A6F8F/, "no loud Incoming teal");
mustNot(/#centerLanes\.center-rail[\s\S]{0,180}background:#16181D/, "no dark Acre rail");

must(/id="startAppraise">Appraise vehicle</, "Appraise click-path");
must(/id="startCenter"[\s\S]*Appraisal Center/, "Center click-path");
must(/id="startWebsite">Post vehicle to website</, "Website click-path");
must(/id="startTrade">Send trade-in link/, "Trade click-path");
must(/id="startUsers">Users/, "Users click-path");
must(/id="centerInboxBtn"/, "Incoming");
must(/id="centerOnsiteBtn"/, "On-site");
must(/id="centerNeedsBtn"/, "Needs docs");
must(/id="centerHistoryBtn"/, "History");
must(/id="caDrawer"/, "CA drawer stays");
must(/id="acqDrawerToggle"/, "Acquisitions toggle stays");

must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
const share = slice("async function sharePacket(){", "\nfunction resetAll()");
const kick = slice("function kickShare(){", "\nfunction packetSendId(");
const send = slice("async function sendFromMe(", "\nfunction openEml(");
assert.equal(sha(share), "89ddee81289962020d2a4277f941f60a93d110d42312da85ad94eaeaf8cdb170", "sharePacket frozen");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare frozen");
assert.equal(sha(send), "a87ba1cb730ce79683938a05a22d839878d60319f35418efb408cabdcf9a9b49", "sendFromMe frozen");

const loginChrome = slice(".login-hero {\n  position:absolute; left:22px;", ".gbtn {");
assert.equal(sha(loginChrome), "dd45835ca4c2dd2758f17ce79401708ad0b45ce63b6aa4166ba9a5d50405215c", "login CSS frozen");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("quiet-studio: ok");
