/**
 * Durable Users settings store (roster + permission toggles).
 *
 * Prefers Vercel Blob when BLOB_READ_WRITE_TOKEN is set so GET/POST
 * across separate serverless isolates share one roster. Falls back to
 * USERS_STORE_PATH (default /tmp/center-users-v1.json) and memory
 * for tests. The Pages app still caches inspect.users in localStorage.
 *
 * Blob contract (kind:users) — live mailer hotfix:
 *   @vercel/blob put(pathname, body, {
 *     access: "public",
 *     allowOverwrite: true,
 *     addRandomSuffix: false,
 *     cacheControlMaxAge: 0,
 *     contentType: "application/json"
 *   })
 *   @vercel/blob get(pathname, { access: "public", useCache: false })
 *     so verify reads origin (CDN was stale after overwrite)
 *   payloadsMatch requires updatedAt + emails + permissions JSON
 *   via is "blob" only after origin verify; otherwise tmp/memory + blobErr
 *   verify backoff 0/200/400/800ms
 *   list fallback prefers exact center-users-v1.json pathname first
 */
const fs = require("fs");
const path = require("path");

const BLOB_NAME = "center-users-v1.json";
const BLOB_PREFIX = "center-users-v1";
const VERIFY_BACKOFF_MS = [0, 200, 400, 800];

let blobPut = null;
let blobGet = null;
try {
  const vercelBlob = require("@vercel/blob");
  blobPut = vercelBlob.put;
  blobGet = vercelBlob.get;
} catch (e) {}

let memory = emptyBlob();
let blobUrl = "";
let lastVia = "memory";
let lastBlobErr = "";

function emptyBlob() {
  return { users: [], teams: [], permissions: {}, updatedAt: 0 };
}

function storePath(env) {
  const e = env || process.env;
  return e.USERS_STORE_PATH || path.join("/tmp", BLOB_NAME);
}

function normalize(raw) {
  if (!raw || typeof raw !== "object") return emptyBlob();
  const users = Array.isArray(raw.users) ? raw.users : (Array.isArray(raw.people) ? raw.people : []);
  return {
    users: users.filter(function (u) { return u && u.email; }),
    teams: Array.isArray(raw.teams) ? raw.teams : [],
    permissions: raw.permissions && typeof raw.permissions === "object" ? raw.permissions : {},
    updatedAt: Number(raw.updatedAt || 0)
  };
}

function hasUsers(blob) {
  blob = blob || emptyBlob();
  return !!(blob.users && blob.users.length);
}

function isPopulated(blob) {
  blob = blob || emptyBlob();
  if (hasUsers(blob)) return true;
  if (blob.permissions && Object.keys(blob.permissions).length) return true;
  return false;
}

function listedAt(b) {
  if (!b || typeof b !== "object") return 0;
  function num(v) {
    if (v == null || v === "") return 0;
    if (typeof v === "number" && isFinite(v)) return v;
    const n = Number(v);
    if (isFinite(n) && n > 1e12) return n;
    const p = Date.parse(v);
    return isFinite(p) ? p : (isFinite(n) ? n : 0);
  }
  return num(b.updatedAt) || num(b.uploadedAt) || 0;
}

function pathnameOf(p) {
  return String(p || "").replace(/^\//, "");
}

function isExactUsersPath(pathname) {
  return pathnameOf(pathname) === BLOB_NAME;
}

function isUsersPath(pathname) {
  const p = pathnameOf(pathname);
  if (p === BLOB_NAME) return true;
  if (p.indexOf(BLOB_PREFIX) === 0) return true;
  if (p.indexOf("/" + BLOB_NAME) >= 0) return true;
  return false;
}

function pickNewestListed(blobs) {
  const matches = (blobs || []).filter(function (b) {
    return b && (b.url || b.pathname) && isUsersPath(b.pathname);
  });
  matches.sort(function (a, b) {
    const exactA = isExactUsersPath(a.pathname) ? 1 : 0;
    const exactB = isExactUsersPath(b.pathname) ? 1 : 0;
    if (exactA !== exactB) return exactB - exactA;
    const ua = listedAt(a);
    const ub = listedAt(b);
    return ub - ua;
  });
  return matches;
}

function userEmailsKey(blob) {
  return (blob && blob.users || []).map(function (u) {
    return String((u && u.email) || "").trim().toLowerCase();
  }).filter(Boolean).sort().join(",");
}

function permsKey(blob) {
  try {
    return JSON.stringify((blob && blob.permissions) || {});
  } catch (e) {
    return "";
  }
}

function payloadsMatch(expected, got) {
  if (!expected || !got) return false;
  if (Number(expected.updatedAt || 0) !== Number(got.updatedAt || 0)) return false;
  if (userEmailsKey(expected) !== userEmailsKey(got)) return false;
  return permsKey(expected) === permsKey(got);
}

function storeIdFromToken(token) {
  const parts = String(token || "").split("_");
  return parts.length >= 4 ? parts[3] : "";
}

function originGetUrl(token) {
  const storeId = storeIdFromToken(token);
  const base = storeId
    ? ("https://" + storeId + ".public.blob.vercel-storage.com/" + BLOB_NAME)
    : ("https://blob.vercel-storage.com/" + BLOB_NAME);
  return base + "?cache=0";
}

function defaultSleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function putHeaders(token) {
  return {
    Authorization: "Bearer " + token,
    "x-api-version": "7",
    "x-content-type": "application/json",
    "x-add-random-suffix": "0",
    "x-allow-overwrite": "1",
    "x-vercel-blob-access": "public",
    "x-cache-control-max-age": "0"
  };
}

async function fetchJson(url, token, fetchImpl) {
  const r = await fetchImpl(url, {
    headers: { Authorization: "Bearer " + token, "Cache-Control": "no-cache" },
    cache: "no-store"
  });
  if (!r || !r.ok) return null;
  const j = await r.json().catch(function () { return null; });
  return j && typeof j === "object" ? normalize(j) : null;
}

async function streamToJson(stream) {
  if (!stream) return null;
  if (typeof stream.json === "function") return stream.json();
  if (typeof stream.text === "function") {
    const t = await stream.text();
    return t ? JSON.parse(t) : null;
  }
  const chunks = [];
  if (typeof stream.getReader === "function") {
    const reader = stream.getReader();
    while (true) {
      const step = await reader.read();
      if (step.done) break;
      chunks.push(Buffer.from(step.value));
    }
  } else if (typeof stream[Symbol.asyncIterator] === "function") {
    for await (const c of stream) {
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
    }
  } else {
    return null;
  }
  if (!chunks.length) return null;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function readOriginExact(env, fetchFn) {
  const token = (env || process.env).BLOB_READ_WRITE_TOKEN || "";
  if (!token) return null;
  if (!fetchFn && blobGet) {
    try {
      const result = await blobGet(BLOB_NAME, {
        access: "public",
        useCache: false,
        token: token
      });
      if (!result || result.statusCode === 304) return null;
      const j = await streamToJson(result.stream);
      if (j && typeof j === "object") {
        if (result.blob && result.blob.url) blobUrl = result.blob.url;
        return normalize(j);
      }
    } catch (e) {}
  }
  const fetchImpl = fetchFn || fetch;
  try {
    const got = await fetchJson(originGetUrl(token), token, fetchImpl);
    if (got) {
      blobUrl = originGetUrl(token).replace(/\?cache=0$/, "");
      return got;
    }
  } catch (e) {}
  return null;
}

async function listUserBlobs(env, fetchFn) {
  const token = (env || process.env).BLOB_READ_WRITE_TOKEN || "";
  if (!token) return [];
  const fetchImpl = fetchFn || fetch;
  const r = await fetchImpl("https://blob.vercel-storage.com?prefix=" + encodeURIComponent(BLOB_PREFIX), {
    headers: { Authorization: "Bearer " + token, "x-api-version": "7" }
  });
  if (!r || !r.ok) return [];
  const listed = await r.json().catch(function () { return {}; });
  return pickNewestListed((listed && listed.blobs) || []);
}

async function readNewestPayload(ranked, token, fetchImpl) {
  let best = null;
  const n = Math.min(ranked.length, 8);
  for (let i = 0; i < n; i++) {
    const hit = ranked[i];
    if (!hit || !hit.url) continue;
    try {
      const got = await fetchJson(hit.url, token, fetchImpl);
      if (!got) continue;
      if (isExactUsersPath(hit.pathname)) {
        blobUrl = hit.url;
        return got;
      }
      if (!best || Number(got.updatedAt || 0) > Number(best.updatedAt || 0)) {
        best = got;
        blobUrl = hit.url;
      }
    } catch (e) {}
  }
  return best;
}

async function readBlob(env, fetchFn) {
  const token = (env || process.env).BLOB_READ_WRITE_TOKEN || "";
  if (!token) return null;
  const fetchImpl = fetchFn || fetch;
  try {
    const origin = await readOriginExact(env, fetchFn);
    if (origin) return origin;
  } catch (e) {}
  try {
    const ranked = await listUserBlobs(env, fetchImpl);
    if (ranked.length) {
      const newest = await readNewestPayload(ranked, token, fetchImpl);
      if (newest) return newest;
    }
  } catch (e) {}
  const fallback = blobUrl || ((env || process.env).USERS_BLOB_URL || "");
  if (fallback) {
    try {
      const got = await fetchJson(fallback, token, fetchImpl);
      if (got) return got;
    } catch (e) {}
  }
  return null;
}

async function writeBlob(payload, env, fetchFn) {
  const token = (env || process.env).BLOB_READ_WRITE_TOKEN || "";
  if (!token) return { ok: false, err: "no-token" };
  if (!fetchFn && blobPut) {
    try {
      const result = await blobPut(BLOB_NAME, JSON.stringify(payload), {
        access: "public",
        token: token,
        allowOverwrite: true,
        addRandomSuffix: false,
        cacheControlMaxAge: 0,
        contentType: "application/json"
      });
      if (result && result.url) blobUrl = result.url;
      else blobUrl = "https://blob.vercel-storage.com/" + BLOB_NAME;
      return { ok: true };
    } catch (e) {
      return { ok: false, err: String((e && e.message) || e || "put-failed") };
    }
  }
  const fetchImpl = fetchFn || fetch;
  try {
    const r = await fetchImpl("https://blob.vercel-storage.com/" + BLOB_NAME, {
      method: "PUT",
      headers: putHeaders(token),
      body: JSON.stringify(payload)
    });
    if (!r || !r.ok) return { ok: false, err: "http-" + ((r && r.status) || 0) };
    const j = await r.json().catch(function () { return {}; });
    if (j && j.url) blobUrl = j.url;
    else blobUrl = "https://blob.vercel-storage.com/" + BLOB_NAME;
    return { ok: true };
  } catch (e) {
    return { ok: false, err: String((e && e.message) || e || "put-failed") };
  }
}

async function verifyUsersBlob(payload, env, fetchFn, sleepFn) {
  const sleep = sleepFn || defaultSleep;
  for (let i = 0; i < VERIFY_BACKOFF_MS.length; i++) {
    const wait = VERIFY_BACKOFF_MS[i];
    if (wait) await sleep(wait);
    try {
      const got = await readOriginExact(env, fetchFn);
      if (payloadsMatch(payload, got)) return true;
    } catch (e) {}
  }
  return false;
}

function readFileStore(env) {
  try {
    const raw = fs.readFileSync(storePath(env), "utf8");
    const j = JSON.parse(raw);
    if (j && typeof j === "object") return normalize(j);
  } catch (e) {}
  return null;
}

function writeFileStore(payload, env) {
  try {
    fs.writeFileSync(storePath(env), JSON.stringify(payload));
    return true;
  } catch (e) {
    return false;
  }
}

async function loadUsers(deps) {
  deps = deps || {};
  lastBlobErr = "";
  if (deps.memory) {
    lastVia = "memory";
    return normalize(deps.memory);
  }
  const env = deps.env || process.env;
  const blob = await readBlob(env, deps.fetch);
  if (blob) {
    if (!hasUsers(blob) && hasUsers(memory)) {
      lastVia = "blob";
      return normalize(memory);
    }
    memory = blob;
    lastVia = "blob";
    return blob;
  }
  const file = readFileStore(env);
  if (file) {
    memory = file;
    lastVia = "tmp";
    return file;
  }
  lastVia = "memory";
  return normalize(memory);
}

async function saveUsers(blob, deps) {
  deps = deps || {};
  const payload = normalize(blob);
  payload.updatedAt = Number(payload.updatedAt || Date.now());
  lastBlobErr = "";
  if (deps.memory) {
    Object.keys(deps.memory).forEach(function (k) { delete deps.memory[k]; });
    Object.assign(deps.memory, payload);
    lastVia = "memory";
    return { ok: true, via: "memory", blob: payload };
  }
  memory = payload;
  const env = deps.env || process.env;
  const put = await writeBlob(payload, env, deps.fetch);
  let verified = false;
  let blobErr = "";
  if (put.ok) {
    verified = await verifyUsersBlob(payload, env, deps.fetch, deps.sleep);
    if (!verified) blobErr = "verify-mismatch";
  } else {
    blobErr = put.err || "put-failed";
  }
  const wroteFile = writeFileStore(payload, env);
  lastVia = verified ? "blob" : (wroteFile ? "tmp" : "memory");
  lastBlobErr = lastVia === "blob" ? "" : blobErr;
  const out = { ok: true, via: lastVia, blob: payload };
  if (lastBlobErr) out.blobErr = lastBlobErr;
  return out;
}

function reset() {
  memory = emptyBlob();
  blobUrl = "";
  lastVia = "memory";
  lastBlobErr = "";
}

function via() {
  return lastVia;
}

function blobErr() {
  return lastBlobErr;
}

module.exports = {
  BLOB_NAME: BLOB_NAME,
  BLOB_PREFIX: BLOB_PREFIX,
  VERIFY_BACKOFF_MS: VERIFY_BACKOFF_MS,
  emptyBlob: emptyBlob,
  normalize: normalize,
  hasUsers: hasUsers,
  isPopulated: isPopulated,
  listedAt: listedAt,
  pickNewestListed: pickNewestListed,
  payloadsMatch: payloadsMatch,
  loadUsers: loadUsers,
  saveUsers: saveUsers,
  verifyUsersBlob: verifyUsersBlob,
  reset: reset,
  via: via,
  blobErr: blobErr
};
