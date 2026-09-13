#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const api = fs.readFileSync(path.join(__dirname, "..", "api", "upload.js"), "utf8");

assert.ok(/store:\s*true/.test(html), "client asks the API for the store sender");
assert.ok(/kind:"send"/.test(html), "client still posts kind:send");
const MAIL_HOST = "https://gnm-guest-mailer-shawn-6802.vercel.app";
assert.ok(html.indexOf('MAIL_HOST="'+MAIL_HOST+'"') >= 0, "staff + guest hit the live store mailer");
assert.ok(!/trade-in-shawn-/.test(html), "old sandbox mailer host is gone from the SPA");
const oauth = fs.readFileSync(path.join(__dirname, "..", "oauth.html"), "utf8");
assert.ok(oauth.indexOf(MAIL_HOST+"/api/upload") >= 0, "oauth.html code-exchange hits the live store mailer");
assert.ok(!/trade-in-shawn-/.test(oauth), "oauth.html no longer hits the old sandbox");

assert.ok(/GOOGLE_REFRESH_TOKEN/.test(api), "store path uses GOOGLE_REFRESH_TOKEN");
assert.ok(/GOOGLE_CLIENT_ID/.test(api), "documents GOOGLE_CLIENT_ID");
assert.ok(/GOOGLE_CLIENT_SECRET/.test(api), "documents GOOGLE_CLIENT_SECRET");
assert.ok(/GOOGLE_SERVICE_ACCOUNT_JSON/.test(api), "service-account fallback is implemented");
assert.ok(/GOOGLE_IMPERSONATE/.test(api), "documents GOOGLE_IMPERSONATE");
assert.ok(/MAIL_FROM/.test(api), "documents optional MAIL_FROM");
assert.ok(/async function resolveSender/.test(api), "resolveSender picks token, refresh, mk, then store");
assert.ok(/via: "store"/.test(api), "store sender is a first-class via");
assert.ok(/kind === "oauth"/.test(api) || /kind==="oauth"/.test(api), "staff oauth code exchange stays");
assert.ok(/kind === "sms"/.test(api) || /kind==="sms"/.test(api), "invite SMS is a mailer kind");
assert.ok(/TWILIO_ACCOUNT_SID/.test(api), "Twilio env is documented on the mailer");
assert.ok(/error: "mailer"/.test(api), "missing store env still returns mailer");
assert.ok(/error: "empty"/.test(api), "empty post still returns empty");
assert.ok(/error: "missing code"/.test(api), "oauth without code stays missing code");

const upload = require(path.join(__dirname, "..", "api", "upload.js"));

async function route(body) {
  return upload.route(body);
}

(async function () {
  const empty = await route({});
  assert.deepEqual(empty.body, { ok: false, error: "empty" });

  const noTo = await route({ kind: "send" });
  assert.equal(noTo.body.ok, false);
  assert.ok(noTo.body.error === "empty" || noTo.body.error === "mailer");

  const noCreds = await route({ kind: "send", to: "shawn@gmautosales.ca", subject: "x", text: "hi" });
  assert.deepEqual(noCreds.body, { ok: false, error: "mailer" });
  assert.equal(noCreds.status, 401);

  const oauth = await route({ kind: "oauth" });
  assert.deepEqual(oauth.body, { ok: false, error: "missing code" });

  const rfc = upload.buildRfc822({
    to: "sales@gmautosales.ca",
    cc: "christina@carmoji.ca",
    subject: "2024 Tucson trade-in",
    text: "plain",
    html: "<p>hi</p>"
  }, "store@gmautosales.ca");
  assert.ok(rfc.indexOf("From: store@gmautosales.ca") >= 0);
  assert.ok(rfc.indexOf("text/html") >= 0);
  assert.ok(rfc.indexOf("2024 Tucson") >= 0);
  assert.ok(rfc.indexOf("Cc: christina@carmoji.ca") >= 0);

  const hot = upload.buildRfc822({
    to: "shawn@myloan.ca",
    subject: "Needs docs",
    text: "now",
    importance: "high"
  }, "store@gmautosales.ca");
  assert.ok(hot.indexOf("Importance: high") >= 0, "high-importance header");
  assert.ok(hot.indexOf("X-Priority: 1") >= 0, "Outlook/Gmail red-bang priority");

  console.log("store-sender: ok");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
