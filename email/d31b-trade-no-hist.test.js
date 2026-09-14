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
function sliceFn(name, next) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start > 0, name + " found");
  const end = next
    ? html.indexOf("\nfunction " + next + "(", start)
    : html.indexOf("\nfunction ", start + 10);
  assert.ok(end > start, name + " end found");
  return html.slice(start, end);
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

must(/id="buildStamp">build d31a</, "footer stamp stays d31a");
must(/<!--[\s\S]*build d31a[\s\S]*Trade-in start drops stray top History/, "header names the Trade-in History lock");
must(/<!--[\s\S]*build d31a[\s\S]*drop the verbal-only tag forever/, "d31a CA locks stay in the stamp");
must(/id="typeSheet"[\s\S]*build d31a/, "type sheet stamp stays d31a");

must(/id="homeHistBtn"/, "Appraise home History control still exists");
must(/id="homeHistJump"/, "Appraise History jump still exists");
must(/#homeHistBtn, #homeHistJump \{ display:none/, "Trade-in / Appraise start top History is killed");
must(/id="wbHistBtn"/, "CA workbench History stays");
must(/id="apptSearch"/, "app # search stays");
must(/data-appt-region="GTA"/, "GTA tab stays");
must(/data-appt-region="Ottawa"/, "Ottawa tab stays");
must(/id="apptTrackerGta"/, "GTA Tracker stays");
must(/id="apptTrackerOttawa"/, "Ottawa Tracker stays");
must(/id="apptNewApp"/, "New application stays");
must(/function trackerCurrentMonth\(/, "tracker current month stays");
must(/class="tracker-mobile"/, "tracker mobile cards stay");

const paint = sliceFn("paintStaffHistButtons", "closeStaffHist");
assert.ok(/homeHistBtn/.test(paint) && /homeHistJump/.test(paint), "Trade-in start History buttons are painted");
assert.ok(/classList\.add\("hide"\)/.test(paint), "home History is always hidden");
assert.ok(!/\["homeHistBtn","homeHistJump","photosHistBtn"\]/.test(paint), "staff paint no longer unhides Trade-in start History");

must(/"Trade-in","Locate","Consumer Acquisition"/, "Trade-in remains an appraisal type");
must(/\$\("startAppraise"\)\.onclick = function\(\)\{/, "Appraise vehicle start stays");
must(/show\("home"\)/, "Appraise still opens home + type sheet");
must(/openDealType\(\)/, "type sheet still opens");

must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");
mustNot(/id="wbSendCard"/, "CA workbench still has no Airtight Send");
mustNot(/Verbal description only/, "Verbal description only stays gone");

const share = slice("async function sharePacket(){", "\nfunction resetAll()");
const kick = slice("function kickShare(){", "\nfunction packetSendId(");
const send = slice("async function sendFromMe(", "\nfunction openEml(");
assert.equal(sha(share), "89ddee81289962020d2a4277f941f60a93d110d42312da85ad94eaeaf8cdb170", "sharePacket is byte-identical to d25s");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare is byte-identical to d25s");
assert.equal(sha(send), "a87ba1cb730ce79683938a05a22d839878d60319f35418efb408cabdcf9a9b49", "sendFromMe is byte-identical to d25s");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("d31b-trade-no-hist: ok");
