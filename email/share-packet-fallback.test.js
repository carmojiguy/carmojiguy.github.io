#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const htmlPath = path.join(__dirname, "..", "index.html");
const html = fs.readFileSync(htmlPath, "utf8");
const start = html.indexOf("async function sharePacket(){");
const end = html.indexOf("\nfunction resetAll()", start);
assert.ok(start > 0 && end > start, "sharePacket not found");
const src = html.slice(start, end);

const kickStart = html.indexOf("function kickShare(){");
const kickEnd = html.indexOf("\nfunction packetSendId(", kickStart);
assert.ok(kickStart > 0 && kickEnd > kickStart, "kickShare not found");
const kick = html.slice(kickStart, kickEnd);

const sendStart = html.indexOf("async function sendFromMe(");
const sendEnd = html.indexOf("\nfunction openEml(", sendStart);
assert.ok(sendStart > 0 && sendEnd > sendStart, "sendFromMe not found");
const sendSrc = html.slice(sendStart, sendEnd);

function must(re, msg) {
  assert.ok(re.test(src), msg);
}
function mustNot(re, msg) {
  assert.ok(!re.test(src), msg);
}

must(/const guest=APP\.role==="guest"/, "sharePacket still notes the guest role");
must(/function revealMail\(\)\{/, "revealMail stays as a hide-only helper");
must(/hideMailOpen\(\)/, "sharePacket always hides #mailOpen");
must(/Couldn’t send — try again/, "failure is retry, not mail homework");
must(/finish\("Couldn’t send — try again", false\)/, "fail does not open mail");
must(/sentOk=true;\s*finish\(""\);\s*try\{ finishGuest\(\); \}/, "success is Thank you for guest and staff");
must(/landIncomingPacket/, "success lands Incoming before Thank you");
mustNot(/Open Gmail and send/, "sharePacket never unhides Open Gmail");
mustNot(/Tap Open Gmail/, "staff fail is not Gmail homework");
mustNot(/requestGmailThenSend\(/, "sharePacket never starts GIS Send OAuth");
mustNot(/oauthRedirectForSend\(/, "sharePacket never redirects to Google for Send");
mustNot(/classList\.remove\("hide"\)/, "sharePacket never unhides #mailOpen");
must(/pushVoiceParts\(parts, shots\)/, "Send attaches spoken damage audio with the photos");

assert.ok(/function hideMailOpen\(\)\{/.test(html), "hideMailOpen exists");
assert.ok(/if\(APP\.role==="guest"\)\{ hideMailOpen\(\); return ""; \}/.test(html), "revealMailOpen never shows mail to guests");
assert.ok(/function kickShare\(\)\{/.test(html), "kickShare exists");
assert.ok(/hideMailOpen\(\);/.test(kick), "kickShare hides #mailOpen before Send");
assert.ok(/sharePacket\(\);/.test(kick), "kickShare sends without a Gmail wall");
assert.ok(!/requestGmailThenSend\(/.test(kick), "kickShare does not call requestGmailThenSend");
assert.ok(!/oauthRedirectForSend\(/.test(kick), "kickShare does not call oauthRedirectForSend");
assert.ok(!/revealMailOpen\(/.test(kick), "kickShare does not reveal Open Gmail");
assert.ok(/store:\s*true/.test(html), "sendFromMe asks the store sender when token/mk are empty");
assert.ok(/token:""/.test(sendSrc), "sendFromMe posts an empty client token");
assert.ok(!/gmail\.googleapis\.com/.test(sendSrc), "sendFromMe does not use the Gmail API as a Send path");
assert.ok(!/Open Mail and send/.test(html), "Open Mail and send copy is gone from the SPA");
assert.ok(!/\/api\/send/.test(html), "Send posts /api/upload, never /api/send");
assert.ok(html.indexOf('MAIL_HOST="/') === -1 && /MAIL_HOST="https:\/\/gnm-guest-mailer-shawn-6802\.vercel\.app"/.test(html), "MAIL_HOST stays on the live store mailer");
assert.ok(/timedFetch\(MAIL_HOST\+"\/api\/upload"/.test(html), "sendFromMe posts kind:send to /api/upload");
assert.ok(/function paintThanks\(\)\{/.test(html) && /show\("thanks"\)/.test(html), "Thank you screen helpers stay");

class FakeEl {
  constructor(id, className) {
    this.id = id;
    this.className = className || "";
    this.href = "#";
    this.textContent = "";
    this.disabled = false;
    const el = this;
    this.classList = {
      add(c) { if (!el.className.split(/\s+/).includes(c)) el.className = (el.className + " " + c).trim(); },
      remove(c) { el.className = el.className.split(/\s+/).filter(x => x && x !== c).join(" "); },
      contains(c) { return el.className.split(/\s+/).includes(c); }
    };
  }
}

function runFinishContract(opts) {
  const mail = new FakeEl("mailOpen", "pill cyan hide");
  const btn = new FakeEl("btnSharePack");
  btn.textContent = "Sending…";
  btn.disabled = true;
  const APP = { role: opts.role || "guest", screen: opts.screen || "submit" };
  const toasts = [];
  function hideMailOpen() { mail.classList.add("hide"); }
  function revealMail() {
    hideMailOpen();
  }
  let finished = false;
  let sentOk = false;
  function finish(msg) {
    finished = true;
    btn.disabled = false;
    btn.textContent = "Send";
    hideMailOpen();
    if (msg) toasts.push(msg);
  }
  function simulate(result) {
    if (result && result.ok && result.verified) {
      sentOk = true;
      finish("");
      APP.screen = "thanks";
    } else {
      finish("Couldn’t send — try again");
    }
    btn.disabled = false;
    btn.textContent = "Send";
    hideMailOpen();
  }
  simulate(opts.sent);
  return { mail, btn, toasts, finished, sentOk, APP, revealMail };
}

const failedGuest = runFinishContract({ role: "guest", sent: { ok: false } });
assert.equal(failedGuest.finished, true);
assert.equal(failedGuest.sentOk, false);
assert.ok(failedGuest.mail.classList.contains("hide"), "failed guest send must NEVER unhide #mailOpen");
assert.notEqual(failedGuest.mail.textContent, "Open Mail and send");
assert.equal(failedGuest.btn.textContent, "Send");
assert.equal(failedGuest.btn.disabled, false);
assert.ok(failedGuest.toasts.some(t => /try again/i.test(t)), "guest fail is retry");
assert.ok(!failedGuest.toasts.some(t => /Gmail|Mail and send|mail button/i.test(t)), "guest fail is not mail homework");

const timedOut = runFinishContract({ role: "employee", sent: { ok: false } });
assert.ok(timedOut.mail.classList.contains("hide"), "timeout/fail must NEVER unhide #mailOpen for staff");
assert.notEqual(timedOut.mail.textContent, "Open Gmail and send");
assert.equal(timedOut.btn.textContent, "Send");
assert.equal(timedOut.btn.disabled, false);
assert.ok(timedOut.toasts.some(t => /Couldn’t send — try again/.test(t)), "staff fail is retry toast only");
assert.ok(!timedOut.toasts.some(t => /Gmail|Mail and send|mail button/i.test(t)), "staff fail is not Gmail homework");
assert.equal(timedOut.APP.screen, "submit", "staff fail stays on submit");

const guestSilent = runFinishContract({ role: "guest", sent: { ok: true, verified: true } });
assert.equal(guestSilent.sentOk, true);
assert.equal(guestSilent.APP.screen, "thanks");
assert.ok(guestSilent.mail.classList.contains("hide"), "guest success never shows mail");
assert.deepEqual(guestSilent.toasts, []);

const staffOk = runFinishContract({ role: "employee", sent: { ok: true, verified: true } });
assert.equal(staffOk.sentOk, true);
assert.equal(staffOk.APP.screen, "thanks", "staff success lands on Thank you");
assert.ok(staffOk.mail.classList.contains("hide"), "successful staff send keeps fallback hidden");
assert.deepEqual(staffOk.toasts, [], "staff success is Thank you, not a toast-only Sent");

const copies = ["404.html", "inspect-vehicle.html"].map(f => fs.readFileSync(path.join(__dirname, "..", f), "utf8"));
for (const copy of copies) {
  const a = copy.indexOf("async function sharePacket(){");
  const b = copy.indexOf("\nfunction resetAll()", a);
  assert.equal(copy.slice(a, b), src, "HTML copies must keep the same sharePacket");
}

console.log("share-packet-fallback: ok");
