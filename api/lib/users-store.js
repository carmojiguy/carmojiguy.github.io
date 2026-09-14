/**
 * Durable Users settings store (roster + permission toggles).
 *
 * Prefers Vercel Blob when BLOB_READ_WRITE_TOKEN is set so GET/POST
 * across separate serverless isolates share one roster. Falls back to
 * USERS_STORE_PATH (default /tmp/center-users-v1.json) and memory
 * for tests. The Pages app still caches inspect.users in localStorage.
 *
 * Blob contract (kind:users):
 *   PUT pathname center-users-v1.json
 *   addRandomSuffix false (x-add-random-suffix: 0)
 *   allowOverwrite true (x-allow-overwrite: true)
 *   cacheControlMaxAge 0 so overwrite is what GET reads
 *   list prefix center-users-v1 → pick newest updatedAt/uploadedAt
 *   via is "blob" only after read-back verify of that same pathname
 */
const fs = require("fs");
const path = require("path");

const BLOB_NAME = "center-users-v1.json";
const BLOB_PREFIX = "center-users-v1";

let memory = emptyBlob();
let blobUrl = "";
let lastVia = "memory";

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

function isUsersPath(pathname) {
  const p = String(pathname || "").replace(/^\//, "");
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
    const ua = listedAt(a);
    const ub = listedAt(b);
    if (ua !== ub) return ub - ua;
    const exactA = String(a.pathname || "").replace(/^\//, "") === BLOB_NAME ? 1 : 0;
    const exactB = String(b.pathname || "").replace(/^\//, "") === BLOB_NAME ? 1 : 0;
    return exactB - exactA;
  });
  return matches;
}

function userEmailsKey(blob) {
  return (blob && blob.users || []).map(function (u) {
    return String((u && u.email) || "").trim().toLowerCase();
  }).filter(Boolean).sort().join(",");
}

function payloadsMatch(expected, got) {
  if (!expected || !got) return false;
  if (Number(expected.updatedAt || 0) && Number(got.updatedAt || 0) === Number(expected.updatedAt || 0)) {
    return userEmailsKey(expected) === userEmailsKey(got);
  }
  return userEmailsKey(expected) === userEmailsKey(got) && (expected.users || []).length === (got.users || []).length;
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
  if (!token) return false;
  const fetchImpl = fetchFn || fetch;
  try {
    const r = await fetchImpl("https://blob.vercel-storage.com/" + BLOB_NAME, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token,
        "x-api-version": "7",
        "x-content-type": "application/json",
        "x-add-random-suffix": "0",
        "x-allow-overwrite": "true",
        "x-cache-control-max-age": "0"
      },
      body: JSON.stringify(payload)
    });
    if (!r.ok) return false;
    const j = await r.json().catch(function () { return {}; });
    if (j && j.url) blobUrl = j.url;
    else blobUrl = "https://blob.vercel-storage.com/" + BLOB_NAME;
    return true;
  } catch (e) {
    return false;
  }
}

async function verifyUsersBlob(payload, env, fetchFn) {
  try {
    const got = await readBlob(env, fetchFn);
    return payloadsMatch(payload, got);
  } catch (e) {
    return false;
  }
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
  if (deps.memory) {
    Object.keys(deps.memory).forEach(function (k) { delete deps.memory[k]; });
    Object.assign(deps.memory, payload);
    lastVia = "memory";
    return { ok: true, via: "memory", blob: payload };
  }
  memory = payload;
  const env = deps.env || process.env;
  const wroteBlob = await writeBlob(payload, env, deps.fetch);
  const wroteFile = writeFileStore(payload, env);
  let via = wroteBlob ? "blob" : (wroteFile ? "tmp" : "memory");
  if (wroteBlob) {
    const verified = await verifyUsersBlob(payload, env, deps.fetch);
    if (!verified) via = wroteFile ? "tmp" : "memory";
  }
  lastVia = via;
  return { ok: true, via: lastVia, blob: payload };
}

function reset() {
  memory = emptyBlob();
  blobUrl = "";
  lastVia = "memory";
}

function via() {
  return lastVia;
}

module.exports = {
  BLOB_NAME: BLOB_NAME,
  BLOB_PREFIX: BLOB_PREFIX,
  emptyBlob: emptyBlob,
  normalize: normalize,
  hasUsers: hasUsers,
  isPopulated: isPopulated,
  listedAt: listedAt,
  pickNewestListed: pickNewestListed,
  loadUsers: loadUsers,
  saveUsers: saveUsers,
  verifyUsersBlob: verifyUsersBlob,
  reset: reset,
  via: via
};
