#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const api = require(path.join(root, "api/notify-appraisal"));
const store = require(path.join(root, "api/lib/notify-store"));
const sms = require(path.join(root, "api/lib/sms"));
const upload = require(path.join(root, "api/upload"));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));

assert.ok(sms.toE164("(613) 555-0162") === "+16135550162", "roster phones normalize to E.164");
assert.ok(sms.toE164("+16135550100") === "+16135550100", "E.164 is preserved");
assert.strictEqual(sms.twilioConfigured({}), false, "Twilio is off without env");

const rfc = upload.buildRfc822({
  to: "wes@thetrucktown.com",
  subject: "Needs docs",
  text: "hi",
  importance: "high"
}, "store@gmautosales.ca");
assert.ok(rfc.indexOf("Importance: high") >= 0, "RFC has Importance: high");
assert.ok(rfc.indexOf("X-Priority: 1") >= 0, "RFC has X-Priority: 1");
assert.ok(rfc.indexOf("X-MSMail-Priority: High") >= 0, "RFC has X-MSMail-Priority");

const job = {
  lane: "incomplete-leader",
  vehicle: "2021 Hyundai Tucson",
  customer: "Sam Rivera",
  vin: "KM8J3CAL5MU123456",
  salesperson: "Jay Cyr",
  missing: ["OpenLane Forecast", "eBlock Market Guide"]
};
const mail = api.buildAlertEmail(job, false);
assert.ok(mail.importance === "high", "leader email is high importance");
assert.ok(/Needs docs/.test(mail.subject), "leader subject names the queue");
assert.ok(mail.text.indexOf("Sam Rivera") >= 0, "leader email names the customer");
assert.ok(mail.text.indexOf("KM8J3CAL5MU123456") >= 0, "leader email has VIN");
assert.ok(mail.text.indexOf("OpenLane Forecast") >= 0, "leader email lists missing docs");
const smsCopy = api.buildAlertSms(job, false);
assert.ok(/Needs docs/.test(smsCopy), "SMS is the short alert");
assert.ok(smsCopy.length <= 320, "SMS stays short");
const remind = api.buildAlertEmail(job, true);
assert.ok(/^Reminder:/.test(remind.subject), "15m pass is a reminder");

const onsite = api.buildAlertEmail({
  lane: "onsite-attention",
  vehicle: "2023 GR Corolla",
  salesperson: "Isabella"
}, false);
assert.ok(/On-site/.test(onsite.subject), "on-site nag subject");
assert.deepStrictEqual(api.jobTargets({ lane: "onsite-attention" }, {}), {
  emails: ["shawn@myloan.ca"],
  phones: []
}, "on-site email ships with no Shawn cell");
assert.deepStrictEqual(api.jobTargets({ lane: "onsite-attention" }, { SHAWN_SMS_TO: "+16135550111" }).phones, ["+16135550111"]);

(async function () {
  const mem = { jobs: [] };
  const sent = [];
  const texts = [];
  const deps = {
    memory: mem,
    now: function () { return 1_700_000_000_000; },
    interval: store.INTERVAL_MS,
    env: {},
    log: { log: function () {} },
    sendEmail: async function (body) {
      sent.push(body);
      return { ok: true, id: "m" + sent.length };
    },
    sendSms: async function (to, body) {
      texts.push({ to: to, body: body });
      return { ok: false, skipped: "twilio" };
    }
  };

  const up = await api.route({
    kind: "upsert",
    lane: "incomplete-leader",
    id: "c-docs-1",
    email: "wes@thetrucktown.com",
    emails: ["wes@thetrucktown.com"],
    vehicle: "2021 Tucson",
    customer: "Sam Rivera",
    salesperson: "Jay",
    missing: ["OpenLane Forecast"]
  }, deps);
  assert.strictEqual(up.body.ok, true, "upsert registers the job");
  assert.strictEqual(up.body.notified, true, "email-only nag counts as notified");
  assert.strictEqual(sent.length, 1, "immediate high-importance email");
  assert.strictEqual(sent[0].importance, "high");
  assert.strictEqual(texts.length, 0, "no SMS attempt when no cell is stored");
  assert.ok(up.body.sms[0].skipped === "no-phone", "SMS skipped without a Users cell or SHAWN_SMS_TO");

  deps.now = function () { return 1_700_000_000_000 + 5 * 60 * 1000; };
  const early = await api.route({ kind: "tick" }, deps);
  assert.strictEqual(early.body.due, 0, "no nag before 15 minutes");

  deps.now = function () { return 1_700_000_000_000 + 15 * 60 * 1000; };
  const due = await api.route({ kind: "tick" }, deps);
  assert.strictEqual(due.body.due, 1, "cron re-notifies at 15 minutes");
  assert.ok(/^Reminder:/.test(sent[1].subject), "follow-up is a reminder");

  const stop = await api.route({ kind: "complete", id: "c-docs-1" }, deps);
  assert.strictEqual(stop.body.stopped, 1, "complete stops the job");
  deps.now = function () { return 1_700_000_000_000 + 40 * 60 * 1000; };
  const after = await api.route({ kind: "tick" }, deps);
  assert.strictEqual(after.body.due, 0, "completed jobs are not re-nagged");

  const site = await api.route({
    kind: "upsert",
    lane: "onsite-attention",
    id: "c-lot-1",
    vehicle: "2023 GR Corolla",
    salesperson: "Isabella"
  }, Object.assign({}, deps, { env: {} }));
  assert.strictEqual(site.body.ok, true, "on-site nag registers without SHAWN_SMS_TO");
  assert.strictEqual(site.body.notified, true, "on-site email is enough to ship");
  assert.ok(sent[sent.length - 1].to.indexOf("shawn@myloan.ca") >= 0, "on-site email goes to Shawn");
  assert.ok(site.body.sms[0].skipped === "no-phone", "on-site SMS stays optional");

  assert.ok(vercel.crons && vercel.crons.some(function (c) {
    return c.path === "/api/notify-appraisal" && c.schedule === "*/15 * * * *";
  }), "Vercel cron every 15 minutes");
  assert.ok(fs.existsSync(path.join(root, "api/notify-appraisal.js")), "notify API exists");
  assert.ok(/TWILIO_ACCOUNT_SID/.test(fs.readFileSync(path.join(root, "api/notify-appraisal.js"), "utf8")), "Twilio env is documented");
  assert.ok(/SHAWN_SMS_TO/.test(fs.readFileSync(path.join(root, "api/notify-appraisal.js"), "utf8")), "SHAWN_SMS_TO is documented");
  assert.ok(html.indexOf("/api/notify-appraisal") >= 0, "SPA posts to the mailer notify route");
  assert.ok(!/TWILIO_AUTH_TOKEN\s*=\s*['"]/.test(html), "Twilio secrets stay off the client");

  console.log("notify-appraisal: ok");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
