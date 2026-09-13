/**
 * Durable appraisal nags — incomplete team-leader queue + Shawn on-site.
 *
 * POST  {kind:"upsert"|"complete"|"tick", ...}   register / stop / run due
 * GET   Vercel cron every 15 minutes              re-notify due jobs
 *
 * Live host (same mailer as Packet Send):
 *   https://gnm-guest-mailer-shawn-6802.vercel.app/api/notify-appraisal
 *
 * Paste into Vercel → Project → Settings → Environment Variables
 * (Production + Preview), then Redeploy:
 *
 *   GOOGLE_REFRESH_TOKEN / GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / MAIL_FROM
 *                         Same store mailbox as /api/upload (high-importance email)
 *   TWILIO_ACCOUNT_SID    Optional later. Twilio account SID
 *   TWILIO_AUTH_TOKEN     Optional later. Twilio auth token — never put in the client
 *   TWILIO_FROM           Optional later. Twilio From number (E.164)
 *   SHAWN_SMS_TO          Optional later. Shawn's cell in E.164. Not required to ship.
 *                         SMS only fires when this or a Users-roster cell is set.
 *   BLOB_READ_WRITE_TOKEN Optional. Vercel Blob token so jobs survive cold starts
 *   NOTIFY_STORE_PATH     Optional. JSON file fallback (default /tmp/appraisal-notify-jobs.json)
 *   CRON_SECRET           Optional. If set, GET cron must send Bearer CRON_SECRET
 *                         or the x-vercel-cron: 1 header Vercel adds
 *
 * Shipped nag is high-importance email. No cell / no Twilio never blocks
 * register, cron, or email. SMS is a bonus when a phone exists.
 */
const upload = require("./upload");
const store = require("./lib/notify-store");
const sms = require("./lib/sms");

const ALLOW = [
  "https://carmojiguy.github.io",
  "https://gnm-guest-mailer-shawn-6802.vercel.app"
];
const SHAWN_EMAIL = "shawn@myloan.ca";

function cors(origin) {
  const allow = ALLOW.some(function (a) {
    return origin === a || (origin && origin.indexOf("github.io") >= 0) || (origin && origin.indexOf("vercel.app") >= 0) || (origin && origin.indexOf("localhost") >= 0);
  });
  return {
    "Access-Control-Allow-Origin": allow && origin ? origin : ALLOW[0],
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Max-Age": "86400"
  };
}

function json(res, status, body, origin) {
  const headers = Object.assign({ "Content-Type": "application/json" }, cors(origin));
  if (res && typeof res.status === "function" && typeof res.json === "function") {
    Object.keys(headers).forEach(function (k) { res.setHeader(k, headers[k]); });
    return res.status(status).json(body);
  }
  return new Response(JSON.stringify(body), { status: status, headers: headers });
}

function headerOf(req, name) {
  if (!req || !req.headers) return "";
  if (typeof req.headers.get === "function") return req.headers.get(name) || "";
  return req.headers[name] || req.headers[name.toLowerCase()] || "";
}

function cronOk(req, env) {
  const e = env || process.env;
  const secret = e.CRON_SECRET || "";
  const vercelCron = String(headerOf(req, "x-vercel-cron") || "");
  if (vercelCron === "1") return true;
  if (!secret) return true;
  const auth = String(headerOf(req, "authorization") || "");
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  return bearer === secret;
}

function shawnPhone(env, extra) {
  const e = env || process.env;
  return sms.toE164(extra || "") || sms.toE164(e.SHAWN_SMS_TO || "");
}

function jobTargets(job, env) {
  const rec = store.recipientsOf(job);
  let emails = rec.emails.slice();
  let phones = rec.phones.slice();
  if (job.lane === "onsite-attention") {
    emails = [SHAWN_EMAIL];
    phones = [];
    const cell = shawnPhone(env, rec.phones[0] || rec.phone);
    if (cell) phones.push(cell);
  } else {
    if (!emails.length) emails.push(SHAWN_EMAIL);
    phones = rec.phones.map(function (p) { return sms.toE164(p); }).filter(Boolean);
    emails.forEach(function (em) {
      if (em === SHAWN_EMAIL) {
        const cell = shawnPhone(env, "");
        if (cell && phones.indexOf(cell) < 0) phones.push(cell);
      }
    });
  }
  return { emails: emails, phones: phones };
}

function missingLine(job) {
  const list = (job && job.missing) || [];
  if (!list.length) return "market docs still incomplete";
  return list.join(", ");
}

function buildAlertEmail(job, reminder) {
  const vehicle = (job && job.vehicle) || "Vehicle";
  const who = (job && job.salesperson) || "Sales";
  const vin = (job && job.vin) || "";
  const customer = (job && job.customer) || "";
  const nag = reminder ? "Reminder: " : "";
  let subject;
  let lead;
  if (job.lane === "onsite-attention") {
    subject = nag + "[On-site] " + vehicle + " still needs attention";
    lead = reminder
      ? "Still on the lot — this on-site appraisal is waiting on you."
      : "An on-site appraisal needs attention in Appraisal Center.";
  } else {
    subject = nag + "[Needs docs] " + vehicle + " — " + missingLine(job);
    lead = reminder
      ? "Still waiting on market docs before this can go to the full appraisal desk."
      : "A salesperson sent this file to you to finish the market docs.";
  }
  const lines = [
    lead,
    "",
    customer ? ("Customer: " + customer) : "",
    "Vehicle: " + vehicle,
    vin ? ("VIN: " + vin) : "",
    "Salesperson: " + who,
    job.dealType ? ("Type: " + job.dealType) : "",
    job.lane === "incomplete-leader" ? ("Missing: " + missingLine(job)) : "Status: On-site — needs a number or a clear.",
    "",
    "Open Appraisal Center → " + (job.lane === "onsite-attention" ? "On-site" : "Needs docs") + " to finish.",
    "These nags stop the moment the file is completed or promoted."
  ].filter(function (l, i, a) { return l !== "" || (a[i - 1] !== "" && i); });
  const text = lines.join("\n").replace(/\n{3,}/g, "\n\n");
  const html = "<p>" + lead.replace(/&/g, "&amp;") + "</p><ul>" +
    (customer ? "<li><b>Customer</b> " + esc(customer) + "</li>" : "") +
    "<li><b>Vehicle</b> " + esc(vehicle) + "</li>" +
    (vin ? "<li><b>VIN</b> " + esc(vin) + "</li>" : "") +
    "<li><b>Salesperson</b> " + esc(who) + "</li>" +
    (job.lane === "incomplete-leader" ? "<li><b>Missing</b> " + esc(missingLine(job)) + "</li>" : "<li><b>Lane</b> On-site</li>") +
    "</ul><p>Nags stop the moment the file is completed or promoted out of this queue.</p>";
  return { subject: subject, text: text, html: html, importance: "high" };
}

function esc(s) {
  return String(s || "").replace(/[&<>"]/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c];
  });
}

function buildAlertSms(job, reminder) {
  const vehicle = (job && job.vehicle) || "Vehicle";
  const who = (job && job.salesperson) || "Sales";
  const nag = reminder ? "Reminder: " : "";
  if (job.lane === "onsite-attention") {
    return (nag + "On-site needs you: " + vehicle + " · " + who + ". Appraisal Center.").slice(0, 320);
  }
  return (nag + "Needs docs: " + vehicle + " · " + who + " · missing " + missingLine(job) + ". Finish in Appraisal Center.").slice(0, 320);
}

async function deliverJob(job, reminder, deps) {
  deps = deps || {};
  const env = deps.env || process.env;
  const targets = jobTargets(job, env);
  const mail = buildAlertEmail(job, reminder);
  const text = buildAlertSms(job, reminder);
  const sendEmail = deps.sendEmail || defaultSendEmail;
  const sendSms = deps.sendSms || sms.sendSms;
  const log = deps.log || console;
  const emailRes = targets.emails.length
    ? await sendEmail({
      to: targets.emails,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      importance: "high"
    }, deps)
    : { ok: false, error: "no-to" };
  const smsResults = [];
  for (let i = 0; i < targets.phones.length; i++) {
    smsResults.push(await sendSms(targets.phones[i], text, { env: env, fetch: deps.fetch, log: log }));
  }
  if (!targets.phones.length) {
    log.log("[notify-appraisal] SMS skipped — no Users cell or SHAWN_SMS_TO. High-importance email still sent.");
    smsResults.push({ ok: false, skipped: "no-phone" });
  }
  return { email: emailRes, sms: smsResults, emails: targets.emails, phones: targets.phones };
}

async function defaultSendEmail(body) {
  const sender = await upload.resolveSender({ kind: "send", store: true, token: "", refresh: "", mk: "" });
  if (!sender || !sender.token) return { ok: false, error: "mailer" };
  const rfc = upload.buildRfc822(body, sender.from);
  const sent = await upload.gmailSend(sender.token, rfc);
  return { ok: true, id: sent.id || "", via: sender.via };
}

async function upsertAndNotify(body, deps) {
  const job = await store.upsertJob(body, deps);
  if (!job) return { status: 400, body: { ok: false, error: "empty" } };
  const reminder = !!job.lastNotifiedAt;
  const out = await deliverJob(job, reminder, deps);
  const mailed = !!(out.email && out.email.ok);
  if (mailed) await store.markNotified([job.key], deps);
  return { status: 200, body: { ok: true, id: job.id, lane: job.lane, notified: mailed, email: out.email, sms: out.sms } };
}

async function completeAndStop(body, deps) {
  const id = String((body && body.id) || "").trim();
  if (!id) return { status: 400, body: { ok: false, error: "empty" } };
  const n = await store.completeJob(id, body.lane || "", deps);
  return { status: 200, body: { ok: true, id: id, stopped: n } };
}

async function tick(deps) {
  deps = deps || {};
  const t = store.INTERVAL_MS && deps.now ? deps.now() : Date.now();
  const now = typeof (deps.now) === "function" ? deps.now() : t;
  const jobs = await store.loadJobs(deps);
  const due = store.dueJobs(jobs, now, deps.interval);
  const sent = [];
  const mailed = [];
  for (let i = 0; i < due.length; i++) {
    const job = due[i];
    const reminder = !!job.lastNotifiedAt;
    const out = await deliverJob(job, reminder, deps);
    sent.push({ id: job.id, lane: job.lane, reminder: reminder, email: out.email, sms: out.sms });
    if (out.email && out.email.ok) mailed.push(job.key);
  }
  if (mailed.length) await store.markNotified(mailed, deps);
  return { status: 200, body: { ok: true, scanned: jobs.length, due: due.length, sent: sent } };
}

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(String(raw)); } catch (e) { return {}; }
}

async function route(body, deps) {
  const kind = String((body && body.kind) || "upsert").toLowerCase();
  if (kind === "tick") return tick(deps);
  if (kind === "complete" || kind === "stop" || kind === "clear") return completeAndStop(body, deps);
  if (kind === "upsert" || kind === "register" || kind === "alert") return upsertAndNotify(body, deps);
  return { status: 400, body: { ok: false, error: "empty" } };
}

async function fromRequest(req, deps) {
  const origin = headerOf(req, "origin");
  const method = String(req.method || "GET").toUpperCase();
  if (method === "OPTIONS") return { status: 204, body: { ok: true }, origin: origin };
  if (method === "GET") {
    if (!cronOk(req, deps && deps.env)) return { status: 401, body: { ok: false, error: "cron" }, origin: origin };
    const out = await tick(deps);
    out.origin = origin;
    return out;
  }
  if (method !== "POST") return { status: 405, body: { ok: false }, origin: origin };
  let body = req.body;
  if (body == null && typeof req.json === "function") {
    try { body = await req.json(); } catch (e) { body = {}; }
  } else if (typeof body === "string") {
    body = parseBody(body);
  } else if (!body || typeof body !== "object") {
    body = {};
  }
  const out = await route(body, deps);
  out.origin = origin;
  return out;
}

module.exports = async function handler(req, res) {
  const out = await fromRequest(req);
  return json(res, out.status, out.body, out.origin);
};

module.exports.route = route;
module.exports.fromRequest = fromRequest;
module.exports.buildAlertEmail = buildAlertEmail;
module.exports.buildAlertSms = buildAlertSms;
module.exports.jobTargets = jobTargets;
module.exports.SHAWN_EMAIL = SHAWN_EMAIL;

module.exports.GET = async function GET(request) {
  const out = await fromRequest(request);
  return json(null, out.status, out.body, out.origin);
};

module.exports.OPTIONS = async function OPTIONS(request) {
  const origin = request.headers && request.headers.get ? request.headers.get("origin") || "" : "";
  return json(null, 204, { ok: true }, origin);
};

module.exports.POST = async function POST(request) {
  const out = await fromRequest(request);
  return json(null, out.status, out.body, out.origin);
};
