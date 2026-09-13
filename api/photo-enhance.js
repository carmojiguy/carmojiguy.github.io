/**
 * Website-photo enhance stub (Pages + Vercel).
 *
 * This repo’s live UI is GitHub Pages. The client always ships a
 * deterministic local canvas fallback so Shawn can click the full
 * retouch → background → approve → post flow with no keys.
 *
 * If this function is deployed (same Vercel project as api/upload.js,
 * or a later host), POST JSON:
 *   { mode, backgroundId, blurPlate, photos:[{id,data,view,kind}] }
 *
 * Optional server-only env (never put these in the frontend):
 *   PHOTO_ENHANCE_KEY          Provider secret, if a paid Spyne-class
 *                              or Replicate/OpenAI image job is wired later
 *   REPLICATE_API_TOKEN        Alternate provider token
 *   PHOTO_ENHANCE_PROVIDER     "local" (default) | future provider id
 *
 * v1 never blocks the UI on keys. Missing env returns
 * { ok:true, engine:"local-fallback", photos:null } and the client
 * runs WebStudio.processPhotos locally.
 *
 * Damage-preserving contract (encode in any future remote prompt):
 *   Damage stays. Dirt goes.
 *   Remove dirt/grime; interiors look freshly detailed.
 *   NEVER heal scratches, dents, chips, cracks, or rust.
 *   Lighting/exposure polish is OK.
 */

const ALLOW = [
  "https://carmojiguy.github.io",
  "https://gnm-guest-mailer-shawn-6802.vercel.app"
];

const DAMAGE_STAYS_PROMPT =
  "Damage stays. Dirt goes. Remove dirt, dust, and grime only. " +
  "Make the vehicle look freshly detailed, including a dirty interior. " +
  "Do not inpaint, heal, blur, or reconstruct scratches, dents, chips, " +
  "cracks, rust, or broken glass. Lighting and exposure polish is allowed.";

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

async function route(body, origin) {
  const payload = body || {};
  const hasKey = !!(process.env.PHOTO_ENHANCE_KEY || process.env.REPLICATE_API_TOKEN);
  const provider = String(process.env.PHOTO_ENHANCE_PROVIDER || "local").toLowerCase();
  if (payload.kind === "ping" || !payload.photos) {
    return json(null, 200, {
      ok: true,
      engine: hasKey && provider !== "local" ? "remote-ready" : "local-fallback",
      photos: null,
      prompt: DAMAGE_STAYS_PROMPT,
      keyed: hasKey
    }, origin);
  }
  return json(null, 200, {
    ok: true,
    engine: "local-fallback",
    photos: null,
    prompt: DAMAGE_STAYS_PROMPT,
    message: "No remote enhance configured. Client should run the local composite."
  }, origin);
}

module.exports = async function handler(req, res) {
  const origin = (req.headers && (req.headers.origin || req.headers.Origin)) || "";
  if (req.method === "OPTIONS") {
    if (typeof res.status === "function") {
      Object.entries(cors(origin)).forEach(function (e) { res.setHeader(e[0], e[1]); });
      return res.status(204).end();
    }
    return new Response("", { status: 204, headers: cors(origin) });
  }
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body || "{}"); } catch (e) { body = {}; }
  }
  return route(body, origin);
};

module.exports.route = route;
module.exports.DAMAGE_STAYS_PROMPT = DAMAGE_STAYS_PROMPT;
