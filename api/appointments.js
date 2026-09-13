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
 * Optional query: source=Canada Drives|Car Loans Canada|My Loan|My Auto
 *                 region=GTA|Ottawa  range=today|tomorrow|month|lastMonth
 *                 from=YYYY-MM-DD  to=YYYY-MM-DD
 *
 * Filters (fixed):
 *   Stage = Appointment Booked (selqqamHvfGvK4CmK)
 *        OR On-Site Visit (selaCJ91ZmmGKF7i1)
 *   Consumer Acquisition Source = the requested lead source
 *   Each item.stage is "booked" or "on-site"
 *   My Loan / My Auto have no Airtable choice yet — returns live:false
 *   Carla maps to Airtable "Car Loans Canada" (sel1yiqhhgbkHpABm)
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

function formula(sourceName) {
  const src = airtableSourceName(sourceName);
  if (src === "My Loan" || src === "My Auto") {
    return "";
  }
  return "AND(OR({Stage}='Appointment Booked',{Stage}='On-Site Visit'),{Consumer Acquisition Source}='" + src.replace(/'/g, "\\'") + "')";
}

async function airtablePage(offset, sourceName) {
  const token = process.env.AIRTABLE_TOKEN || "";
  if (!token) return { live: false, records: [], reason: "AIRTABLE_TOKEN is not set on the mailer host." };
  const src = airtableSourceName(sourceName);
  if (src === "My Loan" || src === "My Auto") {
    return { live: false, records: [], reason: "Airtable does not have a " + src + " source choice yet." };
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

async function handle(req, res) {
  const origin = (req.headers && (req.headers.origin || req.headers.Origin)) || "";
  const method = req.method || "GET";
  if (method === "OPTIONS") return json(res, 204, {}, origin);
  if (method !== "GET") return json(res, 405, { ok: false, error: "GET only" }, origin);
  try {
    const url = req.url ? new URL(req.url, "https://gnm-guest-mailer-shawn-6802.vercel.app") : null;
    const sourceName = (url && url.searchParams.get("source")) || "Canada Drives";
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
module.exports.STAGE_BOOKED = STAGE_BOOKED;
module.exports.STAGE_ONSITE = STAGE_ONSITE;
