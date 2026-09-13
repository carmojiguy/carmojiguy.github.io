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

must(/let sentOk=false/, "tracks whether silent send actually succeeded");
must(/function revealMail\(\)\{/, "has revealMail helper");
must(/finished=true;/, "finish() always marks finished");
must(/if\(!sentOk\) revealMail\(\);/, "finally reveals #mailOpen when send did not succeed");
must(/if\(APP\.screen==="thanks"\) sentOk=true;/, "guest success counts only after thanks screen");
mustNot(/openMail===false && msg/, "old finished-flag condition that never fired on fallback is gone");
mustNot(/clearTimeout\(watch\);\s*if\(sent && sent\.ok\)/, "do not cancel the hang watch before slim retry / finish");

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
  const toasts = [];
  function revealMail() {
    mail.href = href;
    mail.textContent = APP.role === "employee" ? "Open Gmail and send" : "Open Mail and send";
    mail.classList.remove("hide");
  }
  let finished = false;
  let sentOk = false;
  function finish(msg, openMail) {
    finished = true;
    btn.disabled = false;
    btn.textContent = "Send";
    if (openMail) revealMail();
    if (msg) toasts.push(msg);
  }
  function simulate(result) {
    if (result && result.ok) {
      finished = true;
      if (APP.role === "guest") {
        finish("");
        if (opts.guestLandsOnThanks) APP.screen = "thanks";
        if (APP.screen === "thanks") sentOk = true;
        else finish("Couldn’t send from here. Tap the mail button.", true);
      } else {
        sentOk = true;
        finish("Sent to the team.");
      }
    } else {
      finish("Couldn’t send from here. Tap the mail button.", true);
    }
    btn.disabled = false;
    btn.textContent = "Send";
    if (!sentOk) revealMail();
    else if (APP.screen !== "thanks") mail.classList.add("hide");
  }
  simulate(opts.sent);
  return { mail, btn, toasts, finished, sentOk, APP };
}

const failedGuest = runFinishContract({ role: "guest", sent: { ok: false } });
assert.equal(failedGuest.finished, true);
assert.equal(failedGuest.sentOk, false);
assert.ok(!failedGuest.mail.classList.contains("hide"), "failed guest send must unhide #mailOpen");
assert.equal(failedGuest.mail.textContent, "Open Mail and send");
assert.ok(failedGuest.mail.href.startsWith("mailto:"));
assert.equal(failedGuest.btn.textContent, "Send");
assert.equal(failedGuest.btn.disabled, false);
assert.ok(failedGuest.toasts.some(t => /mail button/i.test(t)));

const timedOut = runFinishContract({ role: "employee", sent: { ok: false } });
assert.ok(!timedOut.mail.classList.contains("hide"), "timeout/fail must unhide #mailOpen for staff");
assert.equal(timedOut.mail.textContent, "Open Gmail and send");

const guestSilent = runFinishContract({ role: "guest", sent: { ok: true }, guestLandsOnThanks: false });
assert.equal(guestSilent.sentOk, false);
assert.ok(!guestSilent.mail.classList.contains("hide"), "guest success that does not reach thanks is not a silent no-op");

const guestThanks = runFinishContract({ role: "guest", sent: { ok: true }, guestLandsOnThanks: true });
assert.equal(guestThanks.sentOk, true);
assert.equal(guestThanks.APP.screen, "thanks");

const staffOk = runFinishContract({ role: "employee", sent: { ok: true } });
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
