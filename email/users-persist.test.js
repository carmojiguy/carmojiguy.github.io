#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const incoming = require(path.join(root, "api", "incoming.js"));
const usersStore = require(path.join(root, "api", "lib", "users-store"));

function must(re, msg) {
  assert.ok(re.test(html), msg);
}
function sliceFn(name, next) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start > 0, name + " found");
  const end = next
    ? html.indexOf("\nfunction " + next + "(", start)
    : html.indexOf("\nfunction ", start + 10);
  assert.ok(end > start, name + " end found");
  return html.slice(start, end);
}

must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
must(/<!--[\s\S]*Thank-you frozen/, "Thank-you stays frozen in the stamp");
must(/durable Vercel Blob center-users-v1\.json/, "stamp names the durable blob file");
must(/josh\.lefave@gmautosales\.ca/, "Josh seed email josh.lefave@gmautosales.ca");
must(/steve\.summerall@gmautosales\.ca/, "Steve seed email steve.summerall@gmautosales.ca");
must(/Josh Lefave/, "Josh Lefave restored with seed spelling");
must(/Steve Summerall/, "Steve Summerall restored by name");
must(/keepalive:true/, "Users POST uses keepalive so leaving the page still saves");
must(/Object\.keys\(blob\.permissions\)\.length/, "empty remote permissions do not wipe local toggles");
must(/if\(!nUsers\)/, "persistUsersRemote skips POST when users length is 0");
must(/if\(!people\.length && localCount\)/, "applyUsersBlob never replaces nonempty local people with empty remote");
must(/e==="josh.lefave@gmautosales.ca" \|\| e==="steve.summerall@gmautosales.ca"/, "Josh/Steve defaultPerms are explicit");
must(/id:"u-josh"/, "FixerBot seed id u-josh");
must(/id:"u-steve-s"/, "FixerBot seed id u-steve-s");
must(/\/staff\/josh\.jpg/, "Josh seed photo path");
must(/\/staff\/steve-summerall\.jpg/, "Steve seed photo path");
must(/p\.id=seed\.id;/, "Josh/Steve seed id is pinned on restore");
must(/p\.photo=seed\.photo;/, "Josh/Steve seed photo is pinned on restore");
must(/p\.role=seed\.role;/, "Josh/Steve seed role is pinned on restore");

(function testDefaultPerms() {
  const m = html.match(/function defaultPerms\(email\)\{[\s\S]*?\n\}/);
  assert.ok(m, "defaultPerms source is extractable");
  const shawnAlias = function (email) {
    return email === "shawn@gmautosales.ca" ? "shawn@myloan.ca" : email;
  };
  const allPermsOn = function () {
    return { trade: true, appraise: true, website: true, center: true, admin: true, ca: true };
  };
  const defaultPerms = eval("(" + m[0].replace("function defaultPerms", "function") + ")");
  const josh = defaultPerms("josh.lefave@gmautosales.ca");
  const steve = defaultPerms("steve.summerall@gmautosales.ca");
  assert.strictEqual(josh.website, true, "Josh has website photos");
  assert.strictEqual(josh.center, true, "Josh has Appraisal Center");
  assert.strictEqual(josh.admin, false, "Josh is not admin");
  assert.strictEqual(josh.appraise, false, "Josh does not get Appraise by default");
  assert.strictEqual(steve.website, true, "Steve has website photos");
  assert.strictEqual(steve.center, true, "Steve has Appraisal Center");
  assert.strictEqual(steve.admin, false, "Steve is not admin");
})();

(function testApplyDoesNotWipeOnEmptyPerms() {
  const applySrc = sliceFn("applyUsersBlob", "persistUsersRemote");
  let stored = {
    people: [{ email: "local@myloan.ca", name: "Local", teams: [], leader: false }],
    permissions: { "local@myloan.ca": { center: true, appraise: true } }
  };
  function loadUsersStore() { return stored; }
  function saveUsersStore(next) { stored = next; }
  function staffEmail(v) { return String(v || "").trim().toLowerCase(); }
  function normalizeTeams(v) { return Array.isArray(v) ? v : []; }
  const applyUsersBlob = eval("(" + applySrc.replace("function applyUsersBlob", "function") + ")");
  assert.strictEqual(applyUsersBlob({
    ok: true,
    users: [{ email: "ernest@myloan.ca", name: "Ernest" }],
    permissions: {}
  }), true, "people-only blob still applies roster");
  assert.strictEqual(stored.permissions["local@myloan.ca"].center, true, "empty remote permissions keep local toggles");
})();

(function testStaleIsolateDoesNotClobber() {
  const applySrc = sliceFn("applyUsersBlob", "persistUsersRemote");
  let stored = {
    people: [
      { email: "josh.lefave@gmautosales.ca", name: "Josh Lefave", id: "u-josh" },
      { email: "steve.summerall@gmautosales.ca", name: "Steve Summerall", id: "u-steve-s" },
      { email: "adam@myloan.ca", name: "Adam" }
    ],
    permissions: { "adam@myloan.ca": { center: false } },
    updatedAt: 200
  };
  function loadUsersStore() { return stored; }
  function saveUsersStore(next) { stored = next; }
  function staffEmail(v) { return String(v || "").trim().toLowerCase(); }
  function normalizeTeams(v) { return Array.isArray(v) ? v : []; }
  const applyUsersBlob = eval("(" + applySrc.replace("function applyUsersBlob", "function") + ")");
  assert.strictEqual(applyUsersBlob({
    ok: true,
    users: [{ email: "persist-probe@example.com", name: "Probe" }],
    permissions: {},
    updatedAt: 100
  }), false, "stale thinner isolate snapshot is ignored");
  assert.strictEqual(stored.people.length, 3, "Josh/Steve/Adam stay local");
  assert.strictEqual(stored.permissions["adam@myloan.ca"].center, false, "toggle survives stale GET");
})();

(function testApplyKeepsLocalPeopleWhenRemoteUsersEmpty() {
  const applySrc = sliceFn("applyUsersBlob", "persistUsersRemote");
  let stored = {
    people: [
      { email: "nathan.rutter@myloan.ca", name: "Nathan Rutter" },
      { email: "isabella.coffey@myloan.ca", name: "Isabella Coffey" }
    ],
    permissions: { "nathan.rutter@myloan.ca": { center: true } },
    updatedAt: 100
  };
  function loadUsersStore() { return stored; }
  function saveUsersStore(next) { stored = next; }
  function staffEmail(v) { return String(v || "").trim().toLowerCase(); }
  function normalizeTeams(v) { return Array.isArray(v) ? v : []; }
  const applyUsersBlob = eval("(" + applySrc.replace("function applyUsersBlob", "function") + ")");
  assert.strictEqual(applyUsersBlob({
    ok: true,
    users: [],
    people: [],
    permissions: {
      "nathan.rutter@myloan.ca": { center: true, admin: true },
      "isabella.coffey@myloan.ca": { center: true, admin: true }
    },
    updatedAt: 999
  }), true, "permissions-only remote still applies toggles");
  assert.strictEqual(stored.people.length, 2, "nonempty local people survive empty remote users");
  assert.strictEqual(stored.people[0].email, "nathan.rutter@myloan.ca");
  assert.strictEqual(stored.permissions["isabella.coffey@myloan.ca"].admin, true, "permissions may still update");
})();

function makeRoster(n) {
  const users = [];
  const permissions = {};
  for (let i = 0; i < n; i++) {
    const email = i === 0 ? "nathan.rutter@myloan.ca"
      : i === 1 ? "isabella.coffey@myloan.ca"
      : ("user" + i + "@myloan.ca");
    const name = i === 0 ? "Nathan Rutter" : i === 1 ? "Isabella Coffey" : ("User " + i);
    users.push({ email: email, name: name, id: "u-" + i, photo: "/staff/user-" + i + ".jpg" });
    permissions[email] = { trade: true, appraise: true, website: true, center: true, admin: true, ca: true };
  }
  return { users: users, permissions: permissions };
}

function mockBlob() {
  const files = { puts: [] };
  async function fetchImpl(url, opts) {
    opts = opts || {};
    const u = String(url);
    if (String(opts.method || "GET").toUpperCase() === "PUT") {
      files.puts.push({ url: u, headers: opts.headers || {} });
      files.body = String(opts.body || "");
      files.url = "https://blob.vercel-storage.com/" + usersStore.BLOB_NAME;
      return { ok: true, json: async function () { return { url: files.url }; } };
    }
    if (u.indexOf("prefix=") >= 0) {
      if (!files.body) return { ok: true, json: async function () { return { blobs: [] }; } };
      return {
        ok: true,
        json: async function () {
          return { blobs: [{ pathname: usersStore.BLOB_NAME, url: files.url }] };
        }
      };
    }
    if (!files.body) return { ok: false, json: async function () { return {}; } };
    return { ok: true, json: async function () { return JSON.parse(files.body); } };
  }
  fetchImpl.files = files;
  return fetchImpl;
}

function failBlob() {
  return async function () {
    return { ok: false, status: 404, json: async function () { return {}; } };
  };
}

function clearIsolate(storePath) {
  incoming.resetStore();
  usersStore.reset();
  ["/tmp/center-users-v1.json", storePath].forEach(function (p) {
    if (!p) return;
    try { fs.unlinkSync(p); } catch (e) {}
  });
}

(async function testPersistUsersBlobAndHonestVia() {
  const fetchImpl = mockBlob();
  const env = { BLOB_READ_WRITE_TOKEN: "test-token", USERS_STORE_PATH: "/tmp/users-persist-blob-" + Date.now() + ".json" };
  clearIsolate(env.USERS_STORE_PATH);
  const saved = await incoming.persistUsers({
    kind: "users",
    users: [
      {
        email: "josh.lefave@gmautosales.ca",
        name: "Josh Lefave",
        id: "u-josh",
        photo: "/staff/josh.jpg",
        role: "owner",
        website: true,
        appraisalCenter: true,
        modules: ["center", "website"],
        access: "owner"
      },
      { email: "steve.summerall@gmautosales.ca", name: "Steve Summerall", id: "u-steve-s", photo: "/staff/steve-summerall.jpg", role: "owner" }
    ],
    teams: ["Team Flash"],
    permissions: {
      "josh.lefave@gmautosales.ca": { website: true, center: true, appraisalCenter: true },
      "steve.summerall@gmautosales.ca": { website: true, center: true }
    }
  }, { fetch: fetchImpl, env: env });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.ok, true);
  assert.equal(saved.body.via, "blob", "save writes Vercel Blob");
  assert.ok(fetchImpl.files.puts.length, "PUT was awaited");
  const put = fetchImpl.files.puts[0];
  assert.ok(String(put.url).indexOf(usersStore.BLOB_NAME) >= 0, "PUT pathname center-users-v1.json");
  assert.equal(put.headers.Authorization, "Bearer test-token");
  assert.equal(put.headers["x-api-version"], "7");
  assert.equal(put.headers["x-add-random-suffix"], "0");
  assert.equal(put.headers["x-allow-overwrite"], "1", "Blob overwrite header is 1 (SDK wire format), not true");
  assert.equal(put.headers["x-vercel-blob-access"], "public");
  assert.equal(put.headers["x-content-type"], "application/json");

  clearIsolate(env.USERS_STORE_PATH);
  const got = await incoming.listUsers({ fetch: fetchImpl, env: env });
  assert.equal(got.via, "blob", "new isolate loads from blob, not /tmp");
  assert.equal(got.users.length, 2);
  const emails = got.users.map(function (u) { return u.email; }).sort();
  assert.deepStrictEqual(emails, ["josh.lefave@gmautosales.ca", "steve.summerall@gmautosales.ca"]);
  const josh = got.users.find(function (u) { return u.id === "u-josh"; });
  assert.strictEqual(josh.photo, "/staff/josh.jpg");
  assert.strictEqual(josh.website, true, "extra website flag is kept");
  assert.strictEqual(josh.appraisalCenter, true, "extra Appraisal Center flag is kept");
  assert.deepStrictEqual(josh.modules, ["center", "website"]);
  assert.strictEqual(josh.access, "owner");
  assert.strictEqual(got.users.find(function (u) { return u.id === "u-steve-s"; }).role, "owner");
  assert.strictEqual(got.permissions["josh.lefave@gmautosales.ca"].center, true);
  assert.strictEqual(got.permissions["josh.lefave@gmautosales.ca"].website, true);
  assert.strictEqual(got.permissions["josh.lefave@gmautosales.ca"].appraisalCenter, true);
  assert.strictEqual(got.permissions["steve.summerall@gmautosales.ca"].center, true);
  assert.strictEqual(got.permissions["steve.summerall@gmautosales.ca"].website, true);

  const skipped = await incoming.persistUsers({ kind: "users", users: [], permissions: {} }, { fetch: fetchImpl, env: env });
  assert.equal(skipped.body.skipped, "empty", "empty POST does not wipe a populated blob");
  clearIsolate(env.USERS_STORE_PATH);
  const still = await incoming.listUsers({ fetch: fetchImpl, env: env });
  assert.equal(still.users.length, 2, "Josh and Steve survive the empty POST");
  assert.equal(still.via, "blob");

  const routed = await incoming.route("GET", null, { kind: "users" }, { fetch: fetchImpl, env: env });
  assert.equal(routed.status, 200);
  assert.equal(routed.body.via, "blob");
  assert.equal(routed.body.users.length, 2);

  const missingEnv = { BLOB_READ_WRITE_TOKEN: "test-token", USERS_STORE_PATH: "/tmp/users-persist-tmp-" + Date.now() + ".json" };
  clearIsolate(missingEnv.USERS_STORE_PATH);
  const tmpSaved = await incoming.persistUsers({
    kind: "users",
    users: [{ email: "ernest@myloan.ca", name: "Ernest", photo: "/staff/ernest.jpg", modules: ["center"] }],
    permissions: { "ernest@myloan.ca": { center: true, website: true } }
  }, { fetch: failBlob(), env: missingEnv });
  assert.equal(tmpSaved.body.via, "tmp", "Blob miss still writes tmp; via is not blob");
  assert.notEqual(tmpSaved.body.via, "blob");
  incoming.resetStore();
  usersStore.reset();
  try { fs.unlinkSync("/tmp/center-users-v1.json"); } catch (e) {}
  const tmpGot = await incoming.listUsers({ fetch: failBlob(), env: missingEnv });
  assert.equal(tmpGot.via, "tmp", "GET falls back to tmp when Blob is missing");
  assert.equal(tmpGot.users.length, 1);
  assert.equal(tmpGot.users[0].email, "ernest@myloan.ca");
  assert.deepStrictEqual(tmpGot.users[0].modules, ["center"]);

  const memEnv = { USERS_STORE_PATH: "/tmp/users-persist-no-write-" + Date.now() + "/nope.json" };
  clearIsolate("/tmp/center-users-v1.json");
  const memSaved = await incoming.persistUsers({
    kind: "users",
    users: [{ email: "adam@myloan.ca", name: "Adam" }]
  }, { env: memEnv });
  assert.notEqual(memSaved.body.via, "blob", "no token is never labeled blob");
  assert.ok(memSaved.body.via === "tmp" || memSaved.body.via === "memory", "via is tmp or memory");

  (function testNormalizePrefersPeopleWhenUsersEmpty() {
    const kept = usersStore.normalizeUsersStore({
      users: [],
      people: [{ email: "nathan.rutter@myloan.ca", name: "Nathan Rutter" }],
      permissions: { "nathan.rutter@myloan.ca": { admin: true } }
    });
    assert.equal(kept.users.length, 1, "normalizeUsersStore does not drop people when users=[]");
    assert.equal(kept.users[0].email, "nathan.rutter@myloan.ca");
    assert.equal(kept.people.length, 1);
  })();

  const persistSrc = sliceFn("persistUsersRemote", "pullUsersRemote");
  const persistCalls = [];
  const MAIL_HOST = "https://mailer.example";
  function slimUsersBlob(store) {
    const people = ((store && store.people) || store.users || []).filter(function (u) { return u && u.email; });
    return { kind: "users", users: people, people: people, permissions: (store && store.permissions) || {} };
  }
  function loadUsersStore() { return { people: [], permissions: { "x@y.com": { center: true } } }; }
  function fetch(url, req) { persistCalls.push({ url: url, req: req }); return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ ok: true }); } }); }
  const persistUsersRemote = eval("(" + persistSrc.replace("function persistUsersRemote", "function") + ")");
  const skippedEmptyPerms = await persistUsersRemote({ people: [], users: [], permissions: { "x@y.com": { admin: true } } });
  assert.equal(skippedEmptyPerms.skipped, "empty", "empty users skip even when permissions has keys");
  assert.equal(persistCalls.length, 0, "no POST when users=[]");

  const round = mockBlob();
  const roundEnv = { BLOB_READ_WRITE_TOKEN: "test-token", USERS_STORE_PATH: "/tmp/users-persist-33-" + Date.now() + ".json" };
  clearIsolate(roundEnv.USERS_STORE_PATH);
  const roster33 = makeRoster(33);
  const posted33 = await incoming.persistUsers({
    kind: "users",
    users: roster33.users,
    people: roster33.users,
    permissions: roster33.permissions
  }, { fetch: round, env: roundEnv });
  assert.equal(posted33.status, 200);
  assert.equal(posted33.body.ok, true);
  assert.equal(posted33.body.nusers, 33, "POST reports 33 users written");
  assert.equal(posted33.body.via, "blob", "33-user POST lands on Blob");
  const put33 = JSON.parse(round.files.body);
  assert.equal(put33.users.length, 33, "Blob PUT body keeps the users array");
  clearIsolate(roundEnv.USERS_STORE_PATH);
  const got33 = await incoming.listUsers({ fetch: round, env: roundEnv });
  assert.equal(got33.nusers, 33, "GET nusers is 33");
  assert.equal(got33.users.length, 33, "POST 33 users → GET returns 33");
  assert.equal(got33.users[0].email, "nathan.rutter@myloan.ca");
  assert.equal(got33.users[1].email, "isabella.coffey@myloan.ca");
  assert.equal(got33.via, "blob");

  const permOnly = await incoming.persistUsers({
    kind: "users",
    users: [],
    permissions: Object.assign({}, roster33.permissions, { "nathan.rutter@myloan.ca": { trade: true, appraise: true, website: true, center: true, admin: true, ca: true } })
  }, { fetch: round, env: roundEnv });
  assert.notEqual(permOnly.body.skipped, "empty", "permissions-only POST keeps existing users");
  assert.equal(permOnly.body.nusers, 33, "existing 33 users are kept when incoming users=[]");
  const afterPerm = await incoming.listUsers({ fetch: round, env: roundEnv });
  assert.equal(afterPerm.users.length, 33, "permissions update does not wipe the 33-user roster");

  const staleEnv = { BLOB_READ_WRITE_TOKEN: "test-token", USERS_STORE_PATH: "/tmp/users-persist-stale-" + Date.now() + ".json" };
  const staleFetch = mockBlob();
  clearIsolate(staleEnv.USERS_STORE_PATH);
  const savedTmp = await incoming.persistUsers({
    kind: "users",
    users: roster33.users,
    permissions: roster33.permissions
  }, { fetch: staleFetch, env: staleEnv });
  assert.equal(savedTmp.body.nusers, 33);
  async function emptyBlobGet(url, opts) {
    opts = opts || {};
    if (String(opts.method || "GET").toUpperCase() === "PUT") return staleFetch(url, opts);
    return {
      ok: true,
      json: async function () {
        return { users: [], people: [], permissions: roster33.permissions, updatedAt: Date.now(), blobs: [{ pathname: usersStore.BLOB_NAME, url: staleFetch.files.url }] };
      }
    };
  }
  emptyBlobGet.files = staleFetch.files;
  const fromStale = await incoming.listUsers({ fetch: emptyBlobGet, env: staleEnv });
  assert.equal(fromStale.users.length, 33, "empty Blob users do not clobber nonempty tmp roster");

  clearIsolate(env.USERS_STORE_PATH);
  clearIsolate(missingEnv.USERS_STORE_PATH);
  clearIsolate(roundEnv.USERS_STORE_PATH);
  clearIsolate(staleEnv.USERS_STORE_PATH);
  console.log("users-persist: ok");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});
