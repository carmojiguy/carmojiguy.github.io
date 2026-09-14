/**
 * Durable Users settings store (roster + permission toggles).
 *
 * Prefers Vercel Blob when BLOB_READ_WRITE_TOKEN is set so GET/POST
 * across separate serverless isolates share one roster. Falls back to
 * USERS_STORE_PATH (default /tmp/center-users-v1.json) and memory
 * for tests. The Pages app still caches inspect.users in localStorage.
 */
const fs = require("fs");
const path = require("path");

const BLOB_NAME = "center-users-v1.json";

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

function isPopulated(blob) {
  blob = blob || emptyBlob();
  if (blob.users && blob.users.length) return true;
  if (blob.permissions && Object.keys(blob.permissions).length) return true;
  return false;
}

async function readBlob(env, fetchFn) {
  const token = (env || process.env).BLOB_READ_WRITE_TOKEN || "";
  if (!token) return null;
  const fetchImpl = fetchFn || fetch;
  const url = blobUrl || ((env || process.env).USERS_BLOB_URL || "");
  if (url) {
    try {
      const r = await fetchImpl(url, { headers: { Authorization: "Bearer " + token } });
      if (r.ok) {
        const j = await r.json();
        if (j && typeof j === "object") return normalize(j);
      }
    } catch (e) {}
  }
  try {
    const r = await fetchImpl("https://blob.vercel-storage.com?prefix=" + encodeURIComponent(BLOB_NAME), {
      headers: { Authorization: "Bearer " + token, "x-api-version": "7" }
    });
    if (!r.ok) return null;
    const listed = await r.json().catch(function () { return {}; });
    const blobs = (listed && listed.blobs) || [];
    const hit = blobs.find(function (b) {
      return b && (b.pathname === BLOB_NAME || String(b.pathname || "").indexOf(BLOB_NAME) >= 0);
    });
    if (!hit || !hit.url) return null;
    blobUrl = hit.url;
    const got = await fetchImpl(hit.url, { headers: { Authorization: "Bearer " + token } });
    if (!got.ok) return null;
    const j = await got.json();
    return j && typeof j === "object" ? normalize(j) : null;
  } catch (e) {
    return null;
  }
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
        "x-allow-overwrite": "true"
      },
      body: JSON.stringify(payload)
    });
    if (!r.ok) return false;
    const j = await r.json().catch(function () { return {}; });
    if (j && j.url) blobUrl = j.url;
    return true;
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
    memory = blob;
    lastVia = "blob";
    return blob;
  }
  const file = readFileStore(env);
  if (file) {
    memory = file;
    lastVia = "file";
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
  writeFileStore(payload, env);
  lastVia = wroteBlob ? "blob" : "file";
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
  emptyBlob: emptyBlob,
  normalize: normalize,
  isPopulated: isPopulated,
  loadUsers: loadUsers,
  saveUsers: saveUsers,
  reset: reset,
  via: via
};
