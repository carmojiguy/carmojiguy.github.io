#!/usr/bin/env node
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const vm = require("vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function sha(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
function slice(from, to) {
  const start = html.indexOf(from);
  const end = html.indexOf(to, start);
  assert.ok(start >= 0 && end > start, "slice " + from);
  return html.slice(start, end);
}

const share = slice("async function sharePacket(){", "\nfunction resetAll()");
const kick = slice("function kickShare(){", "\nfunction packetSendId(");
const send = slice("async function sendFromMe(", "\nfunction openEml(");
assert.equal(sha(share), "89ddee81289962020d2a4277f941f60a93d110d42312da85ad94eaeaf8cdb170", "sharePacket frozen");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare frozen");
assert.equal(sha(send), "a87ba1cb730ce79683938a05a22d839878d60319f35418efb408cabdcf9a9b49", "sendFromMe frozen");

const gStart = html.indexOf("const GHOSTS = {");
const gEnd = html.indexOf("const ASSET_BASE=", gStart);
const vStart = html.indexOf("const VIEWS = [");
const vEnd = html.indexOf("const PACKET_LAUNCH", vStart);
assert.ok(gStart > 0 && gEnd > gStart && vStart > 0 && vEnd > vStart, "GHOSTS/VIEWS extractable");

const sandbox = { GHOSTS: null, VIEWS: null };
vm.createContext(sandbox);
vm.runInContext(
  html.slice(gStart, gEnd) + html.slice(vStart, vEnd) +
  "this.GHOSTS=GHOSTS; this.VIEWS=VIEWS;",
  sandbox
);

const views = sandbox.VIEWS.map(function (v) { return v[0]; });
assert.deepEqual(views, [
  "qfront", "driver", "qrear_drv", "rear",
  "qrear_pass", "pass", "qfront_pass", "front",
  "dash", "console", "tire"
], "VIEWS is Shawn 11-step order");
assert.equal(views.length, 11, "interior/door dropped from the live walk");
assert.ok(views.indexOf("interior") < 0, "no interior step");

function ghostFile(key) {
  return String(sandbox.GHOSTS[key] || "").split("?")[0];
}
assert.equal(ghostFile("qfront"), "ghosts/04-front-quarter.png");
assert.equal(ghostFile("driver"), "ghosts/03-side.png");
assert.equal(ghostFile("qrear"), "ghosts/05-rear-quarter.png");
assert.equal(ghostFile("rear"), "ghosts/02-rear.png");
assert.equal(ghostFile("front"), "ghosts/01-front.png");
assert.equal(ghostFile("dash"), "ghosts/dash.png");
assert.equal(ghostFile("console"), "ghosts/console.png");
assert.equal(ghostFile("tire"), "ghosts/tire.png");
["qfront", "driver", "qrear", "rear", "front"].forEach(function (k) {
  assert.ok(/\?v=7\b/.test(sandbox.GHOSTS[k]), k + " cache-busted ?v=7");
});
assert.ok(!sandbox.GHOSTS.qrear_pass && !sandbox.GHOSTS.pass && !sandbox.GHOSTS.qfront_pass,
  "passenger ghosts omitted — no driver-side reuse");

["01-front.png", "02-rear.png", "03-side.png", "04-front-quarter.png", "05-rear-quarter.png"].forEach(function (name) {
  assert.ok(fs.existsSync(path.join(root, "ghosts", name)), name + " in ghosts/");
});

assert.ok(/function isPassGhost\(key\)\{[\s\S]*return false;/.test(html), "no CSS-flip of driver assets");
assert.ok(/if\(!src\)\{\s*g\.src = "";\s*g\.classList\.add\("off"\)/.test(html), "missing overlay uses ghost.off");
assert.ok(!/qrear_pass": "ghosts\//.test(html) && !/"pass": "ghosts\/driver/.test(html),
  "passenger keys are not wired to files");
assert.ok(/opacity:\.86/.test(html), "ghost opacity kept");
assert.ok(/mix-blend-mode:normal/.test(html), "ghost mix-blend kept");
