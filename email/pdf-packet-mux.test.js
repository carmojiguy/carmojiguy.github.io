#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const vm = require("vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const copy404 = fs.readFileSync(path.join(root, "404.html"), "utf8");
const inspect = fs.readFileSync(path.join(root, "inspect-vehicle.html"), "utf8");

function sliceFn(name, next) {
  const start = html.indexOf("function " + name);
  assert.ok(start > 0, name + " not found");
  const end = next ? html.indexOf("\nfunction " + next, start) : html.length;
  assert.ok(end > start, name + " end not found");
  return html.slice(start, end);
}

function must(re, msg) {
  assert.ok(re.test(html), msg);
}
function mustNot(re, msg) {
  assert.ok(!re.test(html), msg);
}

assert.equal(html, copy404, "404.html matches index.html");
assert.equal(html, inspect, "inspect-vehicle.html matches index.html");
must(/id="buildStamp">build d30i</, "home footer stamp is d30h");
must(/id="typeSheet"[\s\S]*build d30i/, "type sheet stamp is d30h");
must(/sales PDF packet stays/, "file header keeps the sales PDF packet");

must(/function liveDamageCaption\(/, "live caption helper exists");
must(/function muxDamageWalkClip\(/, "damage photos+voice mux into one clip");
must(/function queueDamageMux\(/, "mux is queued on capture and submit");
must(/function damageMailClipPart\(/, "mail helper reads the muxed clip");
must(/keepMail:true/, "muxed clip is marked keepMail");
must(/damage-walk\.mp4/, "one clip filename");
must(/The sales-grade appraisal PDF is the packet/, "email body is the PDF packet");
must(/tattooed on the bottom of that photo/, "scuff bar caption burn stays");
must(/PAGE=\[250,249,252\]/, "sales-grade PDF cover stays");

mustNot(/Spoken damage notes are attached/, "no lone spoken-note email copy");
mustNot(/The photo catalog is in this email/, "no catalog-in-email copy");
mustNot(/Screen recording is on the file — not attached/, "no screen-recording-not-attached copy");
mustNot(/High-definition catalog PDF is attached/, "no catalog-PDF email copy");
mustNot(/play the matching audio to hear what was said/, "email does not tell Shawn to play m4a");

const share = html.slice(html.indexOf("async function sharePacket(){"), html.indexOf("\nfunction resetAll()"));
const kick = html.slice(html.indexOf("function kickShare(){"), html.indexOf("\nfunction packetSendId("));
const send = html.slice(html.indexOf("async function sendFromMe("), html.indexOf("\nfunction openEml("));
const guest = html.slice(html.indexOf("function finishGuest(){"), html.indexOf("\nfunction paintGuestStory("));
assert.ok(/sentOk=true;\s*finish\(""\);\s*try\{ finishGuest\(\); \}/.test(share), "sharePacket Thank you path stays");
assert.ok(/function restoreSend\(\)\{/.test(share), "sharePacket restoreSend stays");
assert.ok(/sharePacket\(\);/.test(kick), "kickShare still sends");
assert.ok(/stripMailVideoParts\(parts\)/.test(send), "sendFromMe still slims parts");
assert.ok(/finishThanks\(\);/.test(guest), "finishGuest still Thank you only");
assert.ok(!/muxDamageWalkClip\(/.test(share), "sharePacket body was not edited for mux");
assert.ok(!/packetCatalogHtml\(/.test(share.split("function restoreSend")[1] || ""), "restoreSend success path was not rewritten");

const stripFrom = html.indexOf("function isLoneMailAudioPart(");
const stripTo = html.indexOf("async function sendFromMe(", stripFrom);
const stripBox = {};
vm.createContext(stripBox);
vm.runInContext(
  html.slice(stripFrom, stripTo) +
  "\nthis.isLoneMailAudioPart=isLoneMailAudioPart;this.isKeepMailClip=isKeepMailClip;this.isMailVideoPart=isMailVideoPart;this.stripMailVideoParts=stripMailVideoParts;",
  stripBox
);
assert.equal(stripBox.isLoneMailAudioPart({ name: "damage-03-driver-01-voice.m4a", mime: "audio/mp4", b64: "x" }), true);
assert.equal(stripBox.isKeepMailClip({ name: "damage-walk.mp4", mime: "video/mp4", b64: "x", keepMail: true }), true);
const kept = stripBox.stripMailVideoParts([
  { name: "front.jpg", mime: "image/jpeg", b64: "a" },
  { name: "damage-03-driver-01-voice.m4a", mime: "audio/mp4", b64: "b" },
  { name: "00_1.mp4", mime: "video/mp4", b64: "c" },
  { name: "damage-walk.mp4", mime: "video/mp4", b64: "d", keepMail: true }
]);
assert.deepStrictEqual(kept.map(function (p) { return p.name; }), ["front.jpg", "damage-walk.mp4"], "mail keeps PDF hero photos + one muxed clip only");

const mailBox = { APP: { _damageMailClip: { b64: "AAA", mime: "video/mp4", name: "damage-walk.mp4" } } };
vm.createContext(mailBox);
vm.runInContext(
  sliceFn("dataB64", "damageMuxKey") +
  sliceFn("damageMailClipPart", "pushVoiceParts") +
  sliceFn("pushVoiceParts", "packetMailHtml") +
  "this.damageMailClipPart=damageMailClipPart;this.pushVoiceParts=pushVoiceParts;",
  mailBox
);
const parts = [];
mailBox.pushVoiceParts(parts, [{ audio: "data:audio/mp4;base64,QQ==", audioName: "damage-03-driver-01-voice.m4a", audioMime: "audio/mp4" }]);
assert.equal(parts.length, 1, "exactly one mail part");
assert.equal(parts[0].name, "damage-walk.mp4");
assert.equal(parts[0].keepMail, true);
assert.ok(parts[0].mime.indexOf("video/") === 0, "attached part is video");
assert.ok(!parts.some(function (p) { return /m4a|audio\//i.test((p.name || "") + (p.mime || "")); }), "never attaches lone m4a");

mailBox.APP._damageMailClip = { b64: "QQ==", mime: "audio/mp4", name: "damage-03-voice.m4a" };
const refused = [];
mailBox.pushVoiceParts(refused, [{ audio: "data:audio/mp4;base64,QQ==", audioName: "damage-03-voice.m4a" }]);
assert.deepStrictEqual(refused, [], "audio-only clip is refused");

mailBox.APP._damageMailClip = null;
const empty = [];
mailBox.pushVoiceParts(empty, [{ audio: "data:audio/mp4;base64,QQ==", audioName: "damage-03-driver-01-voice.m4a", audioMime: "audio/mp4" }]);
assert.deepStrictEqual(empty, [], "no muxed clip means no audio fallback");

const capBox = { APP: { mode: "damage", dmgCaption: "Listening… describe the damage", heard: "", notes: "" } };
vm.createContext(capBox);
vm.runInContext(
  sliceFn("damageCaptionLine", "isDamageNote") +
  sliceFn("isDamageNote", "liveDamageCaption") +
  sliceFn("liveDamageCaption", "stampBanner") +
  "this.liveDamageCaption=liveDamageCaption;this.isDamageNote=isDamageNote;this.damageCaptionLine=damageCaptionLine;",
  capBox
);
assert.equal(capBox.liveDamageCaption("Listening… describe the damage"), "");
assert.equal(capBox.liveDamageCaption("There's a scuff right here"), "There's a scuff right here");
assert.ok(capBox.isDamageNote("There's a scuff right here at the rear corner"), "scuff line is a damage note");

console.log("pdf-packet-mux: ok");
