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

must(/<!--[\s\S]*HOLD #33\/#46/, "HOLD #33/#46 stays");
must(/<!--[\s\S]*Off Acre #73 photo lock remix/, "Acre desk photo lock is off-limits");
must(/<!--[\s\S]*Thank-you frozen/, "Thank-you stays frozen in the stamp");
must(/<!--[\s\S]*911 Center click\/nav: #start hides when not \.on/, "stamp names the Home hide fix");
must(/id="buildStamp">build d31a</, "footer stamp stays d31a");

must(/\.screen:not\(\.on\) \{ display:none !important; \}/, "any screen without .on is forced hidden");
must(/#start\.screen\.start\.on \{/, "desktop Home display:block is gated on .on");
must(/#start\.screen\.start:not\(\.on\) \{[\s\S]{0,80}display:none !important/, "desktop Home without .on is hidden");
must(/#start:not\(\.on\) \.start-dock/, "startDock cannot receive taps when Home is off");
mustNot(/#start\.screen\.start \{\s*display:block/, "Home display:block no longer fires without .on");

must(/function leftRailWanted\(\)\{[\s\S]{0,220}centerSplitLayout/, "CA left rail is desktop split only");
must(/caDrawerCollapsed:true, caPane:"none"/, "CA drawer starts collapsed");
must(/#center\.screen\.ca-on \.ca-drawer:not\(\.hide\)\{ display:flex/, "visible CA drawer is :not(.hide), not a blanket display:flex");
must(/#center\.screen\.ca-on \.ca-drawer\.hide[\s\S]{0,120}display:none !important/, "ca-on display:flex cannot beat .hide");
must(/#center\.screen\.ca-on \.ca-drawer\.hide[\s\S]{0,160}pointer-events:none !important/, "hidden CA drawer is not a hit layer");
must(/#center\.screen\.ca-on\.ca-collapsed \.ca-drawer:not\(\.hide\)\{ pointer-events:none; \}/, "collapsed drawer is not a transparent hit sheet");
must(/#center\.screen\.ca-on\.ca-collapsed \.ca-drawer-toggle[\s\S]{0,80}pointer-events:auto/, "collapsed toggle still taps");
must(/class="appt-km"/, "booked rows still show kilometres");
must(/\.appt-row \.appt-body \.appt-km/, "km sits under YMM on booked tiles");
mustNot(/position:fixed; left:0; top:0; bottom:0; width:min\(360px,90vw\)/, "phone CA drawer is not a full-bleed overlay");
must(/@media \(max-width:767px\)\{[\s\S]{0,900}#center\.screen\.ca-on \.ca-drawer[\s\S]{0,280}pointer-events:none !important/, "phone CA drawer is not a hit layer");
must(/--qs-canvas:#F7F8FA/, "Center canvas is Snow Signal snow");
must(/#center \.acre-desk\{[\s\S]{0,220}grid-template-areas:"hero mid market"/, "Acre columns stay locked");
must(/--qs-canvas:#F7F8FA/, "Home overlay canvas is snow when Home is showing");
must(/\.start-actions \.pill\.purple \{ background:#2F5B8A/, "Appraise stays steel");
must(/function staffPerms\(\)\{ return \{trade:true, appraise:true, website:true, center:true, admin:false, ca:true\}; \}/, "staffPerms stays On except Users");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
must(/id="startCenter"[\s\S]*Appraisal Center/, "Center pill stays");
must(/id="startAppraise">Appraise vehicle</, "Appraise pill stays");
must(/id="startWebsite">Post vehicle to website</, "Website pill stays");
must(/id="startTrade">Send trade-in link</, "trade-in pill stays");
must(/id="startUsers">Users</, "Users pill stays");
must(/id="centerInboxBtn"/, "Incoming stays");
must(/id="centerOnsiteBtn"/, "On-site stays");
must(/id="centerNeedsBtn"/, "Needs docs stays");
must(/id="centerHistoryBtn"/, "History stays");
must(/id="exitHome">Home/, "Home chrome stays");
must(/id="exitBack">Back/, "Back chrome stays");
must(/id="exitClose"/, "Close chrome stays");

must(/document\.querySelectorAll\("\.screen"\)\.forEach\(function\(n\)\{ n\.classList\.remove\("on"\); \}\)/, "show() still turns off every screen before turning one on");

const share = slice("async function sharePacket(){", "\nfunction resetAll()");
const kick = slice("function kickShare(){", "\nfunction packetSendId(");
const send = slice("async function sendFromMe(", "\nfunction openEml(");
assert.equal(sha(share), "89ddee81289962020d2a4277f941f60a93d110d42312da85ad94eaeaf8cdb170", "sharePacket is byte-identical");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare is byte-identical");
assert.equal(sha(send), "a87ba1cb730ce79683938a05a22d839878d60319f35418efb408cabdcf9a9b49", "sendFromMe is byte-identical");

must(/#login \.login-card\{[\s\S]*?backdrop-filter:blur\(22px\)/, "login card is frosted glass");
must(/#start\.screen\.start\.on\{display:block\}/, "start.on lock remains at overlay end");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("center-click-nav: ok");
