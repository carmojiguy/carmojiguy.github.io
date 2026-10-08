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

must(/<!--[\s\S]*Shawn HOME dock: Snow Signal Lot Desk cutting-edge canvas #F7F8FA \+ steel #2F5B8A/, "stamp names the Snow Signal home dock");
must(/<!--[\s\S]*Paper Desk abandoned/, "Paper Desk is abandoned in the stamp");
must(/<!--[\s\S]*HOLD #33\/#46/, "HOLD #33/#46 stays");
must(/<!--[\s\S]*Off Acre #73 photo lock remix/, "Acre desk photo lock remix stays named");
must(/<!--[\s\S]*Thank-you frozen/, "Thank-you stays frozen in the stamp");
must(/<!--[\s\S]*pixel-faithful Acre GR Corolla desk/, "Acre pixel lock stamp stays");
must(/id="buildStamp">build d31a</, "footer stamp stays d31a");

must(/id="startDock"/, "staff start dock stays");
must(/id="startBrand"/, "home brand chrome stays");
must(/class="start-desk-head"/, "desktop desk head lives in the dock card");
must(/id="startAppraise">Appraise vehicle</, "Appraise label stays");
must(/Lot floor ops · FIFO desk ready/, "home subtitle stays");
must(/id="startStatOnsiteBtn"[\s\S]{0,180}Appraisal requested/, "home count is Appraisal requested");
must(/if\(\$\("startStatOnsite"\)\) \$\("startStatOnsite"\)\.textContent=String\(n\.onsite\)/, "Appraisal requested count is still the on-site count");
must(/\$\("startStatOnsiteBtn"\)\.onclick = function\(\)\{ openCenterLane\("onsite"\); \}/, "Appraisal requested opens the on-site list");
const startStats = html.slice(html.indexOf('id="startStats"'), html.indexOf('id="startX"'));
assert.ok(startStats.indexOf("startStatInbox") < 0, "Incoming box is off this home display");
assert.ok(startStats.indexOf("startStatNeeds") < 0, "Needs docs box is off this home display");
assert.ok(startStats.indexOf(">Incoming<") < 0, "Incoming label is off this home display");
assert.ok(startStats.indexOf(">Needs docs<") < 0, "Needs docs label is off this home display");
must(/id="centerInboxBtn"/, "Center Incoming lane stays");
must(/id="centerNeedsBtn"/, "Center Needs docs lane stays");
must(/id="centerOnsiteBtn"/, "Center On-site lane stays");
must(/id="startCenter"[\s\S]*Appraisal Center/, "Center pill stays");
must(/id="startWebsite">Post vehicle to website</, "Website pill stays");
must(/id="startTrade">Send trade-in link</, "trade-in pill stays");
must(/id="startUsers">Users</, "Users pill stays");
must(/function paintStartHello\(/, "home greeting paint stays chrome-only");

mustNot(/#start:has\(#startDock:not\(\.hide\)\) \.start-bg/, "car photo is not cropped above a footer strip");
mustNot(/border-top:1px solid rgba\(0,164,226/, "no cyan/blue dock strip");
mustNot(/#07101c/, "no navy footer bar");
mustNot(/linear-gradient\(180deg, rgba\(7,16,32,\.96\)/, "no dark blue dock wash");
mustNot(/--home-cream:#F5F3ED/, "Paper Desk cream token is gone");
mustNot(/--home-slate:#3E5C54/, "Paper Desk slate token is gone");
mustNot(/--home-terra:#B45C3C/, "Paper Desk terracotta token is gone");

must(/--qs-canvas:#F7F8FA/, "home canvas is Snow Signal snow");
must(/--qs-ink:#12141A/, "ink stays Snow Signal");
must(/--qs-accent-soft:#E8F0F7/, "wash stays light");
must(/--qs-accent-fg:#FFFFFF/, "accent buttons keep white text");
must(/class="gm-logo" src="\/icons\/gm-logo\.png/, "G&M wordmark is in the header");
must(/--qs-accent:#C8081B/, "accent is G&M red");
must(/#start \.start-bg,#start \.start-veil\{[\s\S]{0,80}opacity:1!important/, "staff Home shows the faded car-hero");
must(/\.start-actions \.pill\.purple \{ background:#C8081B/, "Appraise is G&M red, not loud purple");
must(/#startAppraise \{ top:auto/, "mobile Appraise is in the action card, not over a car");
must(/#startWebsite \{ bottom:auto/, "mobile Website is in the action card, not over a car");
must(/z-index:24/, "dock still layers");

must(/#start \.start-brand \{[\s\S]{0,220}left:8%/, "desktop brand sits on the left");
must(/#start \.start-dock \{[\s\S]{0,280}right:7%/, "desktop dock floats on the right");
must(/#start \.start-dock\{[\s\S]{0,280}background:rgba\(255,255,255,\.72\)/, "desktop dock is frosted glass");

must(/\.start-veil \{ position:absolute; inset:0; background:linear-gradient\(180deg,rgba\(18,20,26,\.55\) 0%,rgba\(18,20,26,\.22\) 38%,rgba\(18,20,26,\.94\) 70%,rgba\(18,20,26,\.96\) 100%/, "login veil is the Snow Signal scrim, floor crushed dark");
must(/#login \.start-veil\{[\s\S]{0,220}rgba\(18,20,26,\.94\) 70%/, "login override veil is near-opaque by 70%");
must(/#start \.start-veil\{[\s\S]{0,220}rgba\(18,20,26,\.94\) 70%/, "staff Home override veil is near-opaque by 70%");
must(/\.login-hero \.login-kicker \{ color:rgba\(255,255,255,\.80\)/, "login kicker is white on the car");
must(/\.login-hero h1 \{ margin:0 0 10px; font-size:34px; letter-spacing:-.7px; line-height:1.08; color:#fff/, "login title stays white on the car");
must(/#login \.login-card\{[\s\S]*?backdrop-filter:blur\(22px\)/, "login card is frosted glass");
must(/id="btnGuest">Continue as guest</, "guest login button stays");
must(/class="pill cyan" type="button" id="btnGuest"/, "guest CTA keeps its click-path class");
must(/\.login-hero \{[\s\S]{0,80}left:8%; right:auto; top:50%/, "desktop login hero stays cinematic");
must(/\.login-card \{[\s\S]{0,80}left:auto; right:7%; bottom:auto; top:50%/, "desktop login card stays on the right");

must(/#login #btnGoogle,#login \.gbtn\{[\s\S]{0,120}background:#C8081B/, "Google is G&M red primary");
must(/id="btnGoogle"/, "Google staff login stays");
must(/function enterStaff\(/, "staff email login stays");
must(/const STAFF_PASS="dietcoke"/, "staff password login stays");

must(/--qs-canvas:#F7F8FA/, "Center canvas is Snow Signal snow");
must(/#center \.acre-desk\{[\s\S]{0,220}grid-template-areas:"hero mid market"/, "Acre desk columns stay locked");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");

const share = slice("async function sharePacket(){", "\nfunction resetAll()");
const kick = slice("function kickShare(){", "\nfunction packetSendId(");
const send = slice("async function sendFromMe(", "\nfunction openEml(");
assert.equal(sha(share), "89ddee81289962020d2a4277f941f60a93d110d42312da85ad94eaeaf8cdb170", "sharePacket is byte-identical");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare is byte-identical");
assert.equal(sha(send), "a87ba1cb730ce79683938a05a22d839878d60319f35418efb408cabdcf9a9b49", "sendFromMe is byte-identical");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("home-dock-control: ok");
