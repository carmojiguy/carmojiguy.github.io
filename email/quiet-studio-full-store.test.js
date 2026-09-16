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

must(/Quiet Studio STRUCTURAL FULL STORE/, "stamp names Quiet Studio structural expansion");
must(/#F4F5F7/, "cool stone canvas token");
must(/#3D5A4C/, "sage accent token");
must(/--qs-canvas:#F4F5F7/, "QS canvas variable");
must(/--qs-accent:#3D5A4C/, "QS sage variable");
mustNot(/--qs-canvas:#F5F3ED/, "Paper Desk cream is not the QS canvas");

must(/\.screen:not\(\.on\) \{ display:none !important; \}/, "any screen without .on is forced hidden");
must(/#start\.screen\.start\.on \{/, "desktop Home display:block is gated on .on");
must(/#start\.screen\.start:not\(\.on\) \{[\s\S]{0,80}display:none !important/, "desktop Home without .on is hidden");
must(/#start:not\(\.on\) \.start-dock/, "startDock cannot receive taps when Home is off");

must(/id="centerInboxBtn"/, "Incoming stays");
must(/id="centerOnsiteBtn"/, "On-site stays");
must(/id="centerNeedsBtn"/, "Needs docs stays");
must(/id="centerHistoryBtn"/, "History stays");
must(/id="acreDesk"/, "Acre desk wrapper");
must(/class="acre-col-hero"/, "hero + thumbs column");
must(/class="acre-col-mid"/, "metrics / notes column");
must(/class="acre-col-market"/, "market docs column");
must(/id="centerMayaBar"/, "Ask Maya");
must(/id="centerStageBtn">Complete</, "Complete");
must(/#center \.acre-desk\{[\s\S]{0,220}grid-template-areas:"hero mid market"/, "hero | mid | market stays");
must(/function oldestReadyCenter\(/, "FIFO oldest home stays");

must(/label:"Pending Decision"/, "Pending Decision column");
must(/label:"Follow-up"/, "Follow-up column");
must(/label:"Purchased"/, "Purchased column");
must(/label:"Pending Close Out"/, "Pending Close Out column");
must(/label:"Closed Out"/, "Closed Out column");
must(/label:"Stocked In"/, "Stocked In column");
must(/label:"Payment Complete"/, "Payment Complete column");
must(/label:"Archived"/, "Archived column");
must(/target:23/, "Pending Decision count");
must(/target:27/, "Payment Complete count");
must(/id="acqDrawerToggle"/, "Acquisitions beside Canada Drives");

must(/id="startAppraise">Appraise vehicle</, "Appraise pill stays");
must(/id="startCenter"[\s\S]*Appraisal Center/, "Center pill stays");
must(/id="startWebsite">Post vehicle to website</, "Website pill stays");
must(/id="startTrade">Send trade-in link</, "trade-in pill stays");
must(/id="startUsers">Users</, "Users pill stays");
must(/id="startHello"/, "home greeting");
must(/id="btnGoogle"/, "Google staff login stays");
must(/id="btnGuest">Continue as guest</, "guest login stays");

must(/qs-step-labels/, "appraise VIN / Decode / Walk / Story stepper");
must(/Confirm vehicle/, "decode step heading");
must(/Walk-around/, "walk-around step label");

must(/id="thanksSendReceipt">Send receipt</, "thank-you Send receipt chrome");
must(/id="thanksShareLink">Share link</, "thank-you Share chrome");
must(/id="thanksCopyLink">Copy link</, "thank-you Copy chrome");
must(/behavior frozen \(do not change share\/send paths\)/, "thank-you designer freeze caption");
must(/id="thanksDone">Back to Center/, "staff can leave Thank you");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
must(/thanksSendReceipt"\)\) \$\("thanksSendReceipt"\)\.onclick = qsThanksShareLink/, "Send receipt chrome does not call kickShare");
mustNot(/thanksSendReceipt[\s\S]{0,80}kickShare\(/, "thanks Send receipt does not invoke kickShare");

must(/function staffPerms\(\)\{ return \{trade:true, appraise:true, website:true, center:true, admin:false, ca:true\}; \}/, "staffPerms stays On except Users");

const share = slice("async function sharePacket(){", "\nfunction resetAll()");
const kick = slice("function kickShare(){", "\nfunction packetSendId(");
const send = slice("async function sendFromMe(", "\nfunction openEml(");
assert.equal(sha(share), "89ddee81289962020d2a4277f941f60a93d110d42312da85ad94eaeaf8cdb170", "sharePacket is byte-identical");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare is byte-identical");
assert.equal(sha(send), "a87ba1cb730ce79683938a05a22d839878d60319f35418efb408cabdcf9a9b49", "sendFromMe is byte-identical");

const loginChrome = slice(".login-hero {\n  position:absolute; left:22px;", ".gbtn {");
assert.equal(sha(loginChrome), "dd45835ca4c2dd2758f17ce79401708ad0b45ce63b6aa4166ba9a5d50405215c", "login-hero + login-card CSS is frozen");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("quiet-studio-full-store: ok");
