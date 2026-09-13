#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const vm = require("vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const upload = require(path.join(root, "api/upload"));
const sms = require(path.join(root, "api/lib/sms"));

function must(re, msg) {
  assert.ok(re.test(html), msg);
}
function mustNot(re, msg) {
  assert.ok(!re.test(html), msg);
}

const invStart = html.indexOf("async function sendTradeInvite(){");
const invEnd = html.indexOf("\nfunction logOut()", invStart);
assert.ok(invStart > 0 && invEnd > invStart, "sendTradeInvite found");
const invSrc = html.slice(invStart, invEnd);

must(/async function sendInviteSms\(/, "silent invite SMS helper exists");
must(/kind:"sms"/, "client posts kind:sms to the mailer");
must(/MAIL_HOST\+"\/api\/upload"/, "invite SMS hits /api/upload");
must(/function senderFirst\(/, "staff sender name helper exists");
must(/APP\._thanksKind==="invite"/, "paintThanks branches for invite Send");
must(/The appraisal link is on its way\. Thanks for sending it\./, "invite Thank you thanks the sender");
must(/We've got your vehicle\. We're getting to work for you right now/, "packet Thank you copy stays");
must(/The packet is with the team/, "staff packet Thank you copy stays");
must(/You can close this page\. We'll be in touch\./, "guest packet Thank you copy stays");
must(/text "\+formatPhoneMask\(phone\)\+" the link/, "preview is silent text, not Messages homework");
mustNot(/Tap Send in Messages if it opens/, "preview no longer asks staff to tap Messages");
assert.ok(/sendInviteSms\(phone, sms\)/.test(invSrc), "Send awaits silent invite SMS");
assert.ok(!/fireSms\(/.test(invSrc), "Send does not open sms: composer");
assert.ok(/smsBtn\.classList\.add\("hide"\)/.test(invSrc), "Send keeps #invSmsBtn hidden");
assert.ok(/APP\._thanksKind="invite"/.test(invSrc), "success marks invite Thank you");
assert.ok(/try\{ finishGuest\(\); \}/.test(invSrc), "invite success still uses the Thank you screen");
assert.ok(/sentOk=true;\s*finish\(""\);\s*try\{ finishGuest\(\); \}/.test(html), "packet success is still Thank you");
assert.ok(!/TWILIO_AUTH_TOKEN\s*=\s*['"]/.test(html), "Twilio secrets stay off the client");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

(async function testMailerSms() {
  const empty = await upload.route({ kind: "sms" }, {
    sendSms: async function () { return { ok: false, skipped: "no-phone" }; }
  });
  assert.strictEqual(empty.status, 400, "SMS without a cell is empty");
  assert.deepStrictEqual(empty.body, { ok: false, error: "empty" });

  const noTwilio = await upload.route({ kind: "sms", to: "6135550162", text: "Hi Jane\nhttps://x" }, {
    env: {},
    log: { log: function () {} },
    sendSms: async function () { return { ok: false, skipped: "twilio" }; }
  });
  assert.strictEqual(noTwilio.status, 503);
  assert.strictEqual(noTwilio.body.skipped, "twilio");

  const calls = [];
  const sent = await upload.route({
    kind: "sms",
    to: "(613) 555-0162",
    text: "Hi Jane, it's Shawn. Private link…\n\nhttps://carmojiguy.github.io/?trade=1"
  }, {
    sendSms: async function (to, text) {
      calls.push({ to: to, text: text });
      return { ok: true, sid: "SM-invite", to: sms.toE164(to) };
    }
  });
  assert.strictEqual(sent.status, 200);
  assert.strictEqual(sent.body.ok, true);
  assert.strictEqual(sent.body.via, "twilio");
  assert.strictEqual(sent.body.sid, "SM-invite");
  assert.strictEqual(calls.length, 1, "one Twilio send");
  assert.ok(/Private link/.test(calls[0].text), "invite copy is the SMS body");

  const mail = await upload.route({ kind: "send", to: "shawn@gmautosales.ca", subject: "x", text: "hi" });
  assert.strictEqual(mail.body.ok, false);
  assert.strictEqual(mail.body.error, "mailer");
  assert.strictEqual(mail.status, 401);
})().then(function () {
  const paintFrom = html.indexOf("function customerFirst(){");
  const paintTo = html.indexOf("function finishGuest()", paintFrom);
  assert.ok(paintFrom > 0 && paintTo > paintFrom, "thanks helpers found");
  function el() {
    return {
      textContent: "",
      src: "",
      className: "",
      classList: {
        toggle: function () {},
        add: function () {},
        remove: function () {}
      },
      removeAttribute: function () {}
    };
  }
  const nodes = {
    thanks: el(),
    thanksHello: el(),
    thanksLead: el(),
    thanksSoft: el(),
    thanksCaption: el(),
    thanksDone: el(),
    thanksBg: el()
  };
  const sandbox = {
    APP: {
      role: "employee",
      userName: "Shawn Carmichael",
      userEmail: "shawn@myloan.ca",
      inviteName: "Maya Patel",
      _thanksKind: "invite",
      photos: {}
    },
    $: function (id) { return nodes[id] || null; },
    capturedFiles: function () { return []; },
    composePaparazziHero: function () { return Promise.resolve(""); },
    nameForEmail: function (email) { return String(email || "").split("@")[0]; }
  };
  vm.createContext(sandbox);
  vm.runInContext(
    html.slice(paintFrom, paintTo) +
      "\nthis.senderFirst=senderFirst; this.customerFirst=customerFirst; this.paintThanks=paintThanks;",
    sandbox
  );
  assert.equal(sandbox.senderFirst(), "Shawn", "sender is Shawn");
  assert.equal(sandbox.customerFirst(), "Maya", "customer stays Maya");
  sandbox.paintThanks();
  assert.equal(nodes.thanksHello.textContent, "Thank you, Shawn.");
  assert.equal(nodes.thanksLead.textContent, "The appraisal link is on its way. Thanks for sending it.");
  assert.equal(nodes.thanksSoft.textContent, "You can keep going whenever you’re ready.");
  assert.ok(!/We've got your vehicle/.test(nodes.thanksLead.textContent), "invite is not customer thank-you");

  sandbox.APP._thanksKind = "";
  sandbox.paintThanks();
  assert.equal(nodes.thanksHello.textContent, "Thank you, Maya.");
  assert.ok(/We've got your vehicle/.test(nodes.thanksLead.textContent), "packet Send still thanks the customer");
  assert.ok(/The packet is with the team/.test(nodes.thanksSoft.textContent), "staff packet copy stays");

  console.log("invite-sms: ok");
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
