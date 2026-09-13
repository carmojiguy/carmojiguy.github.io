/**
 * SMS provider interface for appraisal nags.
 *
 * Env (Vercel → Project → Settings → Environment Variables):
 *   TWILIO_ACCOUNT_SID    Twilio account SID
 *   TWILIO_AUTH_TOKEN     Twilio auth token (never send to the client)
 *   TWILIO_FROM           Twilio From number in E.164, e.g. +16135550100
 *
 * If any of those are missing, sendSms() returns {ok:false, skipped:"twilio"}
 * and the caller still sends the high-importance email.
 */
function digits(v) {
  return String(v || "").replace(/\D/g, "");
}

function toE164(raw, defaultCountry) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (s.charAt(0) === "+" && digits(s).length >= 10 && digits(s).length <= 15) {
    return "+" + digits(s);
  }
  let d = digits(s);
  if (!d) return "";
  const cc = defaultCountry || "1";
  if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
  if (d.length === 10) return "+" + cc + d;
  if (d.length >= 11 && d.length <= 15) return "+" + d;
  return "";
}

function twilioConfigured(env) {
  const e = env || process.env;
  return !!(e.TWILIO_ACCOUNT_SID && e.TWILIO_AUTH_TOKEN && e.TWILIO_FROM);
}

async function sendSms(to, body, deps) {
  deps = deps || {};
  const env = deps.env || process.env;
  const fetchFn = deps.fetch || fetch;
  const log = deps.log || console;
  const phone = toE164(to);
  const text = String(body || "").trim();
  if (!phone || !text) return { ok: false, skipped: "no-phone" };
  if (!twilioConfigured(env)) {
    log.log("[notify-appraisal] SMS skipped — TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM not set. Email still sent.");
    return { ok: false, skipped: "twilio" };
  }
  const sid = env.TWILIO_ACCOUNT_SID;
  const token = env.TWILIO_AUTH_TOKEN;
  const from = env.TWILIO_FROM;
  const auth = Buffer.from(sid + ":" + token).toString("base64");
  const url = "https://api.twilio.com/2010-04-01/Accounts/" + encodeURIComponent(sid) + "/Messages.json";
  const r = await fetchFn(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + auth,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({ To: phone, From: from, Body: text }).toString()
  });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok) {
    log.log("[notify-appraisal] SMS failed", r.status, j && (j.message || j.code) || "");
    return { ok: false, error: (j && j.message) || "twilio", status: r.status };
  }
  return { ok: true, sid: j.sid || "", to: phone };
}

module.exports = {
  toE164: toE164,
  twilioConfigured: twilioConfigured,
  sendSms: sendSms
};
