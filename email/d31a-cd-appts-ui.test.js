#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const api = require(path.join(root, "api/appointments.js"));

function must(re, msg) {
  assert.ok(re.test(html), msg);
}
function mustNot(re, msg) {
  assert.ok(!re.test(html), msg);
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

must(/id="buildStamp">build d31a</, "footer stamp stays d31a");
must(/id="apptMonths"/, "Canada Drives desk has month pills");
must(/data-appt-month/, "month pills set the selected month");
must(/function paintApptMonths\(/, "month pills are painted");
must(/function openTrackerGoogleDoc\(/, "Google Docs opener exists");
must(/function openExternalDoc\(/, "external doc helper exists");
must(/apptRange:"month"/, "default range is the current month");
must(/Booked appointments from the GTA and Ottawa Tracker/, "main copy names the live sheets");
must(/id="apptTrackerGta"/, "GTA Tracker stays");
must(/id="apptTrackerOttawa"/, "Ottawa Tracker stays");
must(/function applyAppointment\(/, "tapping a row still prefills Appraise");
must(/src && src!=="Canada Drives"\) return false/, "appointments stay Canada Drives only");
must(/id="wbPick"/, "picker desk stays");
must(/#wbPick \.wb-hero/, "pick desk uses the quiet Acre hero");
mustNot(/range=\+encodeURIComponent\("'"\+m\+"'!A1"\)/, "quoted sheet range is gone");
must(/TRACKER_GTA_URL="https:\/\/docs\.google\.com\/spreadsheets\/d\/1DXKFHK_k1cC_upbxzBIVTLbMKpOIv0u5MB2NbKq5XhM\/edit\?usp=sharing"/, "GTA sheet id stays");
must(/TRACKER_OTTAWA_URL="https:\/\/docs\.google\.com\/spreadsheets\/d\/1QRmPSMX_-nksYs4ucJxZUfTQcvrMlfbnylJgTL0ckNU\/edit\?usp=sharing"/, "Ottawa sheet id stays");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");
must(/id="startTrade"/, "Trade-in Send stays on start");

assert.strictEqual(api.isoMonthName("2026-09-03"), "September", "API month of Sept 3");
assert.strictEqual(api.isoMonthName("2026-08-19"), "August", "API month of Aug 19");
assert.ok(api.inTrackerRegion({ region: "GTA" }, "GTA"), "GTA stays GTA");
assert.ok(api.inTrackerRegion({ location: "Ottawa" }, "Ottawa"), "Ottawa stays Ottawa");
assert.ok(api.inTrackerRegion({ region: "" }, "GTA"), "blank region lands on GTA like the desk");
assert.ok(!api.inTrackerRegion({ region: "Ottawa" }, "GTA"), "Ottawa does not leak into GTA");

const merged = api.mergeAppointmentRows(
  [{ appNo: "APP-0003339075", vin: "TBD", ymm: "2025 Buick Envista Avenir", seller: "Ahmed Omer" }],
  [{ appNo: "APP-0003339075", vin: "KL47LCE21SB053454", ymm: "2025 Buick Envista Avenir", seller: "Ahmed Omer" }]
);
assert.strictEqual(merged.length, 1, "same app # merges");
assert.strictEqual(merged[0].vin, "KL47LCE21SB053454", "Airtable VIN wins over empty/TBD");

const sept = [
  { id: "buick", region: "GTA", source: "Canada Drives", date: "2026-09-01", appNo: "APP-0003339075", ymm: "2025 Buick Envista Avenir" },
  { id: "sonata", region: "GTA", source: "Canada Drives", date: "2026-09-03", appNo: "APP-0003341511", ymm: "2023 Hyundai Sonata Sport" },
  { id: "aug", region: "GTA", source: "Canada Drives", date: "2026-08-19", appNo: "APP-0003332535", ymm: "2023 Porsche Cayenne Platinum" },
  { id: "ott", region: "Ottawa", source: "Canada Drives", date: "2026-09-01", appNo: "APP-0003340971", ymm: "2023 Hyundai Elantra" }
];
assert.deepStrictEqual(
  sept.filter(function (row) { return api.inTrackerRegion(row, "GTA") && api.isoMonthName(row.date) === "September"; }).map(function (r) { return r.id; }),
  ["buick", "sonata"],
  "September GTA list is the booked vehicles for that month"
);

(function testSeptemberFilterOnDesk() {
  function startOfDay(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return x.getTime();
  }
  const boundsM = html.match(/function apptRangeBounds\(kind, fromVal, toVal\)\{[\s\S]*?\n\}/);
  const whenM = html.match(/function apptWhen\(row\)\{[\s\S]*?\n\}/);
  const filterM = html.match(/function filteredAppointments\(\)\{[\s\S]*?\n\}/);
  assert.ok(boundsM && whenM && filterM, "month filter helpers extractable");
  const apptRangeBounds = eval("(" + boundsM[0].replace(/^function apptRangeBounds/, "function") + ")");
  const apptWhen = eval("(" + whenM[0].replace(/^function apptWhen/, "function") + ")");
  function $(id) { return { value: "" }; }
  var APP = {
    apptRegion: "GTA",
    leadSource: "Canada Drives",
    apptRange: "month",
    apptMonth: "September",
    apptItems: sept
  };
  const filteredAppointments = eval("(" + filterM[0].replace(/^function filteredAppointments/, "function") + ")");
  assert.deepStrictEqual(
    filteredAppointments().map(function (r) { return r.id; }).sort(),
    ["buick", "sonata"],
    "clicking September lists GTA booked vehicles for September"
  );
})();

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

console.log("d31a-cd-appts-ui: ok");
