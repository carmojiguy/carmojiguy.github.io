/**
 * Durable store for incomplete-leader + on-site attention nags.
 *
 * Prefers Vercel Blob when BLOB_READ_WRITE_TOKEN is set so cron ticks
 * survive cold starts. Falls back to NOTIFY_STORE_PATH (default
 * /tmp/appraisal-notify-jobs.json) and an in-memory cache for tests.
 *
 * Never put this file's contents in the client.
 */
const fs = require("fs");
const path = require("path");

const BLOB_NAME = "appraisal-notify-jobs.json";
const INTERVAL_MS = 15 * 60 * 1000;

let memory = { jobs: [] };
let blobUrl = "";

function nowMs(deps) {
  if (deps && typeof deps.now === "function") return deps.now();
  return Date.now();
}

function storePath(env) {
  const e = env || process.env;
  return e.NOTIFY_STORE_PATH || path.join("/tmp", BLOB_NAME);
}

function normalizeJob(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = String(raw.id || "").trim();
  const lane = raw.lane === "onsite-attention" ? "onsite-attention" : "incomplete-leader";
  if (!id) return null;
  return {
    id: id,
    key: lane + ":" + id,
    lane: lane,
    email: String(raw.email || "").trim().toLowerCase(),
    phone: String(raw.phone || "").trim(),
    emails: Array.isArray(raw.emails) ? raw.emails.map(function (e) { return String(e || "").trim().toLowerCase(); }).filter(Boolean) : [],
    phones: Array.isArray(raw.phones) ? raw.phones.map(function (p) { return String(p || "").trim(); }).filter(Boolean) : [],
    customer: String(raw.customer || "").trim(),
    vehicle: String(raw.vehicle || "").trim(),
    vin: String(raw.vin || "").trim().toUpperCase(),
    salesperson: String(raw.salesperson || "").trim(),
    missing: Array.isArray(raw.missing) ? raw.missing.map(function (m) { return String(m || "").trim(); }).filter(Boolean) : [],
    dealType: String(raw.dealType || "").trim(),
    createdAt: Number(raw.createdAt) || 0,
    lastNotifiedAt: Number(raw.lastNotifiedAt) || 0,
    notifyCount: Number(raw.notifyCount) || 0,
    completedAt: Number(raw.completedAt) || 0
  };
}

function recipientsOf(job) {
  const emails = [];
  const phones = [];
  function addEmail(e) {
    const s = String(e || "").trim().toLowerCase();
    if (s && s.indexOf("@") > 0 && emails.indexOf(s) < 0) emails.push(s);
  }
  function addPhone(p) {
    const s = String(p || "").trim();
    if (s && phones.indexOf(s) < 0) phones.push(s);
  }
  (job.emails || []).forEach(addEmail);
  addEmail(job.email);
  (job.phones || []).forEach(addPhone);
  addPhone(job.phone);
  return { emails: emails, phones: phones };
}

async function readBlob(env, fetchFn) {
  const token = (env || process.env).BLOB_READ_WRITE_TOKEN || "";
  if (!token) return null;
  const fetchImpl = fetchFn || fetch;
  const url = blobUrl || ((env || process.env).NOTIFY_BLOB_URL || "");
  if (url) {
    try {
      const r = await fetchImpl(url, { headers: { Authorization: "Bearer " + token } });
      if (r.ok) {
        const j = await r.json();
        if (j && Array.isArray(j.jobs)) return j;
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
    const hit = blobs.find(function (b) { return b && (b.pathname === BLOB_NAME || String(b.pathname || "").indexOf(BLOB_NAME) >= 0); });
    if (!hit || !hit.url) return null;
    blobUrl = hit.url;
    const got = await fetchImpl(hit.url, { headers: { Authorization: "Bearer " + token } });
    if (!got.ok) return null;
    const j = await got.json();
    return j && Array.isArray(j.jobs) ? j : null;
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
    if (j && Array.isArray(j.jobs)) return j;
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

async function loadJobs(deps) {
  deps = deps || {};
  if (deps.memory) return (deps.memory.jobs || []).slice();
  if (global.__NOTIFY_JOBS) return global.__NOTIFY_JOBS.slice();
  const env = deps.env || process.env;
  const blob = await readBlob(env, deps.fetch);
  if (blob) {
    memory = blob;
    return blob.jobs.slice();
  }
  const file = readFileStore(env);
  if (file) {
    memory = file;
    return file.jobs.slice();
  }
  return (memory.jobs || []).slice();
}

async function saveJobs(jobs, deps) {
  deps = deps || {};
  const payload = { jobs: jobs.filter(Boolean), savedAt: nowMs(deps) };
  if (deps.memory) {
    deps.memory.jobs = payload.jobs;
    return payload;
  }
  if (global.__NOTIFY_JOBS_USE) {
    global.__NOTIFY_JOBS = payload.jobs;
    return payload;
  }
  memory = payload;
  const env = deps.env || process.env;
  await writeBlob(payload, env, deps.fetch);
  writeFileStore(payload, env);
  return payload;
}

async function upsertJob(raw, deps) {
  const job = normalizeJob(raw);
  if (!job) return null;
  const t = nowMs(deps);
  const jobs = await loadJobs(deps);
  const idx = jobs.findIndex(function (j) { return j && j.key === job.key; });
  if (idx >= 0 && jobs[idx].completedAt) {
    jobs.splice(idx, 1);
  }
  const existing = jobs.find(function (j) { return j && j.key === job.key; });
  if (existing) {
    existing.email = job.email || existing.email;
    existing.phone = job.phone || existing.phone;
    existing.emails = job.emails.length ? job.emails : existing.emails;
    existing.phones = job.phones.length ? job.phones : existing.phones;
    existing.customer = job.customer || existing.customer;
    existing.vehicle = job.vehicle || existing.vehicle;
    existing.vin = job.vin || existing.vin;
    existing.salesperson = job.salesperson || existing.salesperson;
    existing.missing = job.missing.length ? job.missing : existing.missing;
    existing.dealType = job.dealType || existing.dealType;
    existing.completedAt = 0;
    await saveJobs(jobs, deps);
    return existing;
  }
  job.createdAt = job.createdAt || t;
  job.lastNotifiedAt = job.lastNotifiedAt || 0;
  job.notifyCount = job.notifyCount || 0;
  job.completedAt = 0;
  jobs.push(job);
  await saveJobs(jobs, deps);
  return job;
}

async function completeJob(id, lane, deps) {
  const jobs = await loadJobs(deps);
  const t = nowMs(deps);
  let n = 0;
  jobs.forEach(function (j) {
    if (!j || j.completedAt) return;
    if (String(j.id) !== String(id)) return;
    if (lane && j.lane !== lane) return;
    j.completedAt = t;
    n++;
  });
  if (n) await saveJobs(jobs, deps);
  return n;
}

function isDue(job, t, interval) {
  if (!job || job.completedAt) return false;
  const gap = interval == null ? INTERVAL_MS : interval;
  if (!job.lastNotifiedAt) return true;
  return (t - job.lastNotifiedAt) >= gap;
}

function dueJobs(jobs, t, interval) {
  return (jobs || []).filter(function (j) { return isDue(j, t, interval); });
}

function pruneCompleted(jobs, t, keepMs) {
  const keep = keepMs == null ? 24 * 60 * 60 * 1000 : keepMs;
  return (jobs || []).filter(function (j) {
    if (!j) return false;
    if (!j.completedAt) return true;
    return (t - j.completedAt) < keep;
  });
}

async function markNotified(keys, deps) {
  const jobs = await loadJobs(deps);
  const t = nowMs(deps);
  const set = {};
  (keys || []).forEach(function (k) { set[k] = 1; });
  jobs.forEach(function (j) {
    if (!j || !set[j.key]) return;
    j.lastNotifiedAt = t;
    j.notifyCount = (j.notifyCount || 0) + 1;
  });
  await saveJobs(pruneCompleted(jobs, t), deps);
  return jobs.filter(function (j) { return j && set[j.key]; });
}

module.exports = {
  INTERVAL_MS: INTERVAL_MS,
  normalizeJob: normalizeJob,
  recipientsOf: recipientsOf,
  loadJobs: loadJobs,
  saveJobs: saveJobs,
  upsertJob: upsertJob,
  completeJob: completeJob,
  isDue: isDue,
  dueJobs: dueJobs,
  pruneCompleted: pruneCompleted,
  markNotified: markNotified
};
