/**
 * Live appointments pull for Appraise → Consumer Acquisition.
 *
 * Static GitHub Pages cannot hold an Airtable token. This Vercel function
 * is the wire-live path. Empty live lists are OK. No sample cars.
 *
 * Paste into Vercel → Project → Settings → Environment Variables
 * (Production + Preview), then Redeploy:
 *
 *   AIRTABLE_TOKEN   Personal access token with read access to
 *                    Command Center base appfy57egeT1utqaI
 *                    table Consumer Acquisitions tbl2QiJ40S6A7IzyR
 *
 * Optional query: source=Canada Drives (only). Other CA sources use New application.
 *                 region=GTA|Ottawa  range=today|tomorrow|month|lastMonth
 *                 from=YYYY-MM-DD  to=YYYY-MM-DD
 *
 * Filters (fixed):
 *   Stage = Appointment Booked (selqqamHvfGvK4CmK)
 *        OR On-Site Visit (selaCJ91ZmmGKF7i1)
 *   Consumer Acquisition Source = Canada Drives
 *   Each item.stage is "booked" or "on-site"
 *   My Loan / My Auto / Carla / Car Loans Canada have no appointment calendar.
 */
const ALLOW = [
  "https://carmojiguy.github.io",
  "https://gnm-guest-mailer-shawn-6802.vercel.app"
];

const BASE = "appfy57egeT1utqaI";
const TABLE = "tbl2QiJ40S6A7IzyR";
const F = {
  appNo: "flds1XRKp8DKl6zaS",
  apptDate: "fld1XA54MkplAPnFH",
  bookedAt: "fldWYvI4X1w6rK6Hq",
  seller: "fldCHTFWNcYeF9MIT",
  vin: "fldFLTbpXZAQ5RiOr",
  ymm: "fld7T0bVJ3z6ndPbi",
  ymmFormula: "fldfNjc0FaBGcKHJ4",
  year: "fldJ36MNHugrZ5rjG",
  make: "fld1c2w8nYxMcZdlo",
  model: "fldm6HZP0gRt6cOlc",
  trim: "flduWS4Ja0Ghj7Dho",
  location: "fld7VUCC2ML89bMME",
  stage: "fldTyRUrsJS9ffZ3Z",
  source: "fldPIGZz38Fd4X5I8"
};
const STAGE_BOOKED = "selqqamHvfGvK4CmK";
const STAGE_ONSITE = "selaCJ91ZmmGKF7i1";
const SOURCE_CD = "sel90QtMNs2kN0MbE";

function cors(origin) {
  const allow = ALLOW.some(function (a) {
    return origin === a || (origin && origin.indexOf("github.io") >= 0) || (origin && origin.indexOf("vercel.app") >= 0) || (origin && origin.indexOf("localhost") >= 0);
  });
  return {
    "Access-Control-Allow-Origin": allow && origin ? origin : ALLOW[0],
    "Access-Control-Allow-Methods": "GET,OPTIONS",
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

function cellName(v) {
  if (v == null) return "";
  if (typeof v === "object") return String(v.name || v.id || "").trim();
  return String(v).trim();
}

function apptRegion(v) {
  const s = cellName(v).toUpperCase();
  if (s.indexOf("GTA") >= 0) return "GTA";
  if (s.indexOf("OTTAWA") >= 0) return "Ottawa";
  return "";
}

function pickDate(fields) {
  return cellName(fields[F.apptDate]) || cellName(fields[F.bookedAt]) || "";
}

function mapStage(v) {
  const id = (v && typeof v === "object") ? String(v.id || "") : "";
  const s = cellName(v).toLowerCase();
  if (id === STAGE_ONSITE || /on[-\s]?site/.test(s)) return "on-site";
  if (id === STAGE_BOOKED || /booked/.test(s)) return "booked";
  return "booked";
}

function mapRecord(rec) {
  const f = rec.fields || rec.cellValuesByFieldId || {};
  const ymm = cellName(f[F.ymm]) || cellName(f[F.ymmFormula]);
  return {
    id: rec.id,
    appNo: cellName(f[F.appNo]),
    ymm: ymm.replace(/\s+/g, " ").trim(),
    year: cellName(f[F.year]),
    make: cellName(f[F.make]),
    model: cellName(f[F.model]),
    trim: cellName(f[F.trim]),
    seller: cellName(f[F.seller]),
    vin: cellName(f[F.vin]),
    date: pickDate(f),
    region: apptRegion(f[F.location]),
    source: cellName(f[F.source]),
    stage: mapStage(f[F.stage])
  };
}

function airtableSourceName(raw) {
  const s = String(raw || "").trim();
  if (!s || /^canada\s*drives$/i.test(s)) return "Canada Drives";
  if (/^carla$/i.test(s) || /car loans canada/i.test(s)) return "Car Loans Canada";
  if (/^my loan$/i.test(s)) return "My Loan";
  if (/^my auto$/i.test(s)) return "My Auto";
  return s;
}

function usesAppointmentsSource(raw) {
  return airtableSourceName(raw) === "Canada Drives";
}

function formula(sourceName) {
  const src = airtableSourceName(sourceName);
  if (!usesAppointmentsSource(src)) {
    return "";
  }
  return "AND(OR({Stage}='Appointment Booked',{Stage}='On-Site Visit'),{Consumer Acquisition Source}='" + src.replace(/'/g, "\\'") + "')";
}

async function airtablePage(offset, sourceName) {
  const token = process.env.AIRTABLE_TOKEN || "";
  if (!token) return { live: false, records: [], reason: "AIRTABLE_TOKEN is not set on the mailer host." };
  const src = airtableSourceName(sourceName);
  if (!usesAppointmentsSource(src)) {
    return { live: true, records: [], appointments: false, reason: "Appointments are Canada Drives only. Use New application." };
  }
  const q = new URLSearchParams();
  q.set("filterByFormula", formula(src));
  q.set("pageSize", "100");
  [
    F.appNo, F.apptDate, F.bookedAt, F.seller, F.vin, F.ymm, F.ymmFormula,
    F.year, F.make, F.model, F.trim, F.location, F.stage
  ].forEach(function (id) { q.append("fields[]", id); });
  if (offset) q.set("offset", offset);
  const r = await fetch("https://api.airtable.com/v0/" + BASE + "/" + TABLE + "?" + q.toString(), {
    headers: { Authorization: "Bearer " + token }
  });
  const body = await r.json().catch(function () { return {}; });
  if (!r.ok) {
    return { live: false, records: [], reason: "Airtable said " + r.status + ". Check AIRTABLE_TOKEN and base access." };
  }
  return { live: true, records: body.records || [], offset: body.offset || "" };
}

async function allRecords(sourceName) {
  const out = [];
  let offset = "";
  let pages = 0;
  while (pages < 8) {
    const page = await airtablePage(offset, sourceName);
    if (!page.live) return page;
    page.records.forEach(function (rec) { out.push(rec); });
    if (!page.offset) return { live: true, records: out };
    offset = page.offset;
    pages += 1;
  }
  return { live: true, records: out };
}

const TRACKER = {
  GTA: { id: "1DXKFHK_k1cC_upbxzBIVTLbMKpOIv0u5MB2NbKq5XhM", via: "gta-tracker" },
  Ottawa: { id: "1QRmPSMX_-nksYs4ucJxZUfTQcvrMlfbnylJgTL0ckNU", via: "ottawa-tracker" }
};
const TRACKER_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function trackerCurrentMonth(now) {
  const d = now instanceof Date ? now : new Date();
  return TRACKER_MONTHS[d.getMonth()] || "January";
}

function excelSerialDate(v) {
  const n = Number(v);
  if (!n || n < 20000) {
    const s = String(v || "").trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const t = Date.parse(s);
    return t ? new Date(t).toISOString().slice(0, 10) : "";
  }
  const d = new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000);
  return d.toISOString().slice(0, 10);
}

function headerKey(v) {
  return String(v || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function colOf(headers, names) {
  const want = names.map(headerKey);
  for (let i = 0; i < headers.length; i++) {
    const h = headerKey(headers[i]);
    if (want.some(function (n) { return h === n || h.indexOf(n) >= 0; })) return i;
  }
  return -1;
}

function parseTrackerMatrix(values, region, via) {
  const rows = Array.isArray(values) ? values : [];
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const line = (rows[i] || []).join(" ").toLowerCase();
    if (line.indexOf("app-number") >= 0 || line.indexOf("app number") >= 0 || /\bapp\s*#/.test(line)) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return [];
  const headers = rows[headerIdx] || [];
  const appI = colOf(headers, ["app-number", "app number", "app #", "application"]);
  const ymmI = colOf(headers, ["year make model trim", "ymm", "vehicle"]);
  const sellerI = colOf(headers, ["seller name", "seller"]);
  const dateI = colOf(headers, ["appt. date", "appt date", "appointment date"]);
  const vinI = colOf(headers, ["vin"]);
  const cityI = colOf(headers, ["seller city", "city"]);
  const phoneI = colOf(headers, ["seller phone", "phone"]);
  const statusI = colOf(headers, ["appointment status", "status"]);
  const out = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const appNo = String(row[appI] || "").trim();
    if (!appNo || !/app/i.test(appNo)) continue;
    const ymm = String(row[ymmI] || "").replace(/\s+/g, " ").trim();
    out.push({
      id: (region === "Ottawa" ? "ott-" : "gta-") + appNo.toUpperCase().replace(/[^A-Z0-9]/g, ""),
      appNo: appNo,
      ymm: ymm,
      seller: String(row[sellerI] || "").trim(),
      vin: String(row[vinI] || "").replace(/\s+/g, "").toUpperCase(),
      date: excelSerialDate(row[dateI]),
      city: String(row[cityI] || "").trim(),
      phone: String(row[phoneI] || "").trim(),
      status: String(row[statusI] || "").trim(),
      region: region,
      location: region,
      source: "Canada Drives",
      stage: /on[-\s]?site/i.test(String(row[statusI] || "")) ? "on-site" : "booked",
      via: via
    });
  }
  return out;
}

function needleOf(q) {
  return String(q || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function isoMonthName(iso) {
  const d = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "";
  return TRACKER_MONTHS[Number(d.slice(5, 7)) - 1] || "";
}

function inTrackerRegion(row, region) {
  const r = apptRegion((row && (row.region || row.location)) || "");
  if (r === region) return true;
  if (region === "GTA" && !r) return true;
  return false;
}

function mergeAppointmentRows(a, b) {
  const seen = {};
  const out = [];
  function add(row) {
    if (!row) return;
    const key = needleOf(row.appNo || row.id);
    if (key && Object.prototype.hasOwnProperty.call(seen, key)) {
      const i = seen[key];
      const cur = out[i];
      if ((!cur.vin || cur.vin === "TBD") && row.vin && row.vin !== "TBD") {
        out[i] = Object.assign({}, cur, {
          vin: row.vin,
          ymm: cur.ymm || row.ymm,
          seller: cur.seller || row.seller
        });
      }
      return;
    }
    if (key) seen[key] = out.length;
    out.push(row);
  }
  (a || []).forEach(add);
  (b || []).forEach(add);
  return out;
}

function matchApp(row, needle) {
  if (!needle) return false;
  const app = String((row && (row.appNo || row.cdApp)) || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return !!(app && (app.indexOf(needle) >= 0 || needle.indexOf(app) >= 0));
}

async function sheetsAccess() {
  const direct = process.env.GOOGLE_SHEETS_TOKEN || "";
  if (direct) return direct;
  const key = process.env.GOOGLE_API_KEY || "";
  if (key) return { key: key };
  return "";
}

async function fetchSheetValues(spreadsheetId, sheetName) {
  const auth = await sheetsAccess();
  const range = encodeURIComponent(sheetName + "!A1:Z400");
  const base = "https://sheets.googleapis.com/v4/spreadsheets/" + spreadsheetId + "/values/" + range;
  const url = auth && auth.key ? (base + "?key=" + encodeURIComponent(auth.key)) : base;
  const headers = typeof auth === "string" && auth ? { Authorization: "Bearer " + auth } : {};
  const r = await fetch(url, { headers: headers, cache: "no-store" });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok) return { ok: false, values: [], reason: "Sheets said " + r.status };
  return { ok: true, values: j.values || [] };
}

async function fetchSheetBatch(spreadsheetId, sheetNames) {
  const auth = await sheetsAccess();
  const q = new URLSearchParams();
  sheetNames.forEach(function (name) { q.append("ranges", name + "!A1:Z400"); });
  if (auth && auth.key) q.set("key", auth.key);
  const url = "https://sheets.googleapis.com/v4/spreadsheets/" + spreadsheetId + "/values:batchGet?" + q.toString();
  const headers = typeof auth === "string" && auth ? { Authorization: "Bearer " + auth } : {};
  const r = await fetch(url, { headers: headers, cache: "no-store" });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok) return { ok: false, valueRanges: [], reason: "Sheets said " + r.status };
  return { ok: true, valueRanges: j.valueRanges || [] };
}

async function trackerMonthRows(region, month) {
  const spec = TRACKER[region] || TRACKER.GTA;
  const pulled = await fetchSheetValues(spec.id, month);
  if (!pulled.ok) return pulled;
  return { ok: true, items: parseTrackerMatrix(pulled.values, region, spec.via) };
}

async function searchTrackerSheets(q) {
  const needle = needleOf(q);
  if (!needle) return { ok: true, items: [] };
  const out = [];
  const regions = ["GTA", "Ottawa"];
  for (let r = 0; r < regions.length; r++) {
    const spec = TRACKER[regions[r]];
    const pulled = await fetchSheetBatch(spec.id, TRACKER_MONTHS);
    if (!pulled.ok) continue;
    pulled.valueRanges.forEach(function (block) {
      parseTrackerMatrix(block.values || [], regions[r], spec.via).forEach(function (row) {
        if (matchApp(row, needle)) out.push(row);
      });
    });
  }
  return { ok: true, items: out };
}

async function handle(req, res) {
  const origin = (req.headers && (req.headers.origin || req.headers.Origin)) || "";
  const method = req.method || "GET";
  if (method === "OPTIONS") return json(res, 204, {}, origin);
  if (method !== "GET") return json(res, 405, { ok: false, error: "GET only" }, origin);
  try {
    const url = req.url ? new URL(req.url, "https://gnm-guest-mailer-shawn-6802.vercel.app") : null;
    const sourceName = (url && url.searchParams.get("source")) || "Canada Drives";
    const typed = url ? String(url.searchParams.get("q") || "").trim() : "";
    const view = url ? String(url.searchParams.get("view") || "").trim() : "";
    const month = url ? String(url.searchParams.get("month") || "").trim() : "";
    const regionRaw = url ? String(url.searchParams.get("region") || "").trim() : "";
    const region = /ottawa/i.test(regionRaw) ? "Ottawa" : "GTA";
    if (view === "tracker") {
      const useMonth = TRACKER_MONTHS.indexOf(month) >= 0 ? month : trackerCurrentMonth();
      const pulled = await trackerMonthRows(region, useMonth);
      const sheetItems = pulled.ok ? (pulled.items || []) : [];
      const air = await allRecords("Canada Drives");
      const airItems = (air.live ? air.records.map(mapRecord) : []).filter(function (row) {
        return inTrackerRegion(row, region) && isoMonthName(row.date) === useMonth;
      });
      const items = mergeAppointmentRows(airItems, sheetItems);
      const live = !!(air.live || pulled.ok);
      return json(res, 200, {
        ok: true,
        live: live,
        view: "tracker",
        month: useMonth,
        region: region,
        items: items,
        via: sheetItems.length && airItems.length ? "sheet+airtable" : (sheetItems.length ? "sheet" : "airtable"),
        reason: live ? "" : (pulled.reason || air.reason || "Couldn’t load the month.")
      }, origin);
    }
    if (!usesAppointmentsSource(sourceName)) {
      return json(res, 200, { ok: true, live: true, items: [], appointments: false, reason: "Appointments are Canada Drives only. Use New application." }, origin);
    }
    if (typed) {
      const found = await searchTrackerSheets(typed);
      if (found.items && found.items.length) {
        return json(res, 200, { ok: true, live: true, items: found.items, count: found.items.length, source: sourceName }, origin);
      }
      const slim = await allRecords(sourceName);
      const air = (slim.live ? slim.records.map(mapRecord) : []).filter(function (row) {
        return matchApp(row, needleOf(typed));
      });
      return json(res, 200, { ok: true, live: true, items: air, count: air.length, source: sourceName }, origin);
    }
    const pulled = await allRecords(sourceName);
    if (!pulled.live) {
      return json(res, 200, { ok: true, live: false, items: [], reason: pulled.reason, wire: "Set AIRTABLE_TOKEN on the Vercel mailer, redeploy, then GET /api/appointments." }, origin);
    }
    return json(res, 200, {
      ok: true,
      live: true,
      items: pulled.records.map(mapRecord),
      source: { base: BASE, table: TABLE, stages: ["Appointment Booked", "On-Site Visit"], source: airtableSourceName(sourceName) }
    }, origin);
  } catch (e) {
    return json(res, 200, { ok: true, live: false, items: [], reason: "Couldn’t reach Airtable." }, origin);
  }
}

module.exports = handle;
module.exports.default = handle;
module.exports.mapStage = mapStage;
module.exports.formula = formula;
module.exports.usesAppointmentsSource = usesAppointmentsSource;
module.exports.STAGE_BOOKED = STAGE_BOOKED;
module.exports.STAGE_ONSITE = STAGE_ONSITE;
module.exports.trackerCurrentMonth = trackerCurrentMonth;
module.exports.parseTrackerMatrix = parseTrackerMatrix;
module.exports.excelSerialDate = excelSerialDate;
module.exports.matchApp = matchApp;
module.exports.needleOf = needleOf;
module.exports.isoMonthName = isoMonthName;
module.exports.inTrackerRegion = inTrackerRegion;
module.exports.mergeAppointmentRows = mergeAppointmentRows;
