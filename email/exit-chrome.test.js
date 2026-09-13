#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function must(re, msg) {
  assert.ok(re.test(html), msg);
}
function mustNot(re, msg) {
  assert.ok(!re.test(html), msg);
}
function sliceFn(name) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start > 0, name + " found");
  const next = html.indexOf("\nfunction ", start + 10);
  return html.slice(start, next > start ? next : start + 800);
}

must(/id="exitChrome"/, "exit chrome exists");
must(/id="exitClose"[\s\S]*id="exitBack"[\s\S]*id="exitHome"/, "Close, Back, and Home are together");
must(/class="exit-x"/, "Close is the bright X");
must(/class="exit-back"/, "Back is a big tap target");
must(/class="exit-home"/, "Home is a big tap target");
must(/function pageClose\(/, "pageClose");
must(/function pageBack\(/, "pageBack");
must(/function pageHome\(/, "pageHome");
must(/function dismissOpenLayer\(/, "dismissOpenLayer");
must(/function closeAllOverlays\(/, "closeAllOverlays");
must(/function syncExitChrome\(/, "syncExitChrome");
must(/function armAppBack\(/, "history trap for device Back");
must(/\.sheet\.on/, "sheet closer still targets .sheet.on");
must(/e\.target===sheet/, "backdrop tap closes sheets");
must(/z-index:110/, "chrome is above sheets at z-index 40");
must(/min-height:56px/, "Back/Home are 56px tap targets");
must(/width:56px; height:56px/, "Close X is 56px");
must(/width:48px; height:48px/, "sheet card X is 48px, not 28px");
must(/show\("start"\)/, "Home lands on the start hub");
must(/\$\("camDone"\)\.onclick = function\(\)\{ show\("photos"\)/, "camera Done still returns to photos");

const home = sliceFn("pageHome");
assert.ok(home.indexOf('show("start")') >= 0, "Home opens the start hub");
assert.ok(home.indexOf("closeAllOverlays") >= 0, "Home closes overlays first");
assert.ok(home.indexOf("kickShare") < 0, "Home does not touch Send");
assert.ok(home.indexOf("sharePacket") < 0, "Home does not touch sharePacket");
assert.ok(home.indexOf("sendFromMe") < 0, "Home does not touch sendFromMe");
assert.ok(home.indexOf("finishGuest") < 0, "Home does not touch finishGuest");

const back = sliceFn("pageBack");
assert.ok(back.indexOf("dismissOpenLayer") >= 0, "Back dismisses the top sheet first");
assert.ok(/show\("photos"\)/.test(back), "camera/submit Back is one step to photos");
assert.ok(/show\("home"\)/.test(back), "verify/photos Back can return to Appraise home");
assert.ok(/show\("workbench"\)/.test(back), "CA Back can return to the appointment desk");
assert.ok(back.indexOf("exitCenterChrome") >= 0, "Center Back uses the existing one-step closer");

const closer = sliceFn("pageClose");
assert.ok(closer.indexOf("dismissOpenLayer") >= 0, "X closes the open sheet first");
assert.ok(closer.indexOf("pageHome") >= 0, "X on an appraisal exits to the hub");

mustNot(/function kickShare\(\)\{[\s\S]{0,80}pageHome/, "kickShare is not rewritten by exit chrome");
must(/function kickShare\(/, "kickShare stays");
must(/function sharePacket\(/, "sharePacket stays");
must(/function sendFromMe\(/, "sendFromMe stays");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "finishGuest stays Thank-you-only");
must(/function restoreSend\(\)/, "restoreSend stays");
mustNot(/function pageHome\(\)\{[\s\S]{0,400}restoreSend/, "Home does not call restoreSend");

must(/id="buildStamp">build d29s</, "build stamp");
console.log("exit-chrome tests ok");
