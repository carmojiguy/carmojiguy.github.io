/**
 * Store + staff mailer for Packet Send.
 *
 * Drop this file onto the existing Vercel project
 *   trade-in-shawn-6802  (https://trade-in-shawn-6802.vercel.app/api/upload)
 * or connect this repo and point MAIL_HOST at that deployment.
 *
 * Guest Send posts {kind:"send"} with empty token/mk. The store sender
 * must still mail the packet — that is why these env vars exist.
 *
 * Paste into Vercel → Project → Settings → Environment Variables
 * (Production + Preview), then Redeploy:
 *
 *   GOOGLE_CLIENT_ID        Web client ID (same as google-client.json /
 *                           612595319762-mdl9686m3t8pu40qnp9oftpn6osju5c4.apps.googleusercontent.com)
 *   GOOGLE_CLIENT_SECRET    Web client secret from Google Cloud → APIs → Credentials
 *   GOOGLE_REFRESH_TOKEN    Offline refresh token for the STORE mailbox
 *                           (Shawn / store Gmail that may send as the dealership)
 *   MAIL_FROM               Optional. From address, e.g. shawn@gmautosales.ca
 *                           Must be the store mailbox or an alias it can send as.
 *
 * Alternate (Google Workspace only):
 *   GOOGLE_SERVICE_ACCOUNT_JSON   Full service-account JSON as one string
 *   GOOGLE_IMPERSONATE            Workspace user to send as (domain-wide delegation)
 *   MAIL_FROM                     Same as impersonated user, or an allowed alias
 *
 * Staff Google login still uses kind:"oauth" (code exchange) with the same
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET. Do not remove those.
 */
const ALLOW = [
  "https://carmojiguy.github.io",
  "https://trade-in-shawn-6802.vercel.app"
];

function cors(origin) {
  const allow = ALLOW.some(function (a) {
    return origin === a || (origin && origin.indexOf("github.io") >= 0) || (origin && origin.indexOf("vercel.app") >= 0);
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
  if (typeof res.status === "function" && typeof res.json === "function") {
    Object.keys(headers).forEach(function (k) { res.setHeader(k, headers[k]); });
    return res.status(status).json(body);
  }
  return new Response(JSON.stringify(body), { status: status, headers: headers });
}

function uniqEmails(v) {
  const list = [].concat(v || []);
  const out = [];
  const seen = {};
  list.forEach(function (e) {
    const s = String(e || "").trim().toLowerCase();
    if (!s || s.indexOf("@") < 1 || seen[s]) return;
    seen[s] = 1;
    out.push(s);
  });
  return out;
}

function mailHdr(v) {
  const s = String(v || "");
  if (!s) return "";
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return "=?UTF-8?B?" + Buffer.from(s, "utf8").toString("base64") + "?=";
}

function b64url(buf) {
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(String(buf || ""), "utf8");
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRfc822(body, from) {
  const to = uniqEmails(body.to);
  const cc = uniqEmails(body.cc);
  const bcc = uniqEmails(body.bcc);
  const subject = mailHdr(body.subject || "");
  const text = String(body.text || "");
  const html = String(body.html || "");
  const parts = Array.isArray(body.parts) ? body.parts : [];
  const fromHdr = from || body.from || process.env.MAIL_FROM || "";
  let head = "From: " + fromHdr + "\r\nTo: " + to.join(", ") + "\r\n";
  if (cc.length) head += "Cc: " + cc.join(", ") + "\r\n";
  if (bcc.length) head += "Bcc: " + bcc.join(", ") + "\r\n";
  head += "Subject: " + subject + "\r\nMIME-Version: 1.0\r\n";
  const inline = parts.filter(function (p) { return p && p.disp !== "attachment" && p.b64; });
  const attach = parts.filter(function (p) { return p && p.disp === "attachment" && p.b64; });
  if (!html && !parts.length) return head + "Content-Type: text/plain; charset=UTF-8\r\n\r\n" + text;
  const alt = "alt" + Date.now();
  const inner = "--" + alt + "\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n" + text +
    "\r\n--" + alt + "\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n" +
    (html || ("<pre>" + text.replace(/[&<>]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c];
    }) + "</pre>")) + "\r\n--" + alt + "--";
  function partBlock(p) {
    const mime = p.mime || "application/octet-stream";
    const name = p.name || "file";
    const disp = p.disp === "attachment"
      ? ("attachment; filename=\"" + name + "\"")
      : ("inline; filename=\"" + name + "\"");
    const cid = p.cid ? ("Content-ID: <" + p.cid + ">\r\n") : "";
    return "Content-Type: " + mime + "; name=\"" + name + "\"\r\nContent-Transfer-Encoding: base64\r\n" +
      cid + "Content-Disposition: " + disp + "\r\n\r\n" + p.b64 + "\r\n";
  }
  if (!inline.length && !attach.length) {
    return head + "Content-Type: multipart/alternative; boundary=\"" + alt + "\"\r\n\r\n" + inner;
  }
  const rel = "rel" + Date.now();
  let related = "Content-Type: multipart/related; type=\"multipart/alternative\"; boundary=\"" + rel + "\"\r\n\r\n--" +
    rel + "\r\nContent-Type: multipart/alternative; boundary=\"" + alt + "\"\r\n\r\n" + inner + "\r\n";
  inline.forEach(function (p) { related += "--" + rel + "\r\n" + partBlock(p); });
  related += "--" + rel + "--";
  if (!attach.length) return head + related;
  const mix = "mix" + Date.now();
  let mime = head + "Content-Type: multipart/mixed; boundary=\"" + mix + "\"\r\n\r\n--" + mix + "\r\n" + related + "\r\n";
  attach.forEach(function (p) { mime += "--" + mix + "\r\n" + partBlock(p); });
  mime += "--" + mix + "--";
  return mime;
}

async function googleToken(params) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString()
  });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok) {
    const err = new Error((j && (j.error_description || j.error)) || "token");
    err.payload = j;
    throw err;
  }
  return j;
}

async function refreshAccess(refresh) {
  const id = process.env.GOOGLE_CLIENT_ID || "";
  const secret = process.env.GOOGLE_CLIENT_SECRET || "";
  if (!refresh || !id || !secret) return "";
  try {
    const j = await googleToken({
      client_id: id,
      client_secret: secret,
      refresh_token: refresh,
      grant_type: "refresh_token"
    });
    return (j && j.access_token) || "";
  } catch (e) {
    return "";
  }
}

function saJson() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

async function serviceAccountAccess() {
  const sa = saJson();
  const sub = process.env.GOOGLE_IMPERSONATE || process.env.MAIL_FROM || "";
  if (!sa || !sa.client_email || !sa.private_key || !sub) return "";
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/gmail.send",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    sub: sub
  }));
  const crypto = require("crypto");
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(header + "." + claim);
  const jwt = header + "." + claim + "." + b64url(sign.sign(sa.private_key));
  try {
    const j = await googleToken({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt
    });
    return (j && j.access_token) || "";
  } catch (e) {
    return "";
  }
}

async function loadMailerKey(mk) {
  const url = String(mk || "");
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const r = await fetch(url);
    const j = await r.json();
    return j && typeof j === "object" ? j : null;
  } catch (e) {
    return null;
  }
}

async function resolveSender(body) {
  const token = String((body && body.token) || "");
  if (token) return { token: token, via: "token", from: (body && body.from) || "" };
  const refresh = String((body && body.refresh) || "");
  if (refresh) {
    const t = await refreshAccess(refresh);
    if (t) return { token: t, via: "refresh", from: (body && body.from) || "" };
  }
  const mk = await loadMailerKey(body && body.mk);
  if (mk) {
    if (mk.access_token) return { token: mk.access_token, via: "mk", from: mk.email || (body && body.from) || "" };
    if (mk.refresh_token) {
      const t = await refreshAccess(mk.refresh_token);
      if (t) return { token: t, via: "mk", from: mk.email || (body && body.from) || "" };
    }
  }
  const storeRefresh = process.env.GOOGLE_REFRESH_TOKEN || "";
  if (storeRefresh) {
    const t = await refreshAccess(storeRefresh);
    if (t) return { token: t, via: "store", from: process.env.MAIL_FROM || (body && body.from) || "" };
  }
  const sa = await serviceAccountAccess();
  if (sa) return { token: sa, via: "service", from: process.env.MAIL_FROM || process.env.GOOGLE_IMPERSONATE || "" };
  return null;
}

async function gmailSend(token, rfc) {
  const r = await fetch("https://gmail.googleapis.com/upload/gmail/v1/users/me/messages/send?uploadType=media", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "message/rfc822"
    },
    body: rfc
  });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok) {
    const err = new Error((j && (j.error && j.error.message)) || "gmail");
    err.payload = j;
    throw err;
  }
  return j;
}

async function handleSend(body) {
  const to = uniqEmails(body && body.to);
  if (!to.length) return { status: 400, body: { ok: false, error: "empty" } };
  const sender = await resolveSender(body);
  if (!sender || !sender.token) return { status: 401, body: { ok: false, error: "mailer" } };
  const rfc = buildRfc822(body, sender.from);
  const sent = await gmailSend(sender.token, rfc);
  return { status: 200, body: { ok: true, id: sent.id || "", via: sender.via } };
}

async function handleOauth(body) {
  const code = String((body && body.code) || "");
  const redirect = String((body && body.redirect_uri) || "");
  if (!code) return { status: 400, body: { ok: false, error: "missing code" } };
  const id = process.env.GOOGLE_CLIENT_ID || "";
  const secret = process.env.GOOGLE_CLIENT_SECRET || "";
  if (!id || !secret) return { status: 401, body: { ok: false, error: "mailer" } };
  try {
    const j = await googleToken({
      client_id: id,
      client_secret: secret,
      code: code,
      redirect_uri: redirect,
      grant_type: "authorization_code"
    });
    let email = "";
    if (j.access_token) {
      try {
        const u = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: "Bearer " + j.access_token }
        }).then(function (r) { return r.json(); });
        email = (u && u.email) || "";
      } catch (e) {}
    }
    return {
      status: 200,
      body: {
        ok: true,
        access_token: j.access_token || "",
        refresh_token: j.refresh_token || "",
        expires_in: j.expires_in || 3600,
        email: email
      }
    };
  } catch (e) {
    return { status: 401, body: { ok: false, error: "mailer" } };
  }
}

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(String(raw)); } catch (e) { return {}; }
}

function isEmptySend(body) {
  if (!body || typeof body !== "object") return true;
  const keys = Object.keys(body);
  if (!keys.length) return true;
  if (body.kind === "send") return false;
  if (body.kind === "oauth") return false;
  if (body.name && body.b64) return false;
  if (!body.kind && !body.to && !body.subject && !body.html && !body.text && !body.b64) return true;
  return false;
}

async function route(body) {
  if (isEmptySend(body)) return { status: 400, body: { ok: false, error: "empty" } };
  const kind = String((body && body.kind) || "");
  if (kind === "oauth") return handleOauth(body);
  if (kind === "send") {
    try { return await handleSend(body); }
    catch (e) { return { status: 401, body: { ok: false, error: "mailer" } }; }
  }
  if (body && body.name && body.b64) return { status: 200, body: { ok: false, error: "host" } };
  return { status: 400, body: { ok: false, error: "empty" } };
}

async function fromRequest(req) {
  const origin = (req.headers && (req.headers.origin || req.headers.Origin)) || "";
  const method = String(req.method || "GET").toUpperCase();
  if (method === "OPTIONS") return { status: 204, body: { ok: true }, origin: origin };
  if (method === "GET") return { status: 405, body: { ok: false }, origin: origin };
  if (method !== "POST") return { status: 405, body: { ok: false }, origin: origin };
  let body = req.body;
  if (body == null && typeof req.json === "function") {
    try { body = await req.json(); } catch (e) { body = {}; }
  } else if (typeof body === "string") {
    body = parseBody(body);
  } else if (!body || typeof body !== "object") {
    body = {};
  }
  const out = await route(body);
  out.origin = origin;
  return out;
}

module.exports = async function handler(req, res) {
  const out = await fromRequest(req);
  return json(res, out.status, out.body, out.origin);
};

module.exports.route = route;
module.exports.resolveSender = resolveSender;
module.exports.buildRfc822 = buildRfc822;

module.exports.GET = async function GET(request) {
  const origin = request.headers.get("origin") || "";
  return json(null, 405, { ok: false }, origin);
};

module.exports.OPTIONS = async function OPTIONS(request) {
  const origin = request.headers.get("origin") || "";
  return json(null, 204, { ok: true }, origin);
};

module.exports.POST = async function POST(request) {
  const origin = request.headers.get("origin") || "";
  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }
  const out = await route(body);
  return json(null, out.status, out.body, origin);
};
