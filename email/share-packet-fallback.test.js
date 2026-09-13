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

function must(re, msg) {
  assert.ok(re.test(src), msg);
}
function mustNot(re, msg) {
  assert.ok(!re.test(src), msg);
}

must(/const guest=APP\.role==="guest"/, "sharePacket branches on guest");
must(/function revealMail\(\)\{/, "staff still has revealMail");
must(/if\(guest\)\{ hideMailOpen\(\); return; \}/, "revealMail is a no-op for guests");
must(/if\(guest\) hideMailOpen\(\);/, "guest start never unhides mail");
must(/Couldn’t send — try again/, "guest failure is retry, not mail homework");
must(/if\(guest\) finish\("Couldn’t send — try again", false\)/, "guest fail does not open mail");
must(/sentOk=true;\s*finish\(""\);\s*try\{ finishGuest\(\); \}/, "guest success is Thank you only");
must(/if\(guest\) hideMailOpen\(\);/, "finally keeps guest mail hidden");
mustNot(/Open Mail and send/, "guest never sees Open Mail and send");
must(/if\(guest\) finish\("Couldn’t send — try again", false\);\s*else finish\("Still working — tap Open Gmail and send\.", true\)/, "guest watch is retry; staff hang still offers Gmail");
must(/if\(!sentOk\) revealMail\(\);|else if\(!sentOk\) revealMail\(\);/, "staff fail still reveals mail");
must(/pushVoiceParts\(parts, shots\)/, "Send attaches spoken damage audio with the photos");

assert.ok(/function hideMailOpen\(\)\{/.test(html), "hideMailOpen exists");
assert.ok(/if\(APP\.role==="guest"\)\{ hideMailOpen\(\); return ""; \}/.test(html), "revealMailOpen never shows mail to guests");
assert.ok(/function kickShare\(\)\{/.test(html), "kickShare exists");
assert.ok(/if\(APP\.role==="guest"\) hideMailOpen\(\);/.test(html), "kickShare hides mail for guests");
assert.ok(/sharePacket\(\);/.test(html), "kickShare sends without a Gmail wall");
assert.ok(!/requestGmailThenSend\(\)/.test(html.slice(html.indexOf("function kickShare()"), html.indexOf("function packetSendId("))), "guest/staff Send does not require Gmail OAuth first");
assert.ok(/if\(guest\) hideMailOpen\(\);/.test(html), "paintSubmit / applyRole hide guest mail");
assert.ok(/store:\s*true/.test(html), "sendFromMe asks the store sender when token/mk are empty");
assert.ok(!/Open Mail and send/.test(html), "Open Mail and send copy is gone from the SPA");

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
  const href = "mailto:shawn@gmautosales.ca?subject=test";
  const APP = { role: opts.role || "guest", screen: opts.screen || "submit" };
  const guest = APP.role === "guest";
  const toasts = [];
  function hideMailOpen() { mail.classList.add("hide"); }
  function revealMail() {
    if (guest) { hideMailOpen(); return; }
    mail.href = href;
    mail.textContent = "Open Gmail and send";
    mail.classList.remove("hide");
  }
  let finished = false;
  let sentOk = false;
  function finish(msg, openMail) {
    finished = true;
    btn.disabled = false;
    btn.textContent = "Send";
    if (guest) hideMailOpen();
    else if (openMail) revealMail();
    if (msg) toasts.push(msg);
  }
  function simulate(result) {
    if (result && result.ok && result.verified) {
      finished = true;
      if (guest) {
        sentOk = true;
        finish("");
        if (opts.guestLandsOnThanks) APP.screen = "thanks";
      } else {
        sentOk = true;
        finish("Sent to the team.");
      }
    } else {
      if (guest) finish("Couldn’t send — try again", false);
      else finish("Couldn’t send from here. Tap Open Gmail and send.", true);
    }
    btn.disabled = false;
    btn.textContent = "Send";
    if (guest) hideMailOpen();
    else if (!sentOk) revealMail();
    else if (APP.screen !== "thanks") mail.classList.add("hide");
  }
  simulate(opts.sent);
  return { mail, btn, toasts, finished, sentOk, APP };
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
assert.ok(!timedOut.mail.classList.contains("hide"), "timeout/fail must unhide #mailOpen for staff");
assert.equal(timedOut.mail.textContent, "Open Gmail and send");

const guestSilent = runFinishContract({ role: "guest", sent: { ok: true, verified: true }, guestLandsOnThanks: true });
assert.equal(guestSilent.sentOk, true);
assert.equal(guestSilent.APP.screen, "thanks");
assert.ok(guestSilent.mail.classList.contains("hide"), "guest success never shows mail");
assert.deepEqual(guestSilent.toasts, []);

const staffOk = runFinishContract({ role: "employee", sent: { ok: true, verified: true } });
assert.equal(staffOk.sentOk, true);
assert.ok(staffOk.mail.classList.contains("hide"), "successful staff send keeps fallback hidden");
assert.ok(staffOk.toasts.some(t => /Sent to/.test(t)));

const copies = ["404.html", "inspect-vehicle.html"].map(f => fs.readFileSync(path.join(__dirname, "..", f), "utf8"));
for (const copy of copies) {
  const a = copy.indexOf("async function sharePacket(){");
  const b = copy.indexOf("\nfunction resetAll()", a);
  assert.equal(copy.slice(a, b), src, "HTML copies must keep the same sharePacket");
}

console.log("share-packet-fallback: ok");
