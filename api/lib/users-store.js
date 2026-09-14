/**
 * Durable Users settings store (roster + permission toggles).
 *
 * Prefers Vercel Blob when BLOB_READ_WRITE_TOKEN is set so GET/POST
 * across separate serverless isolates share one roster. Falls back to
 * USERS_STORE_PATH (default /tmp/center-users-v1.json) and memory
 * for tests. The Pages app still caches inspect.users in localStorage.
 *
 * Blob PUT uses the SDK wire format (x-allow-overwrite: 1, not "true";
 * x-vercel-blob-access required) so a later 33-user write actually
 * replaces an older empty center-users-v1.json. GET never prefers a
 * users:[] blob over a nonempty tmp/memory roster.
 */
const fs = require("fs");
const path = require("path");

const BLOB_NAME = "center-users-v1.json";
const BLOB_PREFIX = "center-users-v1";

let memory = emptyBlob();
let blobUrl = "";
let lastVia = "memory";

function emptyBlob() {
  return { users: [], people: [], teams: [], permissions: {}, updatedAt: 0 };
}

function storePath(env) {
  const e = env || process.env;
  return e.USERS_STORE_PATH || path.join("/tmp", BLOB_NAME);
}

function rosterOf(raw) {
  const fromUsers = Array.isArray(raw.users) ? raw.users : null;
  const fromPeople = Array.isArray(raw.people) ? raw.people : null;
  if (fromUsers && fromUsers.length) return fromUsers;
  if (fromPeople && fromPeople.length) return fromPeople;
  if (fromUsers) return fromUsers;
  if (fromPeople) return fromPeople;
  return [];
}

function normalizeUsersStore(raw) {
  if (!raw || typeof raw !== "object") return emptyBlob();
  const users = rosterOf(raw).filter(function (u) { return u && u.email; });
  return {
    users: users,
    people: users,
    teams: Array.isArray(raw.teams) ? raw.teams : [],
    permissions: raw.permissions && typeof raw.permissions === "object" ? raw.permissions : {},
    updatedAt: Number(raw.updatedAt || 0)
  };
}

function normalize(raw) {
  return normalizeUsersStore(raw);
}

function countUsers(blob) {
  return (blob && Array.isArray(blob.users) && blob.users.length) ? blob.users.length : 0;
}

function isPopulated(blob) {
  blob = blob || emptyBlob();
  if (countUsers(blob)) return true;
  if (blob.permissions && Object.keys(blob.permissions).length) return true;
  return false;
}

function mergePermissions(base, extra) {
  const out = Object.assign({}, (base && base.permissions) || {});
  if (extra && extra.permissions && typeof extra.permissions === "object") {
    Object.keys(extra.permissions).forEach(function (k) {
      out[k] = extra.permissions[k];
    });
  }
  return out;
}

function blobAuthHeaders(token) {
  return {
    Authorization: "Bearer " + token,
    "Cache-Control": "no-cache"
  };
}

async function parseJson(r) {
  try {
    const j = await r.json();
    return j && typeof j === "object" ? j : null;
  } catch (e) {
    return null;
  }
}

async function fetchBlobJson(fetchImpl, url, token) {
  const r = await fetchImpl(url, { headers: blobAuthHeaders(token), cache: "no-store" });
  if (!r.ok) return null;
  const j = await parseJson(r);
  return j ? normalizeUsersStore(j) : null;
}

function pickNewestBlob(blobs) {
  const matches = (blobs || []).filter(function (b) {
    return b && (b.pathname === BLOB_NAME || String(b.pathname || "").indexOf(BLOB_PREFIX) >= 0);
  });
  matches.sort(function (a, b) {
    return new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime();
  });
  return matches[0] || null;
}

async function readBlob(env, fetchFn) {
  const token = (env || process.env).BLOB_READ_WRITE_TOKEN || "";
  if (!token) return null;
  const fetchImpl = fetchFn || fetch;
  const url = blobUrl || ((env || process.env).USERS_BLOB_URL || "");
  if (url) {
    try {
      const got = await fetchBlobJson(fetchImpl, url, token);
      if (got) return got;
    } catch (e) {}
  }
  try {
    const r = await fetchImpl("https://blob.vercel-storage.com?prefix=" + encodeURIComponent(BLOB_PREFIX), {
      headers: { Authorization: "Bearer " + token, "x-api-version": "7" }
    });
    if (!r.ok) return null;
    const listed = await parseJson(r) || {};
    const hit = pickNewestBlob(listed.blobs);
    if (!hit || !hit.url) return null;
    blobUrl = hit.url;
    return await fetchBlobJson(fetchImpl, hit.url, token);
  } catch (e) {
    return null;
  }
}

async function writeBlob(payload, env, fetchFn) {
  const token = (env || process.env).BLOB_READ_WRITE_TOKEN || "";
  if (!token) return false;
  const fetchImpl = fetchFn || fetch;
  const body = JSON.stringify(payload);
  try {
    const parsed = JSON.parse(body);
    if (countUsers(payload) && countUsers(normalizeUsersStore(parsed)) !== countUsers(payload)) {
      return false;
    }
  } catch (e) {
    return false;
  }
  try {
    const r = await fetchImpl("https://blob.vercel-storage.com/" + BLOB_NAME, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token,
        "x-api-version": "7",
        "x-content-type": "application/json",
        "Content-Type": "application/json",
        "x-add-random-suffix": "0",
        "x-allow-overwrite": "1",
        "x-vercel-blob-access": "public",
        "x-cache-control-max-age": "60"
      },
      body: body
    });
    if (!r.ok) return false;
    const j = await parseJson(r) || {};
    if (j.url) blobUrl = j.url;
    const n = countUsers(payload);
    if (n) {
      const check = await readBlob(env, fetchFn);
      if (!check || countUsers(check) < n) {
        blobUrl = "";
        return false;
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

function readFileStore(env) {
  try {
    const raw = fs.readFileSync(storePath(env), "utf8");
    const j = JSON.parse(raw);
    if (j && typeof j === "object") return normalizeUsersStore(j);
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
    return normalizeUsersStore(deps.memory);
  }
  const env = deps.env || process.env;
  const blob = await readBlob(env, deps.fetch);
  const file = readFileStore(env);
  const mem = normalizeUsersStore(memory);

  if (countUsers(blob)) {
    memory = blob;
    lastVia = "blob";
    return blob;
  }
  if (countUsers(file)) {
    if (blob && blob.permissions && Object.keys(blob.permissions).length) {
      file.permissions = mergePermissions(file, blob);
    }
    memory = file;
    lastVia = "tmp";
    return file;
  }
  if (countUsers(mem)) {
    if (blob && blob.permissions && Object.keys(blob.permissions).length) {
      mem.permissions = mergePermissions(mem, blob);
    }
    lastVia = "memory";
    return mem;
  }
  if (blob) {
    memory = blob;
    lastVia = "blob";
    return blob;
  }
  if (file) {
    memory = file;
    lastVia = "tmp";
    return file;
  }
  lastVia = "memory";
  return mem;
}

async function saveUsers(blob, deps) {
  deps = deps || {};
  const payload = normalizeUsersStore(blob);
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
  lastVia = wroteBlob ? "blob" : (wroteFile ? "tmp" : "memory");
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
  normalizeUsersStore: normalizeUsersStore,
  isPopulated: isPopulated,
  countUsers: countUsers,
  loadUsers: loadUsers,
  saveUsers: saveUsers,
  reset: reset,
  via: via
};
