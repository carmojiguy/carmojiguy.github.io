#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function must(re, msg) {
  assert.ok(re.test(html), msg);
}
function mustNot(re, msg) {
  assert.ok(!re.test(html), msg);
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
must(/<!--[\s\S]*Users UI Snow Signal cool snow \+ steel chrome/, "stamp names Users Snow Signal chrome");
must(/<!--[\s\S]*HOLD #33\/#46/, "HOLD #33/#46 stays");
must(/<!--[\s\S]*staff defaultPerms all sections On except admin\/Users/, "stamp names staff defaultPerms");
must(/id:"admin", label:"Admin", deny:"Only Shawn or an admin can open Users\."/, "Users maps to PERM_KEYS id admin");
must(/lockDockBtn\("startUsers", canOpenUsers\(\), "admin"\)/, "Users dock button is gated by admin");
must(/function canOpenUsers\(\)\{\s*return APP\.role==="employee" && \(canPerm\("admin"\) \|\| isTeamLeader\(\)\);/, "opening Users reads admin (or team leader)");
must(/function staffPerms\(\)\{ return \{trade:true, appraise:true, website:true, center:true, admin:false, ca:true\}; \}/, "staffPerms is every section On except Users/admin");
must(/function defaultPerms\(email\)\{\s*const e=shawnAlias\(email\);\s*if\(e==="shawn@myloan.ca"\) return allPermsOn\(\);\s*return staffPerms\(\);\s*\}/, "unspecified people use staffPerms");
must(/#users \{\s*background:#F7F8FA;/, "Users page is Snow Signal snow");
must(/#users \{[\s\S]{0,180}--ink:#12141A; --muted:#5C6370/, "Users tokens match Snow Signal ink");
must(/#users \.users-chip\.on\{background:var\(--qs-accent-soft\)/, "Users filter chips are wash, not ink black");
must(/#users \.users-kicker,#userSheet \.users-kicker,#userAddSheet \.users-kicker\{color:var\(--qs-ink3\)/, "Users kicker is muted ink-3");
must(/#users \.perm-tog\.on,\.perm-tog\.on\{background:var\(--qs-accent-soft\)/, "section toggles On are wash");
must(/\.team-pick-btn\.on,\.role-tog button\.on\{background:var\(--qs-accent-soft\)/, "team/role picks On are wash");
must(/const hue="#12141A";/, "person avatars are ink, not rainbow");
must(/\.person-ava \{[\s\S]{0,220}background:#2F5B8A/, "avatar fallback first-block paint remapped off sage");
mustNot(/#users \{ background:linear-gradient\(180deg,#FFF8E8/, "Users muddy cream gradient is gone");
mustNot(/#users \{[\s\S]{0,80}background:#F5F3ED/, "Users Paper Desk cream is gone");
mustNot(/#users \.users-kicker[\s\S]{0,80}color:#E08A00/, "Users orange kicker is gone");
mustNot(/#users \.users-chip\.on \{ background:#111318;/, "Users selected chips are not ink black");
mustNot(/#users \{[\s\S]{0,80}background:#F5F6F8/, "Users is not old Center-bright gray");
must(/--qs-canvas:#F7F8FA/, "Center canvas is Snow Signal snow");
must(/\.users-chip\.on \{ background:linear-gradient\(135deg,#7C5CFF,#00A4E2\); color:#fff; \}/, "Center team chips keep their existing selected paint");

(function testPermKeysUsersIsAdmin() {
  const m = html.match(/const PERM_KEYS=\[[\s\S]*?\];/);
  assert.ok(m, "PERM_KEYS source is extractable");
  const PERM_KEYS = eval("(" + m[0].replace("const PERM_KEYS=", "").replace(/;$/, "") + ")");
  const users = PERM_KEYS.find(function (k) { return /open Users/i.test(k.deny) || k.label === "Admin"; });
  assert.ok(users, "Users permission exists");
  assert.strictEqual(users.id, "admin", "Users maps to PERM_KEYS id admin");
  assert.strictEqual(users.label, "Admin", "Users toggle label is Admin");
  assert.ok(PERM_KEYS.some(function (k) { return k.id === "website"; }), "website stays a section key");
  assert.ok(PERM_KEYS.some(function (k) { return k.id === "center"; }), "center stays a section key");
  assert.ok(PERM_KEYS.some(function (k) { return k.id === "appraise"; }), "appraise stays a section key");
  assert.ok(PERM_KEYS.some(function (k) { return k.id === "ca"; }), "ca stays a section key");
  assert.ok(PERM_KEYS.some(function (k) { return k.id === "trade"; }), "trade stays a section key");
  assert.ok(!PERM_KEYS.some(function (k) { return k.id === "users"; }), "there is no PERM_KEYS id users");
})();

(function testDefaultPermsStaffMinusUsers() {
  const m = html.match(/function defaultPerms\(email\)\{[\s\S]*?\n\}/);
  assert.ok(m, "defaultPerms source is extractable");
  const shawnAlias = function (email) {
    if (email === "shawn@gmautosales.ca") return "shawn@myloan.ca";
    return String(email || "").trim().toLowerCase();
  };
  const allPermsOn = function () {
    return { trade: true, appraise: true, website: true, center: true, admin: true, ca: true };
  };
  const staffPerms = function () {
    return { trade: true, appraise: true, website: true, center: true, admin: false, ca: true };
  };
  const defaultPerms = eval("(" + m[0].replace("function defaultPerms", "function") + ")");
  const keys = ["trade", "website", "center", "appraise", "ca"];
  [
    "someone@myloan.ca",
    "wes@thetrucktown.com",
    "ryan@papered.com",
    "andrew@autocorp.ca",
    "kyle@myloan.ca",
    "shane@myloan.ca",
    "josh.lefave@gmautosales.ca",
    "steve.summerall@gmautosales.ca",
    "ernest@myloan.ca"
  ].forEach(function (email) {
    const p = defaultPerms(email);
    keys.forEach(function (k) {
      assert.strictEqual(p[k], true, email + " default " + k + " is On");
    });
    assert.strictEqual(p.admin, false, email + " default Users/admin is Off");
  });
  const shawn = defaultPerms("shawn@myloan.ca");
  keys.forEach(function (k) {
    assert.strictEqual(shawn[k], true, "Shawn default " + k + " is On");
  });
  assert.strictEqual(shawn.admin, true, "Shawn default Users/admin is On");
  assert.strictEqual(defaultPerms("shawn@gmautosales.ca").admin, true, "Shawn alias still gets Users");
})();

(function testPermsForMissingKeyFallsBackSavedWins() {
  const src = sliceFn("permsFor", "setPerm");
  const PERM_KEYS = [
    { id: "trade" }, { id: "website" }, { id: "center" },
    { id: "appraise" }, { id: "admin" }, { id: "ca" }
  ];
  const ALWAYS_ON_PERMS = ["trade", "website"];
  let stored = { permissions: {} };
  function loadUsersStore() { return stored; }
  function shawnAlias(email) {
    return email === "shawn@gmautosales.ca" ? "shawn@myloan.ca" : String(email || "").trim().toLowerCase();
  }
  function defaultPerms() {
    return { trade: true, appraise: true, website: true, center: true, admin: false, ca: true };
  }
  const permsFor = eval("(" + src.replace("function permsFor", "function") + ")");

  const fresh = permsFor("new.person@myloan.ca");
  assert.strictEqual(fresh.center, true, "missing saved perms: Center On");
  assert.strictEqual(fresh.appraise, true, "missing saved perms: Appraise On");
  assert.strictEqual(fresh.ca, true, "missing saved perms: CA On");
  assert.strictEqual(fresh.trade, true, "missing saved perms: trade On");
  assert.strictEqual(fresh.website, true, "missing saved perms: website On");
  assert.strictEqual(fresh.admin, false, "missing saved perms: Users/admin Off");

  stored.permissions["saved@myloan.ca"] = { center: false, admin: true };
  const saved = permsFor("saved@myloan.ca");
  assert.strictEqual(saved.center, false, "explicit Blob center:false wins");
  assert.strictEqual(saved.admin, true, "explicit Blob admin:true wins");
  assert.strictEqual(saved.appraise, true, "missing key appraise falls back to staff On");
  assert.strictEqual(saved.ca, true, "missing key ca falls back to staff On");
  assert.strictEqual(saved.trade, true, "always-on trade stays On");
  assert.strictEqual(saved.website, true, "always-on website stays On");
})();

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("users-chrome: ok");
