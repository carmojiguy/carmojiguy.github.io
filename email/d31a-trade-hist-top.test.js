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
must(/<!--[\s\S]*build d31a[\s\S]*Trade-in start drops stray top History/, "header names the stray top History drop");
must(/<!--[\s\S]*rail History stays/, "header keeps rail History");
must(/<!--[\s\S]*FIFO oldest home/, "FIFO oldest home stays");
must(/<!--[\s\S]*left-rail Incoming\/On-site\/Needs docs\/History/, "left rail stays");
must(/<!--[\s\S]*Thank-you frozen/, "Thank-you stays frozen");
must(/<!--[\s\S]*pixel-faithful Acre GR Corolla desk/, "pixel desk stays");
must(/<!--[\s\S]*drop the verbal-only tag forever/, "CA workbench stays");
must(/id="typeSheet"[\s\S]*build d31a/, "type sheet stamp stays d31a");

must(/#homeHistBtn, #homeHistJump \{ display:none/, "Trade-in / Appraise start top History is killed");
must(/#centerNavHistBtn \{ display:none/, "Center top History pill stays killed");
must(/id="centerHistoryBtn"/, "Acre left-rail History pill stays");
must(/id="centerLanes"[^>]*center-rail|class="center-lanes center-rail"/, "left rail stays");
must(/function oldestReadyCenter\(/, "FIFO oldest home stays");
must(/function pullUsersRemote\(/, "users persist stays");
must(/function settleTeamRunIfFinal\(/, "FINAL still clears Running");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
mustNot(/id="exitRefresh"/, "Refresh stays gone");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");

const paint = sliceFn("paintStaffHistButtons", "closeStaffHist");
assert.ok(/homeHistBtn/.test(paint) && /classList\.add\("hide"\)/.test(paint), "staff paint keeps homeHistBtn hidden");
assert.ok(/homeHistJump/.test(paint) && !/\["homeHistBtn","homeHistJump","photosHistBtn"\]/.test(paint), "staff paint no longer unhides Trade-in start History");
assert.ok(/photosHistBtn/.test(paint), "website photos History can still show");

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

console.log("d31a-trade-hist-top: ok");
