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
must(/id="buildStamp">build d27m</, "home footer stamp is d27m");
must(/id="typeSheet"[\s\S]*build d27m/, "type sheet stamp is d27m");
must(/build d27m: media mux \+ captions/, "file header names the mux + caption stamp");

must(/function liveDamageCaption\(/, "live caption helper exists");
must(/function stampBanner\(/, "caption burn exists");
must(/function walkRecStream\(/, "walk recorder builds a muxed stream");
must(/function startWalkSessionAudio\(/, "session audio is recorded beside video");
must(/function muxVideoAudio\(/, "separate audio can be muxed onto video");
must(/function finalizeWalkClip\(/, "clips are finalized only when they have picture");
must(/function playableWalkClips\(/, "packet/PDF use playable clips only");
must(/function withEmbeddedClips\(/, "PDF attaches the muxed walk clip");
must(/function clipPoster\(/, "PDF video page uses a real poster frame");
must(/pdf-lib@1\.17\.1/, "PDF embed uses pdf-lib attach");
must(/picture \+ sound, embedded in this PDF/, "PDF catalog says the clip is in the file");
must(/<video class="full" src="'\+src\+'" controls playsinline/, "in-app packet plays the muxed clip");
must(/stampOnUrl\(data, cap\)/, "keepShot burns the spoken line into saved bytes");
must(/APP\.recorder\.start\(200\)/, "walk recorder uses timesliced chunks");
must(/videoBitsPerSecond:3500000/, "walk bitrate stays encoder-friendly");
must(/SAID THIS/, "caption overlay has sales-grade label");
must(/rgba\(0, 214, 255/, "caption overlay is bright cyan, not a dark debug strip");

mustNot(/clipLine\+"  — attached to the email\."/, "PDF no longer claims the video is on the email");
mustNot(/if\(!isDamageNote\(raw\) && raw!=="Voice note"\) return;/, "live captions are not dropped by the story-dump gate");

const shareStart = html.indexOf("async function sharePacket(){");
const shareEnd = html.indexOf("\nfunction resetAll()", shareStart);
const share = html.slice(shareStart, shareEnd);
const kick = html.slice(html.indexOf("function kickShare(){"), html.indexOf("\nfunction packetSendId("));
const send = html.slice(html.indexOf("async function sendFromMe("), html.indexOf("\nfunction openEml("));
const guest = html.slice(html.indexOf("function finishGuest(){"), html.indexOf("\nfunction paintGuestStory("));
assert.ok(/sentOk=true;\s*finish\(""\);\s*try\{ finishGuest\(\); \}/.test(share), "sharePacket Thank you path stays");
assert.ok(/sharePacket\(\);/.test(kick), "kickShare still sends");
assert.ok(/stripMailVideoParts\(parts\)/.test(send), "sendFromMe still strips mail video");
assert.ok(/finishThanks\(\);/.test(guest), "finishGuest still Thank you only");
assert.ok(!/muxVideoAudio\(/.test(share), "sharePacket body was not edited for mux");
assert.ok(!/stampBanner\(/.test(share), "sharePacket body was not edited for captions");

const sandbox = {
  APP: {
    clips: [
      { blob: { size: 12000, type: "video/mp4" }, dur: 5400, mime: "video/mp4", hasVideo: true, audioOnly: false },
      { blob: { size: 4000, type: "audio/webm" }, dur: 5400, mime: "audio/webm", hasVideo: false, audioOnly: true }
    ]
  },
  videoExt: function (v) {
    const t = (v && v.type) || "";
    if (/webm/i.test(t)) return "webm";
    return "mp4";
  }
};
vm.createContext(sandbox);
vm.runInContext(
  sliceFn("playableWalkClips", "clipExt") +
  sliceFn("clipExt", "walkRecStream") +
  sliceFn("liveDamageCaption", "stampBanner") +
  sliceFn("recClock", "paintRec") +
  "this.playableWalkClips=playableWalkClips;this.clipExt=clipExt;" +
  "this.liveDamageCaption=liveDamageCaption;this.recClock=recClock;",
  sandbox
);

const playable = sandbox.playableWalkClips();
assert.equal(playable.length, 1, "audio-only blobs never become the packet video");
assert.equal(sandbox.clipExt(playable[0]), "mp4");
assert.equal(sandbox.recClock(5400), "0:05");
assert.equal(sandbox.liveDamageCaption("Listening… describe the damage"), "");
assert.equal(sandbox.liveDamageCaption("crack in the windshield"), "crack in the windshield");

must(/function landIncomingPacket\(/, "incoming land helper stays");
const land = html.slice(html.indexOf("function landIncomingPacket("), html.indexOf("\nfunction isMailVideoPart("));
assert.ok(/persistCenterMedia\(item\.id, photos, docs\)/.test(land), "incoming land still persists photos + docs only");
assert.ok(!/playableWalkClips/.test(land), "incoming land behavior was not rewritten");

console.log("media-mux-captions: ok");
