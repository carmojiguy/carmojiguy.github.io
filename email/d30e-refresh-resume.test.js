#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const copy404 = fs.readFileSync(path.join(root, "404.html"), "utf8");
const inspect = fs.readFileSync(path.join(root, "inspect-vehicle.html"), "utf8");

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
function sliceFn(name, next) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start > 0, name + " found");
  const end = next
    ? html.indexOf("\nfunction " + next, start)
    : html.indexOf("\nfunction ", start + 10);
  assert.ok(end > start, name + " end found");
  return html.slice(start, end);
}
function sha(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

const SCREENS = [
  "login", "start", "home", "center", "workbench", "photos", "camera",
  "invite", "users", "verify", "webdesk", "webStudio", "submit", "thanks"
];

assert.equal(copy404, html, "404.html stays a byte-identical copy of index.html");
assert.equal(inspect, html, "inspect-vehicle.html stays a byte-identical copy of index.html");

must(/id="buildStamp">build d30g</, "home footer stamp is d30g");
must(/<!--[\s\S]*build d30g[\s\S]*Thank-you frozen/, "file header stamp is d30g");

must(/id="exitChrome"/, "global top chrome exists once");
must(/id="exitBack">Back/, "Back is in the top chrome");
must(/id="exitHome">Home/, "Home is in the top chrome");
mustNot(/id="exitRefresh"/, "Refresh button is gone");
mustNot(/class="exit-refresh"/, "Refresh chrome class is gone");
mustNot(/function pageRefresh\(/, "pageRefresh helper is gone");
must(/id="exitClose"[\s\S]*id="exitBack"[\s\S]*id="exitHome"/, "Close, Back, Home share one row");

SCREENS.forEach(function (id) {
  assert.ok(new RegExp('<section class="screen[^"]*" id="' + id + '"').test(html) || new RegExp('id="' + id + '"').test(html), id + " screen exists");
});

const sync = sliceFn("syncExitChrome", "closeNamedSheet");
assert.ok(/const show=!!APP\.screen;/.test(sync), "chrome turns on for any standing screen");
assert.ok(!/APP\.screen==="start"/.test(sync), "start is not excluded from chrome");
assert.ok(!/APP\.screen==="login"/.test(sync), "login is not excluded from chrome");
assert.ok(!/APP\.screen==="thanks"/.test(sync), "thanks is not excluded from chrome");
must(/<div class="exit-chrome on" id="exitChrome">/, "chrome is on from first paint");
must(/<body class="exit-on">/, "body starts with exit chrome on");

must(/id="centerDetailClose"/, "vehicle detail keeps its own Close X");
must(/class="x" type="button" data-close="typeSheet"/, "type sheet keeps its Close X");

must(/id="resumeLayer"/, "abandoned chooser is a global overlay");
must(/id="resumeContinue">Continue abandoned session</, "Continue abandoned session button");
must(/id="resumeFresh">Start a new one</, "Start a new one button");
must(/id="resumeTitle">Continue abandoned session\?</, "chooser title is the Continue prompt");

const offer = sliceFn("offerResume", "continueDraft");
assert.ok(!/APP\.role!=="guest"/.test(offer), "offerResume does not return early for staff");
assert.ok(!/\$\("start"\)\.classList\.contains\("on"\)/.test(offer), "chooser is not start-screen-only");
assert.ok(!/if\(liveJobProgress\(\)\) return;/.test(offer), "live leftover work still asks, never silent-keeps");
assert.ok(/paintResume\(snap\)/.test(offer), "leftover draft paints the chooser before restore");
assert.ok(/liveJobProgress\(\)\) paintResume/.test(offer), "in-memory leftover work also paints the chooser");

const cont = sliceFn("continueDraft", "startFresh");
assert.ok(/applySnapshot\(snap\)/.test(cont), "Continue restores the abandoned snap");
assert.ok(/APP\._resumeAsked=true/.test(cont), "Continue records the answer");

const fresh = sliceFn("startFresh", "wipeJob");
assert.ok(/clearDraft\(\)/.test(fresh), "Start a new one clears the abandoned draft");
assert.ok(/wipeJob\(false\)/.test(fresh), "Start a new one wipes the live job");
assert.ok(!/applySnapshot\(/.test(fresh), "Start a new one never restores");

const applyCalls = [];
const applyRe = /applySnapshot\(/g;
let applyMatch;
while ((applyMatch = applyRe.exec(html))) {
  const before = html.slice(Math.max(0, applyMatch.index - 16), applyMatch.index);
  if (!/function\s+$/.test(before)) applyCalls.push(applyMatch.index);
}
assert.equal(applyCalls.length, 2, "applySnapshot is only Continue + pending Send restore");
must(/if\(snap\) applySnapshot\(snap\);/, "pending Send still restores after OAuth — frozen path");
must(/async function resumePendingSend\(\)\{/, "pending Send helper stays");

const share = slice("async function sharePacket(){", "\nfunction resetAll()");
const kick = slice("function kickShare(){", "\nfunction packetSendId(");
const send = slice("async function sendFromMe(", "\nfunction openEml(");
assert.equal(sha(share), "89ddee81289962020d2a4277f941f60a93d110d42312da85ad94eaeaf8cdb170", "sharePacket Thank-you hash unchanged");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare Thank-you hash unchanged");
assert.equal(sha(send), "a87ba1cb730ce79683938a05a22d839878d60319f35418efb408cabdcf9a9b49", "sendFromMe Thank-you hash unchanged");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "finishGuest stays Thank-you-only");

assert.ok(/function applySharedIncoming\(/.test(html), "Incoming land helper stays");
assert.ok(/function landIncomingPacket\(/.test(html), "landIncomingPacket stays");
must(/function collapseCenterVinDupes\(store\)\{\s*return false;/, "VIN collapse is a no-op");
must(/New appraisal submitted/, "superseded watermark copy is exact");

console.log("d30e refresh + abandoned resume tests ok");
