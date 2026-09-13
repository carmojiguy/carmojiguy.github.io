#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const vm = require("vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function must(re, msg) {
  assert.ok(re.test(html), msg);
}

must(/id="thanksCaption"/, "witty paparazzi caption");
must(/You're famous now/, "famous-now caption");
must(/Caught in the wild/, "caught-in-the-wild caption");
must(/class="thanks-paps"/, "paparazzi cameras");
must(/class="thanks-flash thanks-flash-a"/, "camera flashes");
must(/class="thanks-confetti"/, "confetti spark");
must(/function composePaparazziHero\(/, "local canvas composite");
must(/function thanksHeroPhoto\(/, "hero photo picker");
must(/THANKS_EXTERIOR=\["qfront"/, "¾ front is the first hero slot");
must(/function finishThanks\(/, "shared Thank you finisher");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "guest and staff Send both call finishGuest → finishThanks");
must(/sentOk=true;\s*finish\(""\);\s*try\{ finishGuest\(\); \}/, "silent-mailer success is Thank you for guest and staff");
must(/stashThanksHero\(\)/, "success stashes the ¾ hero before Thank you");
must(/id="thanksDone">Back to Center/, "staff can leave Thank you");
must(/You can close this page\. We'll be in touch\./, "guest one-tap close copy");
must(/The packet is with the team/, "staff Thank you copy");
must(/#thanks\.on \{[^}]*background:linear-gradient/, "bright Thank you background");
must(/id==="thanks" && !APP\._thanksHeroSrc/, "vehicle hero is not replaced by a stock start-bg");
mustNotBounceToGoogle();

function mustNotBounceToGoogle() {
  const start = html.indexOf("async function sharePacket(){");
  const end = html.indexOf("\nfunction resetAll()", start);
  const src = html.slice(start, end);
  const kick = html.slice(html.indexOf("function kickShare(){"), html.indexOf("\nfunction packetSendId("));
  assert.ok(/hideMailOpen\(\)/.test(src), "Send always hides #mailOpen");
  assert.ok(!/Open Mail and send/.test(src), "no Open Mail homework");
  assert.ok(!/Open Gmail and send/.test(src), "no Open Gmail homework on Send");
  assert.ok(!/requestGmailThenSend\(/.test(src), "sharePacket never starts GIS Send OAuth");
  assert.ok(!/oauthRedirectForSend\(/.test(src), "sharePacket never redirects to Google for Send");
  assert.ok(!/requestGmailThenSend\(/.test(kick), "kickShare never starts a Google chooser");
  assert.ok(!/oauthRedirectForSend\(/.test(kick), "kickShare never redirects to Google");
  assert.ok(/sharePacket\(\);/.test(kick), "kickShare always goes to the silent mailer");
}

const from = html.indexOf("const THANKS_EXTERIOR=");
const to = html.indexOf("function thanksPopLine()", from);
assert.ok(from > 0 && to > from, "thanks hero helpers found");
const sandbox = {
  APP: { photos: { driver: "side", qfront: "hero-3q", dash: "inside" } },
  capturedFiles: function () { return []; }
};
vm.createContext(sandbox);
vm.runInContext(html.slice(from, to) + "\nthis.thanksHeroPhoto=thanksHeroPhoto; this.stashThanksHero=stashThanksHero;", sandbox);
assert.equal(sandbox.thanksHeroPhoto(), "hero-3q", "prefers ¾ front over other walk shots");

sandbox.APP = { photos: { dash: "inside", rear: "tail", interior: "cabin" } };
assert.equal(sandbox.thanksHeroPhoto(), "tail", "falls back to the next exterior hero");

sandbox.APP = { photos: { dash: "inside", interior: "cabin" }, _thanksHeroSrc: "" };
sandbox.capturedFiles = function () {
  return [
    { kind: "walk", view: "dash", data: "dash-data" },
    { kind: "walk", view: "front", data: "front-data" }
  ];
};
assert.equal(sandbox.thanksHeroPhoto(), "front-data", "walk catalog can supply an exterior fallback");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("thanks-paparazzi: ok");
