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
must(/e==="josh.lefave@gmautosales.ca" \|\| e==="steve.summerall@gmautosales.ca"/, "Josh/Steve defaultPerms are explicit");
must(/id:"u-josh"/, "FixerBot seed id u-josh");
must(/id:"u-steve-s"/, "FixerBot seed id u-steve-s");
must(/\/staff\/josh\.jpg/, "Josh seed photo path");
must(/\/staff\/steve-summerall\.jpg/, "Steve seed photo path");

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

function mockBlob() {
  const files = {};
  return async function fetchImpl(url, opts) {
    opts = opts || {};
    const u = String(url);
    if (String(opts.method || "GET").toUpperCase() === "PUT") {
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
  };
}

(async function testDurableBlobSurvivesIsolate() {
  const fetchImpl = mockBlob();
  const env = { BLOB_READ_WRITE_TOKEN: "test-token", USERS_STORE_PATH: "/tmp/users-persist-missing-" + Date.now() + ".json" };
  incoming.resetStore();
  usersStore.reset();
  const saved = await incoming.persistUsersDurable({
    kind: "users",
    users: [
      { email: "josh.lefave@gmautosales.ca", name: "Josh Lefave", id: "u-josh", photo: "/staff/josh.jpg", role: "owner" },
      { email: "steve.summerall@gmautosales.ca", name: "Steve Summerall", id: "u-steve-s", photo: "/staff/steve-summerall.jpg", role: "owner" }
    ],
    permissions: {
      "josh.lefave@gmautosales.ca": { website: true, center: true },
      "steve.summerall@gmautosales.ca": { website: true, center: true }
    }
  }, { fetch: fetchImpl, env: env });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.ok, true);
  assert.equal(saved.body.via, "blob", "save writes Vercel Blob");

  incoming.resetStore();
  usersStore.reset();
  const got = await incoming.listUsersDurable({ fetch: fetchImpl, env: env });
  assert.equal(got.via, "blob", "new isolate loads from blob, not /tmp");
  assert.equal(got.users.length, 2);
  const emails = got.users.map(function (u) { return u.email; }).sort();
  assert.deepStrictEqual(emails, ["josh.lefave@gmautosales.ca", "steve.summerall@gmautosales.ca"]);
  assert.strictEqual(got.users.find(function (u) { return u.id === "u-josh"; }).photo, "/staff/josh.jpg");
  assert.strictEqual(got.users.find(function (u) { return u.id === "u-steve-s"; }).role, "owner");
  assert.strictEqual(got.permissions["josh.lefave@gmautosales.ca"].center, true);
  assert.strictEqual(got.permissions["josh.lefave@gmautosales.ca"].website, true);
  assert.strictEqual(got.permissions["steve.summerall@gmautosales.ca"].center, true);
  assert.strictEqual(got.permissions["steve.summerall@gmautosales.ca"].website, true);

  const skipped = await incoming.persistUsersDurable({ kind: "users", users: [], permissions: {} }, { fetch: fetchImpl, env: env });
  assert.equal(skipped.body.skipped, "empty", "empty POST does not wipe a populated blob");
  incoming.resetStore();
  usersStore.reset();
  const still = await incoming.listUsersDurable({ fetch: fetchImpl, env: env });
  assert.equal(still.users.length, 2, "Josh and Steve survive the empty POST");

  const tmp = "/tmp/center-users-v1.json";
  try { fs.unlinkSync(tmp); } catch (e) {}
  incoming.resetStore();
  usersStore.reset();
  const afterTmpGone = await incoming.listUsersDurable({ fetch: fetchImpl, env: env });
  assert.equal(afterTmpGone.users.length, 2, "hard refresh / cold start still has Users settings");
  console.log("users-persist: ok");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});
