#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function sliceFn(name, next) {
  const start = html.indexOf("function " + name);
  assert.ok(start > 0, name + " not found");
  const end = next ? html.indexOf("\nfunction " + next, start) : html.length;
  assert.ok(end > start, name + " end not found");
  return html.slice(start, end);
}

const sandbox = {
  APP: {
    heard: "One-owner winter tires included rust-free",
    notes: "",
    mode: "damage",
    damage: {
      qfront: [
        {
          data: "data:image/jpeg;base64,AAA",
          cap: "Rust along the front fender and a dent in the passenger door that goes from the handle down to the rocker.",
          audio: "data:audio/webm;base64,QQ==",
          audioMime: "audio/webm"
        }
      ]
    },
    damageCap: {},
    photos: { qfront: "data:image/jpeg;base64,BBB" },
    closeups: ["data:image/jpeg;base64,CCC"],
    closeupCap: ["Scratch on the bumper, pretty deep, you can feel it with your finger."],
    closeupAudio: [{ data: "data:audio/mp4;base64,QQ==", mime: "audio/mp4" }]
  },
  VIEWS: [
    ["qfront", "3/4 Front", "qfront"],
    ["front", "Front", "front"]
  ]
};
vm.createContext(sandbox);
vm.runInContext(
  sliceFn("dmgShots", "shotHasVoice") +
  sliceFn("shotHasVoice", "playShotAudio") +
  sliceFn("audioExt", "cutDamageAudioClones") +
  sliceFn("damageCaptionLine", "isDamageNote") +
  sliceFn("isDamageNote", "stampBanner") +
  sliceFn("capturedFiles", "loadImg") +
  "this.dmgShots=dmgShots;this.shotHasVoice=shotHasVoice;this.audioExt=audioExt;" +
  "this.damageCaptionLine=damageCaptionLine;this.isDamageNote=isDamageNote;this.capturedFiles=capturedFiles;",
  sandbox
);

assert.equal(sandbox.damageCaptionLine("dent in the door", 52), "dent in the door");
const long = "Rust along the front fender and a dent in the passenger door that goes from the handle down to the rocker and then some more words.";
const short = sandbox.damageCaptionLine(long, 52);
assert.ok(short.length <= 53, "short line stays short");
assert.ok(/…$/.test(short), "long line ends with ellipsis");
assert.ok(sandbox.isDamageNote(long), "long spoken notes still count as damage notes");
assert.ok(!sandbox.isDamageNote("One-owner winter tires included rust-free extra"), "story dump is not tattooed");
assert.equal(sandbox.audioExt("audio/mp4"), "m4a");
assert.equal(sandbox.audioExt("audio/webm;codecs=opus"), "webm");

const files = sandbox.capturedFiles();
const dmg = files.find(function (s) { return s.kind === "damage"; });
const close = files.find(function (s) { return s.kind === "close"; });
assert.ok(dmg, "damage shot is in the packet");
assert.ok(dmg.audio, "damage audio stays tied to that photo");
assert.ok(dmg.audioName.indexOf("voice") >= 0, "voice file is named next to the photo");
assert.ok(dmg.cap.indexOf("Rust along the front fender") === 0, "full spoken cap is kept");
assert.ok(close.audio, "close-up / employee audio stays tied");
assert.ok(close.audioName.indexOf("close-01-voice.m4a") === 0, "close-up voice extension follows mime");
assert.ok(sandbox.shotHasVoice(dmg), "shotHasVoice sees the recording");

assert.ok(/id="viewerCapMore"/.test(html), "More control exists");
assert.ok(/id="viewerCapSheet"/.test(html), "expand is a sheet under the photo");
assert.ok(/max-height:36vh/.test(html), "sheet does not cover the car");
assert.ok(/function startDamageAudio\(/.test(html), "guest and staff damage start the same recorder");
assert.ok(/APP\.mode==="damage" \|\| APP\.mode==="close"/.test(html), "employee close mode uses the same talk path");
assert.ok(/pushVoiceParts\(parts, shots\)/.test(html), "Send attaches the voice files");

const mailbox = { APP: { role: "guest", purpose: "both" } };
vm.createContext(mailbox);
vm.runInContext(
  "var CHRISTINA_COPY=\"christina@carmoji.ca\";\n" +
  "function isWeb(){ return APP.purpose===\"website\"; }\n" +
  sliceFn("isAppraisalSend", "appraisalCc") +
  sliceFn("appraisalCc", "uniqEmails") +
  "this.isAppraisalSend=isAppraisalSend;this.appraisalCc=appraisalCc;",
  mailbox
);
mailbox.APP.role = "guest";
mailbox.APP.purpose = "both";
assert.deepEqual(mailbox.appraisalCc(), ["christina@carmoji.ca"], "guest trade-in CCs Christina");
mailbox.APP.role = "employee";
mailbox.APP.purpose = "both";
assert.deepEqual(mailbox.appraisalCc(), ["christina@carmoji.ca"], "staff appraisal CCs Christina");
mailbox.APP.purpose = "website";
assert.deepEqual(mailbox.appraisalCc(), [], "website-only / Just Pictures website posts skip Christina");

console.log("damage-voice: ok");
