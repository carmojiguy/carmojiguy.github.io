#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const incoming = require(path.join(root, "api", "incoming.js"));

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
function slice(start, endMarker) {
  const a = html.indexOf(start);
  const b = html.indexOf(endMarker, a);
  assert.ok(a > 0 && b > a, "slice not found: " + start);
  return html.slice(a, b);
}
function sha(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

must(/id="buildStamp">build d31a</, "footer stamp is d31w");
must(/<!--[\s\S]*build d31a[\s\S]*FIFO oldest home/, "header stamp is d31w FIFO");
must(/<!--[\s\S]*build d31a[\s\S]*911 Incoming FINAL/, "header stamp keeps the 911 FINAL fold-in");
must(/<!--[\s\S]*build d31a[\s\S]*911 Acre team reads finalRationale\.markdown/, "header stamp keeps panel how-we-got-here");
must(/<!--[\s\S]*build d31a[\s\S]*left-rail Incoming\/On-site\/Needs docs\/History/, "header stamp names rail pills");
must(/<!--[\s\S]*build d31a[\s\S]*kind:users persist/, "header stamp names users persist");
must(/<!--[\s\S]*build d31a[\s\S]*Thank-you frozen/, "Thank-you stays frozen in the stamp");
must(/id="typeSheet"[\s\S]*build d31a/, "type sheet stamp is d31w");

must(/id="centerLanes"[^>]*center-rail|class="center-lanes center-rail"/, "Center lanes are a left rail");
must(/#centerLanes\.center-rail[\s\S]{0,180}flex-direction:column/, "rail pills stack top to bottom");
must(/id="centerInboxBtn"/, "Incoming rail pill");
must(/id="centerOnsiteBtn"/, "On-site rail pill");
must(/id="centerNeedsBtn"/, "Needs docs rail pill");
must(/id="centerHistoryBtn"/, "History rail pill");
must(/<b>Incoming<\/b>/, "Incoming label");
must(/<b>On-site<\/b>/, "On-site label");
must(/<b>Needs docs<\/b>/, "Needs docs label");
must(/<b>History<\/b>/, "History label");
must(/openCenterLane\("inbox"\)/, "Incoming pill opens the full Incoming list");
must(/openCenterLane\("onsite"\)/, "On-site pill opens the full On-site list");
must(/openCenterLane\("needsdocs"\)/, "Needs docs pill opens the full Needs docs list");
must(/openCenterLane\("history"\)/, "History pill opens the full History list");

mustNot(/#centerLanes[^\{]*\{[^\}]*grid-template-columns:1fr 1fr 1fr 1fr/, "Center rail is not a 4-across top KPI row");
mustNot(/32 up/, "no 32-up hist KPI copy");
mustNot(/9 hist/, "no 9-hist KPI copy");
mustNot(/8 on-site/, "no 8-on-site KPI copy");
mustNot(/id="centerKpi"|class="center-kpi"|center-kpi-strip/, "no hist KPI strip");
must(/#centerNavHistBtn \{ display:none/, "top History nav pill is hidden");

must(/id="centerHero"/, "hero photo");
must(/id="centerThumbs"/, "hero thumbs");
must(/function paintCenterThumbs\(/, "thumbs painter");
must(/id="centerMetrics"/, "market metrics strip");
must(/function paintCenterMetrics\(/, "metrics painter");
must(/\["range","Appraisal range"\]/, "appraisal range chip");
must(/\["compete","Competing offer"\]/, "competing offer chip");
must(/\["ask","Customer ask"\]/, "customer ask chip");
must(/id="centerValStrip"/, "offer row stays");
must(/id="centerMarket"/, "market cards stay");
must(/id="centerNotes"/, "notes stay");
must(/id="centerMayaBar"/, "Ask Maya bar");
must(/placeholder="Ask Maya"/, "Ask Maya placeholder");
must(/function askMaya\(/, "Ask Maya handler");
must(/id="acreDesk"/, "Acre desk wrapper");
must(/acre-col-hero/, "hero column");
must(/acre-col-mid/, "metrics / offers / notes column");
must(/acre-col-market/, "right market cards column");
must(/id="centerDock"[^>]*acre-dock|class="dock acre-dock"/, "Ask Maya and Complete share the Acre dock");
must(/#center\.screen \{[\s\S]{0,220}background:#F5F6F8/, "desk page is screenshot white, not stone");
mustNot(/#center\.screen \{[\s\S]{0,220}background:#F3F1EA/, "stone palette is reverted");
must(/id="centerStageBtn">Complete</, "Complete stays");
must(/id="centerRunTeam">Run Appraisal Team</, "Run Appraisal Team stays on the desk");
must(/if\(host\.id==="centerDocs"\) return;/, "Center hides generated From V Auto numbers");
must(/function paintDerivedMarket\(/, "Appraise still has the derived painter");

must(/function oldestReadyCenter\(/, "FIFO helper exists");
must(/function isCenterReadyToWork\(/, "ready-to-work helper exists");
must(/APP\.centerViewId=oldest\?oldest\.id:""/, "openCenter lands the oldest ready file");
must(/function openCenterLane\(/, "lane pills still open the full list");
mustNot(/function openCenter\(\)\{[\s\S]{0,400}APP\.centerViewId=""/, "openCenter no longer starts on an empty lobby");

must(/function pullUsersRemote\(/, "Users load from mailer");
must(/function persistUsersRemote\(/, "Users save to mailer");
must(/kind:"users"/, "Users blob kind is users");
must(/\/api\/incoming\?kind=users/, "Users GET hits kind=users");
must(/function applyUsersBlob\(/, "empty remote does not invent users");
must(/if\(!people\.length && !\(blob\.permissions/, "empty blob does not wipe or invent");

must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
mustNot(/id="exitRefresh"/, "Refresh stays gone");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");

(function testFifoOldest() {
  const readySrc = sliceFn("isCenterReadyToWork", "oldestReadyCenter");
  const oldSrc = sliceFn("oldestReadyCenter", "openCenter");
  function isCenterSample(item) { return !!(item && (item.sample || /^sample[-_]/i.test(String(item.id || "")))); }
  function centerLaneOf(item) { return item.lane; }
  function centerWhen(item) { return Number(item.sentAt || item.updatedAt || 0); }
  const items = [
    { id: "new-onsite", lane: "onsite", sentAt: 300 },
    { id: "old-inbox", lane: "inbox", sentAt: 100 },
    { id: "mid-docs", lane: "needsdocs", sentAt: 200 },
    { id: "hist", lane: "history", sentAt: 50 },
    { id: "sample-x", lane: "onsite", sentAt: 10, sample: true }
  ];
  function loadCenter() { return items; }
  const isCenterReadyToWork = eval("(" + readySrc.replace("function isCenterReadyToWork", "function") + ")");
  const oldestReadyCenter = eval("(" + oldSrc.replace("function oldestReadyCenter", "function") + ")");
  assert.strictEqual(isCenterReadyToWork(items[3]), false, "History is not ready work");
  assert.strictEqual(isCenterReadyToWork(items[4]), false, "samples are not ready work");
  assert.strictEqual(oldestReadyCenter().id, "old-inbox", "FIFO opens the oldest ready file, not newest");
  items[1].lane = "history";
  assert.strictEqual(oldestReadyCenter().id, "mid-docs", "next oldest after the first leaves the ready lanes");
})();

(function testUsersBlobEmptyDoesNotInvent() {
  const applySrc = sliceFn("applyUsersBlob", "persistUsersRemote");
  let stored = { people: [{ email: "local@myloan.ca", name: "Local", teams: [], leader: false }], permissions: {} };
  function loadUsersStore() { return stored; }
  function saveUsersStore(next) { stored = next; }
  function staffEmail(v) { return String(v || "").trim().toLowerCase(); }
  function normalizeTeams(v) { return Array.isArray(v) ? v : []; }
  const applyUsersBlob = eval("(" + applySrc.replace("function applyUsersBlob", "function") + ")");
  assert.strictEqual(applyUsersBlob({ ok: true, kind: "users", users: [], teams: [], permissions: {} }), false, "empty live roster is not applied");
  assert.strictEqual(stored.people[0].email, "local@myloan.ca", "empty GET does not invent or wipe local people");
  assert.ok(applyUsersBlob({
    ok: true,
    users: [{ email: "ernest@myloan.ca", name: "Ernest", teams: ["Team Flash"], leader: true, phone: "6135550100" }],
    permissions: { "ernest@myloan.ca": { center: true } }
  }), "saved blob applies");
  assert.strictEqual(stored.people.length, 1, "apply uses the saved roster only");
  assert.strictEqual(stored.people[0].email, "ernest@myloan.ca", "saved email survives");
  assert.strictEqual(stored.people[0].leader, true, "leader survives");
  assert.strictEqual(stored.people[0].phone, "6135550100", "cell survives");
  assert.deepStrictEqual(stored.people[0].teams, ["Team Flash"], "teams survive");
  assert.strictEqual(stored.permissions["ernest@myloan.ca"].center, true, "toggles survive");
})();

incoming.resetStore();
const emptyUsers = incoming.route("GET", null, { kind: "users" });
assert.equal(emptyUsers.status, 200);
assert.equal(emptyUsers.body.kind, "users");
assert.deepStrictEqual(emptyUsers.body.users, [], "mailer users blob starts empty — do not invent");
assert.equal(emptyUsers.body.via, "blob");

const saved = incoming.route("POST", {
  kind: "users",
  users: [{ email: "ernest@myloan.ca", name: "Ernest", teams: ["Team Flash"], leader: true, phone: "6135550100" }],
  teams: ["Team Flash"],
  permissions: { "ernest@myloan.ca": { center: true, admin: false } }
});
assert.equal(saved.status, 200);
assert.equal(saved.body.ok, true);
assert.equal(saved.body.kind, "users");

const got = incoming.route("GET", { kind: "users" });
assert.equal(got.body.users.length, 1, "POST users persists");
assert.equal(got.body.users[0].email, "ernest@myloan.ca");
assert.equal(got.body.users[0].leader, true);
assert.equal(got.body.users[0].phone, "6135550100");
assert.deepStrictEqual(got.body.users[0].teams, ["Team Flash"]);
assert.equal(got.body.permissions["ernest@myloan.ca"].center, true);

incoming.route("POST", { kind: "users", users: [], permissions: {} });
assert.deepStrictEqual(incoming.route("GET", null, { kind: "users" }).body.users, [], "empty save stays empty — no invented roster");

const itemsStill = incoming.route("GET");
assert.ok(Array.isArray(itemsStill.body.items), "GET without kind:users still lists Incoming items");

const paint = sliceFn("paintPacketDocs", "paintDerivedMarket");
assert.ok(/if\(host\.id==="centerDocs"\) return;/.test(paint), "Center vehicle detail returns before generated lane");
assert.ok(paint.indexOf('if(host.id==="centerDocs") return;') < paint.indexOf("paintDerivedMarket(host, store, readOnly)"), "Center skip is before the generated append");

const share = slice("async function sharePacket(){", "\nfunction resetAll()");
const kick = slice("function kickShare(){", "\nfunction packetSendId(");
const send = slice("async function sendFromMe(", "\nfunction openEml(");
assert.equal(sha(share), "89ddee81289962020d2a4277f941f60a93d110d42312da85ad94eaeaf8cdb170", "sharePacket is byte-identical to d25s");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare is byte-identical to d25s");
assert.equal(sha(send), "a87ba1cb730ce79683938a05a22d839878d60319f35418efb408cabdcf9a9b49", "sendFromMe is byte-identical to d25s");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("d31c-acre-fifo-users: ok");
