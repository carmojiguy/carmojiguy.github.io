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
function sliceFn(name) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start > 0, name + " found");
  const next = html.indexOf("\nfunction ", start + 10);
  return html.slice(start, next > start ? next : start + 1200);
}

must(/function unpackCenterPhotos\(/, "unpackCenterPhotos");
must(/function expandCenterDocs\(/, "expandCenterDocs");
must(/function applyCenterItemToApp\(/, "applyCenterItemToApp");
must(/function parkAppraisalToHistory\(/, "parkAppraisalToHistory");
must(/function reopenHistoryAppraisal\(/, "reopenHistoryAppraisal");
must(/id="buildStamp">build d30c</, "build stamp is d30c");
must(/History — open a file to keep working/, "History jump says open to keep working");
must(/Tap a file to keep working/, "History lead says tap to keep working");

const closer = sliceFn("pageClose");
assert.ok(closer.indexOf("parkAppraisalToHistory") >= 0, "X parks the appraisal in History");
assert.ok(closer.indexOf("kickShare") < 0, "X does not touch kickShare");
assert.ok(closer.indexOf("sharePacket") < 0, "X does not touch sharePacket");
assert.ok(closer.indexOf("finishGuest") < 0, "X does not touch finishGuest");
assert.ok(closer.indexOf("restoreSend") < 0, "X does not touch restoreSend");

const row = sliceFn("staffHistRow");
assert.ok(row.indexOf("reopenHistoryAppraisal") >= 0, "History rows reopen the appraisal");
assert.ok(row.indexOf("isWebsiteItem") >= 0, "website History stays on its own path");

const acre = sliceFn("acreRow");
assert.ok(acre.indexOf('lane==="history"') >= 0, "Center History rows reopen");
assert.ok(acre.indexOf("reopenHistoryAppraisal") >= 0, "Center History calls reopen");
assert.ok(acre.indexOf("openCenterDetail") >= 0, "Incoming and On-site still open the desk");

const park = sliceFn("parkAppraisalToHistory");
assert.ok(park.indexOf('APP.role==="guest"') >= 0, "guests are not parked into staff History");
assert.ok(park.indexOf("isWeb") >= 0, "website studio is not parked into appraisal History");
assert.ok(park.indexOf("upsertCenterFromApp") >= 0, "park writes the live file");
assert.ok(park.indexOf('x.lane="history"') >= 0, "park lands in History");
assert.ok(park.indexOf('x.stage="Appraised"') < 0, "park does not mark Complete");
assert.ok(park.indexOf("kickShare") < 0, "park does not Send");
assert.ok(park.indexOf("sharePacket") < 0, "park does not sharePacket");
assert.ok(park.indexOf("finishGuest") < 0, "park does not finishGuest");

const apply = sliceFn("applyCenterItemToApp");
assert.ok(apply.indexOf("wipeJob(false)") >= 0, "reopen loads onto a clean job");
assert.ok(apply.indexOf("APP.centerId=item.id") >= 0, "same file stays linked");
assert.ok(apply.indexOf('APP.sendId=""') >= 0, "reopen can Send again");
assert.ok(apply.indexOf("unpackCenterPhotos") >= 0, "photos come back");
assert.ok(apply.indexOf("expandCenterDocs") >= 0, "docs come back");
assert.ok(apply.indexOf("APP.newApplication=true") >= 0, "My Loan / My Auto / Carla stay unlocked");
assert.ok(apply.indexOf('APP.apptId=item.id||"history"') >= 0, "Canada Drives stays unlocked");
assert.ok(apply.indexOf("kickShare") < 0, "hydrate does not Send");
assert.ok(apply.indexOf("sharePacket") < 0, "hydrate does not sharePacket");

const reopen = sliceFn("reopenHistoryAppraisal");
assert.ok(reopen.indexOf("applyCenterItemToApp") >= 0, "reopen hydrates the job");
assert.ok(/show\("photos"\)/.test(reopen), "photos reopen on the photos screen");
assert.ok(/show\("home"\)/.test(reopen), "story-only files reopen on Appraise home");
assert.ok(reopen.indexOf("paintDocs") >= 0, "docs stay editable");
assert.ok(reopen.indexOf("paintLists") >= 0, "photos stay editable");
assert.ok(reopen.indexOf("openCenterDetail") >= 0, "website files stay on Center");
assert.ok(reopen.indexOf("kickShare") < 0, "reopen does not Send");
assert.ok(reopen.indexOf("sharePacket") < 0, "reopen does not sharePacket");
assert.ok(reopen.indexOf("finishGuest") < 0, "reopen does not finishGuest");

must(/function kickShare\(/, "kickShare stays");
must(/function sharePacket\(/, "sharePacket stays");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "finishGuest stays Thank-you-only");
mustNot(/function kickShare\(\)\{[\s\S]{0,80}parkAppraisalToHistory/, "Send is not rewritten by History park");
mustNot(/function sharePacket\(\)\{[\s\S]{0,80}reopenHistoryAppraisal/, "sharePacket is not rewritten by reopen");

(function testUnpackPhotos() {
  const VIEWS = [
    ["qfront", "3/4 Front"],
    ["front", "Front"]
  ];
  function walkViewIndex(key) {
    const k = String(key || "").trim().toLowerCase();
    if (k === "qfront" || k.indexOf("3/4 front") === 0) return 0;
    if (k === "front") return 1;
    return -1;
  }
  const unpackCenterPhotos = eval("(" + sliceFn("unpackCenterPhotos") + ")");
  const got = unpackCenterPhotos([
    { kind: "walk", view: "qfront", data: "walk-front" },
    { kind: "damage", view: "front", data: "ding", cap: "door ding", audio: "voice" },
    { kind: "close", data: "close-1", cap: "chip", audio: "note", audioMime: "audio/webm" }
  ]);
  assert.strictEqual(got.photos.qfront, "walk-front", "walk photo restores");
  assert.strictEqual(got.damage.front.length, 1, "damage photo restores");
  assert.strictEqual(got.damage.front[0].cap, "door ding", "damage caption restores");
  assert.strictEqual(got.closeups[0], "close-1", "close-up restores");
  assert.strictEqual(got.closeupCap[0], "chip", "close-up caption restores");
  assert.strictEqual(got.closeupAudio[0].data, "note", "close-up voice restores");
})();

(function testExpandDocs() {
  const expandCenterDocs = eval("(" + sliceFn("expandCenterDocs") + ")");
  const got = expandCenterDocs({
    vauto: { have: true, name: "summary.pdf", preview: "data:image/jpeg,v" },
    carfax: { have: true, preview: "data:image/jpeg,c" },
    empty: { have: false }
  });
  assert.ok(got.vauto && got.vauto_docs, "V Auto slim slot maps to the add-docs pill");
  assert.strictEqual(got.vauto_docs.preview, "data:image/jpeg,v", "preview survives");
  assert.ok(got.carfax && got.carfax.have, "Carfax comes back");
  assert.ok(!got.empty, "empty slots stay out");
})();

(function testApplyUnlocks() {
  const APP = {
    role: "employee", purpose: "", year: "", make: "", model: "", trim: "", color: "",
    km: "", vin: "", stock: "", heard: "", notes: "", webcopy: "", photos: {}, damage: {},
    closeups: [], docs: {}, damageCap: {}, closeupCap: [], closeupAudio: [],
    dealType: "", leadSource: "", cdApp: "", apptId: "", apptSeller: "", deskTeam: "",
    centerId: "old", sendId: "old-send", newApplication: false, inviteName: "",
    inviteEmail: "", invitePhone: "", inviteUnit: "", inviteStock: "",
    requestedBy: "", requestedByName: ""
  };
  function wipeJob(goStart) {
    APP.year = APP.make = APP.model = APP.trim = APP.color = APP.km = APP.vin = APP.stock = "";
    APP.heard = APP.notes = APP.webcopy = "";
    APP.dealType = ""; APP.leadSource = ""; APP.cdApp = ""; APP.apptId = ""; APP.apptSeller = "";
    APP.newApplication = false; APP.centerId = ""; APP.sendId = ""; APP.deskTeam = "";
    APP.photos = {}; APP.damage = {}; APP.closeups = []; APP.docs = {}; APP.closeupCap = []; APP.closeupAudio = [];
    void goStart;
  }
  function unpackCenterPhotos() {
    return { photos: { qfront: "hero" }, damage: {}, closeups: [], closeupCap: [], closeupAudio: [] };
  }
  function expandCenterDocs(docs) { return docs || {}; }
  const applyCenterItemToApp = eval("(" + sliceFn("applyCenterItemToApp") + ")");
  applyCenterItemToApp({
    id: "c-hist-1",
    purpose: "appraise",
    year: "2021",
    make: "Toyota",
    model: "RAV4",
    vin: "2t3b1rfvxrc466025",
    story: "Clean trade. One key.",
    dealType: "Consumer Acquisition",
    leadSource: "My Loan",
    docs: { carfax: { have: true, preview: "x" } }
  }, { photos: [{ kind: "walk", view: "qfront", data: "hero" }], docs: { carfax: { have: true, preview: "x" } } });
  assert.strictEqual(APP.centerId, "c-hist-1", "reopen keeps the History id");
  assert.strictEqual(APP.sendId, "", "reopen clears the old Send lock");
  assert.strictEqual(APP.year, "2021", "year comes back");
  assert.strictEqual(APP.make, "Toyota", "make comes back");
  assert.strictEqual(APP.vin, "2T3B1RFVXRC466025", "VIN comes back");
  assert.strictEqual(APP.heard, "Clean trade. One key.", "story comes back");
  assert.strictEqual(APP.dealType, "Consumer Acquisition", "type comes back");
  assert.strictEqual(APP.leadSource, "My Loan", "lead source comes back");
  assert.strictEqual(APP.newApplication, true, "My Loan file stays editable");
  assert.strictEqual(APP.apptId, "new", "My Loan is not bounced to appointments");
  assert.strictEqual(APP.photos.qfront, "hero", "walk photo is live");
})();

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("history-reopen tests ok");
