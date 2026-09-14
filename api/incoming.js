/**
 * Shared Incoming store for Appraisal Center.
 *
 * Live host (FixerBot — deploy this file on gnm-guest-mailer):
 *   GET  https://gnm-guest-mailer-shawn-6802.vercel.app/api/incoming
 *        → { ok:true, items:[ slimCenterItem, ... ] }
 *   GET  same URL?kind=users
 *        → { ok:true, kind:"users", users:[], teams:[], permissions:{}, updatedAt, via:"blob" }
 *        Users roster lives in Vercel Blob (center-users-v1.json) so toggles
 *        survive cold starts and other devices — not only /tmp or localStorage.
 *   POST same URL
 *        { kind:"land", item: slimCenterItem }
 *        → { ok:true, id }
 *        { kind:"users", users:[], teams:[], permissions:{} }
 *        → { ok:true, kind:"users", updatedAt, via:"blob" }
 *        { kind:"team", sendId, id, vin, ymmt, pdfUrl, docs, item }
 *        → persist teamActivated + notify-appraisal + APPRAISAL_TEAM_WEBHOOK
 *        Empty land never wipes a complete appraisalFinal (min+target+max).
 *        Complete FINAL (min+target+max) settles teamStatus running → final.
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
const USERS_FILE = "/tmp/center-users-v1.json";
const usersStore = require("./lib/users-store");
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

function shotUrl(s) {
  const u = typeof s === "string" ? s : (s && (s.url || s.href)) || "";
  return /^https?:\/\//i.test(u) ? String(u) : "";
}

function slimShots() {
  const seen = {};
  const shots = [];
  for (let i = 0; i < arguments.length; i++) {
    const raw = arguments[i];
    const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    list.forEach(function (s) {
      const u = shotUrl(s);
      if (!u || seen[u]) return;
      seen[u] = true;
      shots.push({ url: u });
    });
  }
  return shots;
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
    const shots = slimShots(d.shots, d.url);
    if (shots.length) out[k].shots = shots;
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
        note: String(s.note || s.why || "")
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
    const shots = slimShots(b.shots, b.url, a.shots, a.url);
    if (shots.length) out[k].shots = shots;
    else delete out[k].shots;
  });
  return slimDocs(out);
}
function completeAppraisalFinal(af) {
  return !!(af && String(af.min || "").trim() && String(af.target || "").trim() && String(af.max || "").trim());
}

function slotHasNumbers(slot) {
  slot = slot || {};
  return !!(String(slot.min || "").trim() || String(slot.target || "").trim() || String(slot.max || "").trim() || String(slot.note || "").trim());
}

function rationaleRich(rat) {
  if (!rat || typeof rat !== "object") return false;
  if (String(rat.markdown || "").trim() || String(rat.title || "").trim()) return true;
  if (rat.panel && typeof rat.panel === "object") {
    var keys = Object.keys(rat.panel);
    for (var i = 0; i < keys.length; i++) {
      var s = rat.panel[keys[i]];
      if (!s || typeof s !== "object") continue;
      if (String(s.min || "").trim() || String(s.target || "").trim() || String(s.max || "").trim() || String(s.why || s.note || "").trim()) return true;
    }
  }
  return !!(rat.shabot && (rat.shabot.min || rat.shabot.target || rat.shabot.max || rat.shabot.note));
}

function rationaleScore(r) {
  if (!r || typeof r !== "object") return 0;
  var n = 0;
  if (String(r.schema_version || "") === "1.0") n += 20;
  n += String(r.markdown || "").trim().length;
  n += String(r.title || "").trim().length;
  n += String(r.shabot && (r.shabot.note || r.shabot.why) || "").trim().length;
  var p = r.panel;
  if (p && typeof p === "object") {
    Object.keys(p).forEach(function (k) {
      var s = p[k];
      if (!s || typeof s !== "object") return;
      if (s.min != null && s.min !== "") n += 4;
      if (s.target != null && s.target !== "") n += 4;
      if (s.max != null && s.max !== "") n += 4;
      n += String(s.why || s.note || "").trim().length;
    });
  }
  return n;
}

function mergeFinalRationale(prev, next) {
  var pr = prev && prev.finalRationale;
  var nr = next && next.finalRationale;
  var ps = rationaleScore(pr);
  var ns = rationaleScore(nr);
  if (ps > ns) {
    next.finalRationale = pr;
    return;
  }
  if (!nr || typeof nr !== "object") {
    if (pr) next.finalRationale = pr;
    return;
  }
  if (!pr || typeof pr !== "object") return;
  var merged = Object.assign({}, pr, nr);
  if (!String(nr.markdown || "").trim() && String(pr.markdown || "").trim()) merged.markdown = pr.markdown;
  if (!String(nr.title || "").trim() && String(pr.title || "").trim()) merged.title = pr.title;
  if (nr.shabot && typeof nr.shabot === "object" && pr.shabot && typeof pr.shabot === "object") {
    var sh = Object.assign({}, pr.shabot, nr.shabot);
    if (!String(nr.shabot.note || nr.shabot.why || "").trim() && String(pr.shabot.note || pr.shabot.why || "").trim()) {
      sh.note = pr.shabot.note || pr.shabot.why;
    }
    merged.shabot = sh;
  } else if (!nr.shabot && pr.shabot) {
    merged.shabot = pr.shabot;
  }
  if (String(pr.schema_version || "") === "1.0" && String(nr.schema_version || "") !== "1.0") {
    merged.schema_version = pr.schema_version;
  }
  var pp = pr.panel && typeof pr.panel === "object" ? pr.panel : {};
  var np = nr.panel && typeof nr.panel === "object" ? nr.panel : {};
  var panel = Object.assign({}, pp, np);
  Object.keys(pp).forEach(function (k) {
    var pslot = pp[k];
    var nslot = np[k];
    if (!pslot || typeof pslot !== "object") return;
    if (!nslot || typeof nslot !== "object") {
      panel[k] = pslot;
      return;
    }
    var m = Object.assign({}, pslot, nslot);
    if (!String(nslot.why || nslot.note || "").trim()) {
      if (pslot.why) m.why = pslot.why;
      if (pslot.note && !String(m.note || "").trim()) m.note = pslot.note;
    } else if (String(pslot.why || pslot.note || "").trim().length > String(nslot.why || nslot.note || "").trim().length) {
      if (pslot.why) m.why = pslot.why;
      if (pslot.note) m.note = pslot.note;
    }
    ["min", "target", "max"].forEach(function (f) {
      if ((nslot[f] == null || nslot[f] === "") && pslot[f] != null && pslot[f] !== "") m[f] = pslot[f];
    });
    panel[k] = m;
  });
  if (Object.keys(pp).length) merged.panel = panel;
  if (rationaleScore(merged) >= ns) next.finalRationale = merged;
}

function mergeTeamSlots(prev, next) {
  var pt = (prev && prev.team && typeof prev.team === "object") ? prev.team : {};
  var nt = (next && next.team && typeof next.team === "object") ? next.team : {};
  var out = Object.assign({}, pt, nt);
  ["shabot", "rybot", "webot", "drebot", "tbot"].forEach(function (k) {
    var p = pt[k];
    var n = nt[k];
    if (n && typeof n === "object" && p && typeof p === "object") {
      var m = Object.assign({}, p, n);
      var pn = String(p.note || "").trim();
      var nn = String(n.note || "").trim();
      if (pn.length > nn.length) m.note = p.note;
      ["min", "target", "max"].forEach(function (f) {
        if ((n[f] == null || n[f] === "") && p[f] != null && p[f] !== "") m[f] = p[f];
      });
      out[k] = m;
    } else if (p && !n) {
      out[k] = p;
    }
  });
  if (Object.keys(out).length) next.team = out;
}

function settleRunningIfFinal(item) {
  if (!item) return item;
  if (completeAppraisalFinal(item.appraisalFinal) && (item.teamActivated === true || item.teamStatus === "running")) {
    item.teamStatus = "final";
  }
  return item;
}

function keepExistingFinal(prev, next) {
  if (!prev || !next) return next;
  if (completeAppraisalFinal(prev.appraisalFinal) && !completeAppraisalFinal(next.appraisalFinal)) {
    next.appraisalFinal = prev.appraisalFinal;
    ["finalMin", "finalTarget", "finalMax", "finalPath", "finalAt"].forEach(function (k) {
      if (prev[k] != null && prev[k] !== "") next[k] = prev[k];
    });
  }
  // Empty/thin Center land (shabot-only refresh, schema_version stub, empty panel)
  // never wipes Incoming team.{rybot,webot,drebot,tbot,shabot} notes or
  // finalRationale schema_version 1.0 markdown + panel.
  mergeFinalRationale(prev, next);
  mergeTeamSlots(prev, next);
  return next;
}

function wakeAppraisalTeam(item) {
  const payload = {
    kind: "team",
    sendId: (item && item.sendId) || "",
    id: (item && item.id) || "",
    vin: (item && item.vin) || "",
    ymmt: (item && item.ymmt) || "",
    pdfUrl: (item && item.pdfUrl) || "",
    docs: (item && item.docs) || {},
    teamActivated: true
  };
  try {
    const notify = require("./notify-appraisal");
    const wake = {
      kind: "upsert",
      lane: "onsite-attention",
      id: payload.id,
      email: "shawn@myloan.ca",
      emails: ["shawn@myloan.ca"],
      vehicle: payload.ymmt || "",
      vin: payload.vin || "",
      missing: ["Appraisal Team activated"]
    };
    if (notify && typeof notify.route === "function") {
      Promise.resolve(notify.route(wake)).catch(function () {});
    }
  } catch (e) {}
  const hook = String((process.env && (process.env.APPRAISAL_TEAM_WEBHOOK || process.env.SLACK_WEBHOOK_URL)) || "").trim();
  if (hook && /^https?:\/\//i.test(hook) && typeof fetch === "function") {
    try {
      Promise.resolve(fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })).catch(function () {});
    } catch (e) {}
  }
  return payload;
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
    const flagLand = item.locked === true || item.locked === false || item.staffUnlocked === true
      || item.teamActivated === true || item.teamActivated === false;
    if (item.sentAt && prev.sentAt && item.sentAt < prev.sentAt && incomingHave <= prevHave && !flagLand) return prev;
    const next = keepExistingFinal(prev, slimItem(Object.assign({}, prev, item, {
      id: prev.id || item.id,
      docs: mergeDocsKeepUrls(prev.docs, item.docs),
      customer: {
        name: item.customer.name || prev.customer.name,
        email: item.customer.email || prev.customer.email,
        phone: item.customer.phone || prev.customer.phone
      }
    })));
    settleRunningIfFinal(next);
    list.splice(idx, 1);
    list.unshift(next);
    saveFile(list.slice(0, MAX));
    return next;
  }
  settleRunningIfFinal(item);
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
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const url = "https://7codzfkcbtucfujs.public.blob.vercel-storage.com/docs/" + encodeURIComponent(sendId) + "/" + key + "/" + stamp + "-" + safe;
  const list = loadFile();
  const idx = list.findIndex(function (x) { return x && x.sendId === sendId; });
  if (idx >= 0) {
    const item = list[idx];
    item.docs = item.docs || {};
    const prev = item.docs[key] && typeof item.docs[key] === "object" ? item.docs[key] : {};
    const shots = slimShots(prev.shots, prev.url, url);
    item.docs[key] = { have: true, name: name, type: type, url: url, shots: shots };
    item.updatedAt = Date.now();
    saveFile(list);
  }
  return { status: 200, body: { ok: true, url: url, sendId: sendId, key: key, name: name, shots: idx >= 0 ? (list[idx].docs[key].shots || []) : [{ url: url }] } };
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

function emptyUsersBlob() {
  return { users: [], teams: [], permissions: {}, updatedAt: 0 };
}
function usersMem() {
  if (!globalThis.__CENTER_USERS) globalThis.__CENTER_USERS = emptyUsersBlob();
  return globalThis.__CENTER_USERS;
}
function loadUsersFile() {
  try {
    const fs = require("fs");
    const raw = JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
    if (raw && typeof raw === "object") {
      globalThis.__CENTER_USERS = {
        users: Array.isArray(raw.users) ? raw.users : (Array.isArray(raw.people) ? raw.people : []),
        teams: Array.isArray(raw.teams) ? raw.teams : [],
        permissions: raw.permissions && typeof raw.permissions === "object" ? raw.permissions : {},
        updatedAt: Number(raw.updatedAt || 0)
      };
    }
  } catch (e) {}
  return usersMem();
}
function saveUsersFile(blob) {
  globalThis.__CENTER_USERS = blob;
  try {
    require("fs").writeFileSync(USERS_FILE, JSON.stringify(blob));
  } catch (e) {}
}
function slimUser(u) {
  if (!u || !u.email) return null;
  const email = String(u.email || "").trim().toLowerCase();
  if (!email || email.indexOf("@") < 1) return null;
  return {
    email: email,
    name: String(u.name || ""),
    teams: Array.isArray(u.teams) ? u.teams.filter(Boolean) : (u.team ? [u.team] : []),
    leader: !!u.leader,
    notes: String(u.notes || ""),
    phone: String(u.phone || ""),
    emailEditable: !!u.emailEditable
  };
}
function slimPermissions(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const out = {};
  Object.keys(src).forEach(function (k) {
    const e = String(k || "").trim().toLowerCase();
    if (!e || e.indexOf("@") < 1) return;
    const p = src[k] && typeof src[k] === "object" ? src[k] : {};
    out[e] = {
      trade: !!p.trade,
      appraise: !!p.appraise,
      website: !!p.website,
      center: !!p.center,
      admin: !!p.admin,
      ca: !!p.ca
    };
  });
  return out;
}
function buildUsersBlob(body) {
  body = body && typeof body === "object" ? body : {};
  const raw = Array.isArray(body.users) ? body.users : (Array.isArray(body.people) ? body.people : []);
  const users = raw.map(slimUser).filter(Boolean);
  const permissions = slimPermissions(body.permissions);
  const teams = Array.isArray(body.teams) ? body.teams.map(function (t) { return String(t || ""); }).filter(Boolean) : [];
  return { users: users, teams: teams, permissions: permissions, updatedAt: Date.now() };
}
function listUsers() {
  const blob = loadUsersFile();
  return {
    ok: true,
    kind: "users",
    users: blob.users || [],
    teams: blob.teams || [],
    permissions: blob.permissions || {},
    updatedAt: blob.updatedAt || 0,
    via: "blob"
  };
}
function persistUsers(body) {
  const next = buildUsersBlob(body);
  saveUsersFile(next);
  return { status: 200, body: { ok: true, kind: "users", updatedAt: next.updatedAt, via: "blob" } };
}
async function hydrateUsersFromBlob(deps) {
  try {
    const loaded = await usersStore.loadUsers(deps);
    if (loaded && usersStore.isPopulated(loaded)) {
      saveUsersFile(loaded);
      return loaded;
    }
    if (loaded && loaded.updatedAt) saveUsersFile(loaded);
  } catch (e) {}
  return loadUsersFile();
}
async function persistUsersDurable(body, deps) {
  const existing = await hydrateUsersFromBlob(deps);
  const next = buildUsersBlob(body);
  if (!usersStore.isPopulated(next) && usersStore.isPopulated(existing)) {
    return {
      status: 200,
      body: { ok: true, kind: "users", updatedAt: existing.updatedAt || 0, via: usersStore.via() || "blob", skipped: "empty" }
    };
  }
  saveUsersFile(next);
  let via = "blob";
  try {
    const saved = await usersStore.saveUsers(next, deps);
    via = (saved && saved.via) || "blob";
  } catch (e) {}
  return { status: 200, body: { ok: true, kind: "users", updatedAt: next.updatedAt, via: via } };
}
async function listUsersDurable(deps) {
  await hydrateUsersFromBlob(deps);
  const body = listUsers();
  try { body.via = usersStore.via() || body.via; } catch (e) {}
  return body;
}
function requestKind(req, body, query) {
  if (query && query.kind) return String(query.kind);
  if (body && body.kind) return String(body.kind);
  try {
    const raw = req && (req.url || "");
    if (raw) {
      const u = new URL(raw, "https://gnm-guest-mailer-shawn-6802.vercel.app");
      return u.searchParams.get("kind") || "";
    }
  } catch (e) {}
  return "";
}

function route(method, body, query) {
  method = String(method || "GET").toUpperCase();
  query = query || {};
  if (method === "OPTIONS") return { status: 204, body: { ok: true } };
  if (method === "GET") {
    if (String(query.kind || (body && body.kind) || "") === "users") return { status: 200, body: listUsers() };
    return { status: 200, body: { ok: true, items: listItems() } };
  }
  if (method !== "POST") return { status: 405, body: { ok: false, error: "method" } };
  body = body && typeof body === "object" ? body : {};
  if (body.kind === "users") return persistUsers(body);
  if (body.kind === "file") return persistFile(body);
  if (body.kind === "team") {
    const raw = (body.item && typeof body.item === "object") ? Object.assign({}, body.item, body) : body;
    raw.teamActivated = true;
    raw.teamActivatedAt = raw.teamActivatedAt || Date.now();
    raw.teamStatus = raw.teamStatus || "running";
    const has = raw.sendId || raw.vin || raw.id || raw.ymmt || (raw.customer && raw.customer.name);
    if (!has) return { status: 400, body: { ok: false, error: "empty" } };
    const item = persistItem(raw);
    try { wakeAppraisalTeam(item); } catch (e) {}
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
  let query = {};
  try {
    const raw = req && (req.url || (req.headers && (req.headers["x-url"] || req.headers["X-Url"])));
    if (req && req.url) {
      const u = new URL(req.url, "https://gnm-guest-mailer-shawn-6802.vercel.app");
      query.kind = u.searchParams.get("kind") || "";
    }
  } catch (e) {}
  const kind = requestKind(req, body, query) || (query && query.kind) || "";
  if (method === "GET" && kind === "users") {
    const bodyOut = await listUsersDurable();
    return { status: 200, body: bodyOut, origin: origin };
  }
  if (method === "POST" && body && body.kind === "users") {
    const outUsers = await persistUsersDurable(body);
    outUsers.origin = origin;
    return outUsers;
  }
  const out = route(method, body, query);
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
module.exports.wakeAppraisalTeam = wakeAppraisalTeam;
module.exports.keepExistingFinal = keepExistingFinal;
module.exports.completeAppraisalFinal = completeAppraisalFinal;
module.exports.resetStore = function resetStore() {
  globalThis.__CENTER_INCOMING = [];
  globalThis.__CENTER_USERS = emptyUsersBlob();
  try { usersStore.reset(); } catch (e) {}
  try { require("fs").unlinkSync(FILE); } catch (e) {}
  try { require("fs").unlinkSync(USERS_FILE); } catch (e) {}
};
module.exports.listUsers = listUsers;
module.exports.persistUsers = persistUsers;
module.exports.persistUsersDurable = persistUsersDurable;
module.exports.listUsersDurable = listUsersDurable;
module.exports.hydrateUsersFromBlob = hydrateUsersFromBlob;

module.exports.GET = async function GET(request) {
  const origin = request.headers.get("origin") || "";
  let kind = "";
  try { kind = new URL(request.url, "https://gnm-guest-mailer-shawn-6802.vercel.app").searchParams.get("kind") || ""; } catch (e) {}
  if (kind === "users") return json(null, 200, await listUsersDurable(), origin);
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
  if (body && body.kind === "users") {
    const outUsers = await persistUsersDurable(body);
    return json(null, outUsers.status, outUsers.body, origin);
  }
  const out = route("POST", body);
  return json(null, out.status, out.body, origin);
};
