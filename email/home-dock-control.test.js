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

must(/<!--[\s\S]*Shawn HOME dock: login cinematic overlay \+ 29-sold/, "stamp names the login-aligned home dock");
must(/<!--[\s\S]*HOLD #33\/#46/, "HOLD #33/#46 stays");
must(/<!--[\s\S]*Off Acre #73 photo lock remix/, "Acre desk photo lock is off-limits");
must(/<!--[\s\S]*Thank-you frozen/, "Thank-you stays frozen in the stamp");
must(/<!--[\s\S]*pixel-faithful Acre GR Corolla desk/, "Acre pixel lock stamp stays");
must(/id="buildStamp">build d31a</, "footer stamp stays d31a");

must(/id="startDock"/, "staff start dock stays");
must(/id="startBrand"/, "home brand chrome on the hero");
must(/class="start-desk-head"/, "desktop desk head lives in the dock card");
must(/id="startAppraise">Appraise vehicle</, "Appraise label stays");
must(/id="startCenter"[\s\S]*Appraisal Center/, "Center pill stays");
must(/id="startWebsite">Post vehicle to website</, "Website pill stays");
must(/id="startTrade">Send trade-in link</, "trade-in pill stays");
must(/id="startUsers">Users</, "Users pill stays");

mustNot(/#start:has\(#startDock:not\(\.hide\)\) \.start-bg/, "car photo is not cropped above a footer strip");
mustNot(/border-top:1px solid rgba\(0,164,226/, "no cyan/blue dock strip");
mustNot(/#07101c/, "no navy footer bar");
mustNot(/linear-gradient\(180deg, rgba\(7,16,32,\.96\)/, "no dark blue dock wash");

must(/#start \.start-veil \{[\s\S]{0,120}rgba\(245,243,237/, "home fades the car with a cream/slate overlay");
must(/#start\.start \{[\s\S]{0,180}--home-slate:#3E5C54/, "home slate green token");
must(/#start\.start \{[\s\S]{0,220}--home-terra:#B45C3C/, "home terracotta token");
must(/\.start-actions \.pill\.purple \{ background:#3E5C54/, "Appraise is slate green, not loud purple");
must(/\.start-actions \.pill\.cyan \{ background:#B45C3C/, "Website is terracotta, not loud cyan");

must(/#startAppraise \{ top: calc\(env\(safe-area-inset-top, 0px\) \+ 1\.55in\)/, "mobile Appraise sits up through the car");
must(/#startCenter \{[\s\S]{0,160}top:50%; transform:translate\(-50%, -50%\)/, "mobile Center sits mid-hero");
must(/#startWebsite \{ bottom: calc\(env\(safe-area-inset-bottom, 0px\) \+ 1\.55in\)/, "mobile Website sits on the hero");
must(/\.start-more \{[\s\S]{0,180}bottom: calc\(16px \+ env\(safe-area-inset-bottom/, "mobile Trade/Users sit on the hero");
must(/z-index:24/, "dock still layers over the hero");

must(/#start \.start-brand \{[\s\S]{0,220}left:8%/, "desktop brand sits like login-hero");
must(/#start \.start-dock \{[\s\S]{0,280}right:7%/, "desktop dock floats like the login card");
must(/#start \.start-dock \{[\s\S]{0,520}background:rgba\(255,255,255,\.94\)/, "desktop dock is a frosted login-style card");

must(/\.start-veil \{ position:absolute; inset:0; background:linear-gradient\(180deg,rgba\(8,6,16,\.40\)/, "login veil stays the original dark wash");
must(/\.login-hero \.login-kicker \{ color:#7EE8F2/, "login kicker stays cyan");
must(/\.login-hero h1 \{ margin:0 0 10px; font-size:34px; letter-spacing:-.7px; line-height:1.08; color:#fff/, "login title stays white on the car");
must(/\.login-card \{ position:absolute; left:16px; right:16px; bottom:calc\(16px \+ env\(safe-area-inset-bottom\)\)/, "login card stays bottom-anchored");
must(/id="btnGuest">Continue as guest</, "guest login button stays");
must(/class="pill cyan" type="button" id="btnGuest"/, "guest CTA stays cyan");
must(/\.login-hero \{[\s\S]{0,80}left:8%; right:auto; top:50%/, "desktop login hero stays cinematic");
must(/\.login-card \{[\s\S]{0,80}left:auto; right:7%; bottom:auto; top:50%/, "desktop login card stays on the right");

const loginChrome = slice(".login-hero {\n  position:absolute; left:22px;", ".gbtn {");
assert.equal(sha(loginChrome), "dd45835ca4c2dd2758f17ce79401708ad0b45ce63b6aa4166ba9a5d50405215c", "login-hero + login-card CSS is frozen");
must(/id="btnGoogle"/, "Google staff login stays");
must(/function enterStaff\(/, "staff email login stays");
must(/const STAFF_PASS="dietcoke"/, "staff password login stays");

must(/#center\.screen \{[\s\S]{0,220}background:#F5F6F8/, "Acre desk page is untouched");
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
