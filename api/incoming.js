/**
 * Shared Incoming store for Appraisal Center.
 *
 * Live host (FixerBot — deploy this file on gnm-guest-mailer):
 *   GET  https://gnm-guest-mailer-shawn-6802.vercel.app/api/incoming
 *        → { ok:true, items:[ slimCenterItem, ... ] }
 *   POST same URL
 *        { kind:"land", item: slimCenterItem }
 *        → { ok:true, id }
 *
 * CORS: carmojiguy.github.io (+ github.io / vercel.app).
 * Slim only: no raw video. thumb / tiny photos + docs meta (have/name/type).
 *
 * Pages (carmojiguy.github.io) POST after landIncomingPacket and GET on
 * Center boot to REPLACE Shawn's upsertCenterInvite stub.
 */
const ALLOW = [
  "https://carmojiguy.github.io",
  "https://gnm-guest-mailer-shawn-6802.vercel.app"
];
const FILE = "/tmp/center-incoming-v1.json";
const MAX = 80;
const KEYS = [
  "id", "sendId", "vin", "year", "make", "model", "trim", "color", "km", "stock",
  "ymmt", "purpose", "dealType", "leadSource", "source", "lane", "stage", "story",
  "webcopy", "photoCount", "thumb", "requestedBy", "requestedByName", "sentBy",
  "salesperson", "interest", "sentAt", "updatedAt", "inviteUnit", "archived"
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
  if (res && typeof res.status === "function" && typeof res.json === "function") {
    Object.keys(headers).forEach(function (k) { res.setHeader(k, headers[k]); });
    return res.status(status).json(body);
  }
  return new Response(JSON.stringify(body), { status: status, headers: headers });
}

function mem() {
  if (!globalThis.__CENTER_INCOMING) globalThis.__CENTER_INCOMING = [];
  return globalThis.__CENTER_INCOMING;
}

function loadFile() {
  try {
    const fs = require("fs");
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (Array.isArray(raw) && raw.length) {
      globalThis.__CENTER_INCOMING = raw;
    }
  } catch (e) {}
  return mem();
}

function saveFile(list) {
  globalThis.__CENTER_INCOMING = list;
  try {
    require("fs").writeFileSync(FILE, JSON.stringify(list));
  } catch (e) {}
}

function slimDocs(docs) {
  const src = docs && typeof docs === "object" ? docs : {};
  const out = {};
  Object.keys(src).forEach(function (k) {
    const d = src[k] || {};
    out[k] = { have: !!d.have, name: String(d.name || ""), type: String(d.type || "") };
    if (/^https?:\/\//i.test(String(d.url || ""))) out[k].url = String(d.url);
    if (/^https?:\/\//i.test(String(d.extract || ""))) out[k].extract = String(d.extract);
    if (/^https?:\/\//i.test(String(d.preview || ""))) out[k].preview = String(d.preview);
    if (Array.isArray(d.shots)) {
      const shots = d.shots.map(function (s) {
        const u = typeof s === "string" ? s : (s && (s.url || s.href)) || "";
        return /^https?:\/\//i.test(u) ? { url: u } : null;
      }).filter(Boolean);
      if (shots.length) out[k].shots = shots;
    }
  });
  return out;
}

function slimCustomer(c) {
  c = c || {};
  return {
    name: String(c.name || ""),
    email: String(c.email || ""),
    phone: String(c.phone || "")
  };
}

function slimItem(raw) {
  raw = raw && typeof raw === "object" ? raw : {};
  const item = {};
  KEYS.forEach(function (k) { item[k] = raw[k] != null ? raw[k] : ""; });
  item.photoCount = Number(raw.photoCount || 0);
  item.sentAt = Number(raw.sentAt || Date.now());
  item.updatedAt = Number(raw.updatedAt || Date.now());
  item.source = raw.source || "guest";
  item.lane = (raw.lane === "needsdocs" || raw.lane === "onsite" || raw.lane === "history" || raw.lane === "inbox") ? raw.lane : (raw.lane || "inbox");
  item.archived = !!raw.archived;
  item.stage = raw.stage || "Waiting";
  if (item.lane === "history") {
    item.archived = true;
    item.stage = raw.stage || "Appraised";
  }
  item.customer = slimCustomer(raw.customer);
  item.docs = slimDocs(raw.docs);
  item.thumb = String(raw.thumb || "").slice(0, 180000);
  if (raw.teamActivated === true || raw.teamActivated === false) item.teamActivated = !!raw.teamActivated;
  if (raw.teamActivatedAt != null && raw.teamActivatedAt !== "") item.teamActivatedAt = Number(raw.teamActivatedAt) || 0;
  if (raw.teamStatus != null) item.teamStatus = String(raw.teamStatus);
  if (raw.teamRun && typeof raw.teamRun === "object") item.teamRun = raw.teamRun;
  if (raw.team && typeof raw.team === "object") {
    item.team = {};
    ["shabot", "rybot", "webot", "drebot", "tbot"].forEach(function (k) {
      const s = raw.team[k];
      if (!s || typeof s !== "object") return;
      item.team[k] = {
        min: String(s.min || ""),
        target: String(s.target || ""),
        max: String(s.max || ""),
        note: String(s.note || "")
      };
    });
  }
  if (raw.appraisalFinal && typeof raw.appraisalFinal === "object") {
    item.appraisalFinal = {
      min: String(raw.appraisalFinal.min || ""),
      target: String(raw.appraisalFinal.target || ""),
      max: String(raw.appraisalFinal.max || ""),
      path: String(raw.appraisalFinal.path || ""),
      at: Number(raw.appraisalFinal.at) || 0,
      authors: Array.isArray(raw.appraisalFinal.authors) ? raw.appraisalFinal.authors.map(String) : []
    };
  }
  if (raw.finalRationale && typeof raw.finalRationale === "object") item.finalRationale = raw.finalRationale;
  ["finalMin", "finalTarget", "finalMax", "finalPath"].forEach(function (k) {
    if (raw[k] != null && raw[k] !== "") item[k] = String(raw[k]);
  });
  if (raw.finalAt != null && raw.finalAt !== "") item.finalAt = Number(raw.finalAt) || 0;
  if (raw.locked === true || raw.locked === false) item.locked = !!raw.locked;
  if (raw.superseded === true || raw.superseded === false) item.superseded = !!raw.superseded;
  if (raw.supersedeLock === true || raw.supersedeLock === false) item.supersedeLock = !!raw.supersedeLock;
  if (raw.centerLocked === true || raw.centerLocked === false) item.centerLocked = !!raw.centerLocked;
  if (raw.staffUnlocked === true) item.staffUnlocked = true;
  if (!item.id) item.id = "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return item;
}

function sameSeat(a, b) {
  if (a.sendId && b.sendId && a.sendId === b.sendId) return true;
  if (a.id && b.id && a.id === b.id) return true;
  return false;
}

function mergeDocsKeepUrls(prevDocs, nextDocs) {
  const prev = prevDocs && typeof prevDocs === "object" ? prevDocs : {};
  const next = nextDocs && typeof nextDocs === "object" ? nextDocs : {};
  const keys = {};
  Object.keys(prev).concat(Object.keys(next)).forEach(function (k) { keys[k] = true; });
  const out = {};
  Object.keys(keys).forEach(function (k) {
    const a = next[k] && typeof next[k] === "object" ? next[k] : {};
    const b = prev[k] && typeof prev[k] === "object" ? prev[k] : {};
    out[k] = Object.assign({}, b, a);
    if (!/^https?:\/\//i.test(String(a.url || "")) && /^https?:\/\//i.test(String(b.url || ""))) {
      out[k].url = b.url;
    }
  });
  return slimDocs(out);
}
function persistItem(raw) {
  if (isSampleItem(raw)) return slimItem(raw);
  const item = slimItem(raw);
  const list = loadFile();
  const idx = list.findIndex(function (x) { return sameSeat(x, item); });
  if (idx >= 0) {
    const prev = list[idx];
    const incomingHave = Object.keys(item.docs || {}).filter(function (k) {
      return item.docs[k] && item.docs[k].have;
    }).length;
    const prevHave = Object.keys(prev.docs || {}).filter(function (k) {
      return prev.docs[k] && prev.docs[k].have;
    }).length;
    const sameSend = !!(item.sendId && prev.sendId && item.sendId === prev.sendId);
    const sameId = !!(item.id && prev.id && item.id === prev.id);
    if (!sameSend && !sameId && incomingHave === 0 && prevHave > 0) return prev;
    if (item.sentAt && prev.sentAt && item.sentAt < prev.sentAt && incomingHave <= prevHave) return prev;
    const next = slimItem(Object.assign({}, prev, item, {
      id: prev.id || item.id,
      docs: mergeDocsKeepUrls(prev.docs, item.docs),
      customer: {
        name: item.customer.name || prev.customer.name,
        email: item.customer.email || prev.customer.email,
        phone: item.customer.phone || prev.customer.phone
      }
    }));
    list.splice(idx, 1);
    list.unshift(next);
    saveFile(list.slice(0, MAX));
    return next;
  }
  list.unshift(item);
  saveFile(list.slice(0, MAX));
  return item;
}
function persistFile(body) {
  body = body && typeof body === "object" ? body : {};
  const sendId = String(body.sendId || "");
  const key = String(body.key || "").toLowerCase();
  if (!sendId) return { status: 400, body: { ok: false, error: "sendId" } };
  if (key !== "vauto" && key !== "openlane" && key !== "eblock" && key !== "carfax") {
    return { status: 400, body: { ok: false, error: "key" } };
  }
  const name = String(body.name || (key + ".bin"));
  const type = String(body.type || "application/octet-stream");
  const data = String(body.data || "");
  if (!data) return { status: 400, body: { ok: false, error: "data" } };
  const safe = name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-|-$/g, "") || key;
  const url = "https://7codzfkcbtucfujs.public.blob.vercel-storage.com/docs/" + encodeURIComponent(sendId) + "/" + key + "/" + safe;
  const list = loadFile();
  const idx = list.findIndex(function (x) { return x && x.sendId === sendId; });
  if (idx >= 0) {
    const item = list[idx];
    item.docs = item.docs || {};
    item.docs[key] = { have: true, name: name, type: type, url: url };
    item.updatedAt = Date.now();
    saveFile(list);
  }
  return { status: 200, body: { ok: true, url: url, sendId: sendId, key: key, name: name } };
}

function isSampleItem(raw) {
  if (!raw || typeof raw !== "object") return false;
  if (raw.sample || raw.sampleVer) return true;
  return /^sample[-_]/i.test(String(raw.id || ""));
}

function listItems() {
  return loadFile().filter(function (x) { return !isSampleItem(x); });
}

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try { return JSON.parse(String(raw)); } catch (e) { return {}; }
}

function isPacketSend(body) {
  const text = String((body && body.text) || "");
  const subject = String((body && body.subject) || "");
  if (/Private link to get a (real )?value/i.test(text)) return false;
  if (/Shawn approval/i.test(subject + text)) return false;
  if (/The photo catalog is in this email/.test(text)) return true;
  if (/The sales-grade appraisal PDF is attached/.test(text)) return true;
  const parts = Array.isArray(body && body.parts) ? body.parts : [];
  const photos = parts.some(function (p) { return p && p.b64 && String(p.mime || "").indexOf("image/") === 0; });
  const pdf = parts.some(function (p) { return p && (p.mime === "application/pdf" || /\.pdf$/i.test(p.name || "")); });
  return photos && pdf;
}

function itemFromSend(body, sent) {
  body = body || {};
  const text = String(body.text || "");
  const html = String(body.html || "");
  const subject = String(body.subject || "");
  const vin = ((text.match(/VIN\s+([A-HJ-NPR-Z0-9]{11,17})/i) || [])[1] || "").toUpperCase();
  const ymmt = (text.split(/\r?\n/)[0] || "").split(" — ")[0] || subject.split(" — ")[0] || "";
  const fromName = ((subject.match(/trade-in from\s+(.+)$/i) || [])[1] || "").trim()
    || ((text.match(/^Sent by:\s*([^·\n]+)/m) || [])[1] || "").trim();
  const facts = {};
  const re = /text-transform:uppercase">([^<]+)<\/div>\s*<div[^>]*>([^<]+)<\/div>/gi;
  let m;
  while ((m = re.exec(html))) {
    facts[String(m[1] || "").trim().toLowerCase()] = String(m[2] || "").replace(/&#(\d+);/g, function (_, n) {
      return String.fromCharCode(Number(n));
    }).trim();
  }
  const catalog = Math.max(
    text.indexOf("The photo catalog is in this email"),
    text.indexOf("The sales-grade appraisal PDF is attached")
  );
  let story = "";
  if (catalog > 0) {
    const chunk = text.slice(0, catalog).split(/\n\n/).slice(1).join("\n\n").trim();
    story = chunk;
  }
  const parts = Array.isArray(body.parts) ? body.parts : [];
  const first = parts.find(function (p) { return p && p.b64 && String(p.mime || "image/").indexOf("image/") === 0; });
  const thumb = first ? ("data:" + (first.mime || "image/jpeg") + ";base64," + String(first.b64).slice(0, 120000)) : "";
  return slimItem({
    id: (sent && sent.id) ? "g" + sent.id : "",
    sendId: body.sendId || "",
    vin: vin || facts.vin || "",
    year: facts.year || "",
    make: facts.make || "",
    model: facts.model || "",
    trim: facts.trim || "",
    color: facts.colour || facts.color || "",
    km: facts.kilometres || facts.km || "",
    stock: facts.stock || "",
    ymmt: ymmt,
    dealType: facts.type || "",
    leadSource: facts.lead || "",
    source: /trade-in from/i.test(subject) ? "guest" : "appraise",
    story: story,
    photoCount: parts.filter(function (p) { return p && p.b64 && String(p.mime || "").indexOf("image/") === 0; }).length,
    thumb: thumb,
    customer: { name: fromName },
    sentBy: ((text.match(/^Sent by:\s*(.+)$/m) || [])[1] || ""),
    sentAt: Date.now(),
    updatedAt: Date.now()
  });
}

async function persistFromSend(body, sent) {
  try {
    if (!isPacketSend(body)) return null;
    return persistItem(itemFromSend(body, sent));
  } catch (e) {
    return null;
  }
}

function route(method, body) {
  method = String(method || "GET").toUpperCase();
  if (method === "OPTIONS") return { status: 204, body: { ok: true } };
  if (method === "GET") return { status: 200, body: { ok: true, items: listItems() } };
  if (method !== "POST") return { status: 405, body: { ok: false, error: "method" } };
  body = body && typeof body === "object" ? body : {};
  if (body.kind === "file") return persistFile(body);
  if (body.kind === "team") {
    const raw = (body.item && typeof body.item === "object") ? Object.assign({}, body.item, body) : body;
    raw.teamActivated = true;
    raw.teamActivatedAt = raw.teamActivatedAt || Date.now();
    raw.teamStatus = raw.teamStatus || "running";
    const has = raw.sendId || raw.vin || raw.id || raw.ymmt || (raw.customer && raw.customer.name);
    if (!has) return { status: 400, body: { ok: false, error: "empty" } };
    const item = persistItem(raw);
    try {
      const notify = require("./notify-appraisal");
      const wake = {
        kind: "upsert",
        lane: "onsite-attention",
        id: item.id,
        email: "shawn@myloan.ca",
        emails: ["shawn@myloan.ca"],
        vehicle: item.ymmt || item.interest || "",
        vin: item.vin || "",
        missing: ["Appraisal Team activated"]
      };
      if (notify && typeof notify.route === "function") {
        Promise.resolve(notify.route(wake)).catch(function () {});
      }
    } catch (e) {}
    return { status: 200, body: { ok: true, id: item.id, kind: "team", teamActivated: true } };
  }
  if (body.kind && body.kind !== "land") return { status: 400, body: { ok: false, error: "kind" } };
  const raw = body.item || body;
  if (!raw || typeof raw !== "object") return { status: 400, body: { ok: false, error: "empty" } };
  const has = raw.sendId || raw.vin || (raw.customer && raw.customer.name) || raw.ymmt || raw.id;
  if (!has) return { status: 400, body: { ok: false, error: "empty" } };
  const item = persistItem(raw);
  return { status: 200, body: { ok: true, id: item.id } };
}

async function fromRequest(req) {
  const origin = (req.headers && (req.headers.origin || req.headers.Origin)) || "";
  const method = String(req.method || "GET").toUpperCase();
  if (method === "OPTIONS") return { status: 204, body: { ok: true }, origin: origin };
  let body = {};
  if (method === "POST") {
    body = req.body;
    if (body == null && typeof req.json === "function") {
      try { body = await req.json(); } catch (e) { body = {}; }
    } else if (typeof body === "string") {
      body = parseBody(body);
    } else if (!body || typeof body !== "object") {
      body = {};
    }
  }
  const out = route(method, body);
  out.origin = origin;
  return out;
}

async function handler(req, res) {
  const out = await fromRequest(req);
  return json(res, out.status, out.body, out.origin);
}

module.exports = handler;
module.exports.default = handler;
module.exports.route = route;
module.exports.persistItem = persistItem;
module.exports.listItems = listItems;
module.exports.slimItem = slimItem;
module.exports.persistFromSend = persistFromSend;
module.exports.isPacketSend = isPacketSend;
module.exports.resetStore = function resetStore() {
  globalThis.__CENTER_INCOMING = [];
  try { require("fs").unlinkSync(FILE); } catch (e) {}
};

module.exports.GET = async function GET(request) {
  const origin = request.headers.get("origin") || "";
  return json(null, 200, { ok: true, items: listItems() }, origin);
};

module.exports.OPTIONS = async function OPTIONS(request) {
  const origin = request.headers.get("origin") || "";
  return json(null, 204, { ok: true }, origin);
};

module.exports.POST = async function POST(request) {
  const origin = request.headers.get("origin") || "";
  let body = {};
  try { body = await request.json(); } catch (e) { body = {}; }
  const out = route("POST", body);
  return json(null, out.status, out.body, origin);
};
