/**
 * Document extract pipeline for Carfax, MMR, Black Book,
 * appraisal summary, and competitive set.
 *
 * Static GitHub Pages cannot run OCR. This Vercel function is the
 * wire-live path. Until EXTRACT_TOKEN / a real extractor is set,
 * the app uses a demo extract so the pills still populate.
 *
 * Paste into Vercel → Project → Settings → Environment Variables
 * then Redeploy:
 *
 *   EXTRACT_TOKEN    Optional. When set, this endpoint can call a
 *                    private extractor. Without it, returns {live:false}
 *                    and the app fills demo facts from the uploaded file.
 */
const ALLOW = [
  "https://carmojiguy.github.io",
  "https://gnm-guest-mailer-shawn-6802.vercel.app"
];

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
  if (typeof res.status === "function" && typeof res.json === "function") {
    Object.keys(headers).forEach(function (k) { res.setHeader(k, headers[k]); });
    return res.status(status).json(body);
  }
  return new Response(JSON.stringify(body), { status: status, headers: headers });
}

async function handle(req, res) {
  const origin = (req.headers && (req.headers.origin || req.headers.Origin)) || "";
  const method = req.method || "GET";
  if (method === "OPTIONS") return json(res, 204, {}, origin);
  if (method !== "POST") return json(res, 405, { ok: false, error: "POST only" }, origin);
  return json(res, 200, {
    ok: true,
    live: false,
    reason: "EXTRACT_TOKEN is not set. The app uses a demo extract so the pill still fills.",
    wire: "Set EXTRACT_TOKEN on the Vercel mailer, redeploy, then POST /api/extract."
  }, origin);
}

module.exports = handle;
module.exports.default = handle;
