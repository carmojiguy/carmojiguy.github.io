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
must(/id="caDrawer"/, "Canada Drives list is a far-left collapsible drawer");
must(/#center\.screen\.ca-on/, "drawer docks on Appraisal Center, not a full-page workbench");
must(/function toggleCaDrawer\(/, "booked list collapses");
must(/function findCenterForAppt\(/, "tapping a booked row can open the matching Center file");
must(/#center \.acre-desk\{[\s\S]{0,220}grid-template-areas:"hero mid market"/, "Acre hero|mid|market stays");
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

const mergedKm = api.mergeAppointmentRows(
  [{ appNo: "APP-0003339075", vin: "KL47LCE21SB053454", ymm: "2025 Buick Envista Avenir", km: "" }],
  [{ appNo: "APP-0003339075", vin: "KL47LCE21SB053454", ymm: "2025 Buick Envista Avenir", km: "18420" }]
);
assert.strictEqual(mergedKm[0].km, "18420", "tracker/Airtable kilometres merge onto the booked row");

assert.strictEqual(api.normalizeKm(18420), "18420", "Airtable Kms number stays digits");
assert.strictEqual(api.normalizeKm("18,420 km"), "18420", "sheet kilometres with unit strip to digits");
assert.strictEqual(api.normalizeKm(""), "", "blank kilometres stay blank");

const corvette = api.mapRecord({
  id: "recl6gS2ME7cm2Mlf",
  fields: {
    flds1XRKp8DKl6zaS: "APP-0003349834",
    fld7T0bVJ3z6ndPbi: "2017 Chevrolet Corvette Stingray",
    fldFLTbpXZAQ5RiOr: "1G1YD2D7XH5119806",
    fldCHTFWNcYeF9MIT: "Mohit Sehjal",
    fld1ReQkIiObeuXr9: 53700
  }
});
assert.strictEqual(corvette.ymm, "2017 Chevrolet Corvette Stingray", "Today GTA Corvette keeps YMM");
assert.strictEqual(corvette.km, "53700", "Today GTA Corvette reads Airtable Kms 53700");

must(/function apptKmText\(/, "appointment tiles format kilometres");
must(/function apptTileHtml\(/, "appointment tile HTML is one helper");
must(/class="appt-km"/, "Canada Drives list tiles render a kilometres line");
must(/\.appt-row \.appt-body \.appt-km/, "list-tile kilometres are styled under YMM");
must(/if\(a\.km\) APP\.km=a\.km/, "tapping a booked vehicle prefills Appraise km");
must(/kmTxt/, "CA desk hero chips include kilometres");
must(/fld1ReQkIiObeuXr9/, "mailer requests Airtable Kms");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");

(function testApptTileHtmlIncludesKmAndYmm() {
  const kmM = html.match(/function apptKmText\(row\)\{[\s\S]*?\n\}/);
  const tileM = html.match(/function apptTileHtml\(row\)\{[\s\S]*?\n\}/);
  assert.ok(kmM && tileM, "tile helpers extractable");
  function escHtml(s) { return String(s == null ? "" : s); }
  const apptKmText = eval("(" + kmM[0].replace(/^function apptKmText/, "function") + ")");
  const apptTileHtml = eval("(" + tileM[0].replace(/^function apptTileHtml/, "function") + ")");
  const htmlOut = apptTileHtml({
    id: "corvette",
    date: "2026-09-14",
    stage: "booked",
    ymm: "2017 Chevrolet Corvette Stingray",
    km: "53700",
    appNo: "APP-0003349834",
    seller: "Mohit Sehjal",
    vin: "1G1YD2D7XH5119806"
  });
  assert.ok(htmlOut.indexOf("2017 Chevrolet Corvette Stingray") >= 0, "list tile title keeps year make model");
  assert.ok(/class="appt-km"/.test(htmlOut), "list tile has a dedicated kilometres line");
  assert.ok(/53,?700 km/.test(htmlOut), "list tile HTML includes kilometres for a booked row with Airtable Kms");
  assert.ok(htmlOut.indexOf("2017 Chevrolet Corvette Stingray") < htmlOut.indexOf("appt-km"), "YMM stays the title; km sits under it");
  assert.strictEqual(apptKmText({ km: 53700 }), Number(53700).toLocaleString("en-CA") + " km", "53,700 km formats with en-CA grouping");
  const mustang = apptTileHtml({
    ymm: "2018 Ford Mustang Eco",
    km: "14000",
    appNo: "APP-0003346310",
    seller: "Navjot singh Sandhu",
    date: "2026-09-14",
    stage: "booked"
  });
  assert.ok(mustang.indexOf("2018 Ford Mustang Eco") >= 0, "Mustang list tile keeps YMM");
  assert.ok(/14,?000 km/.test(mustang), "Mustang list tile shows Airtable Kms 14000");
  const mazda = apptTileHtml({ ymm: "2015 Mazda CX-9 GS", km: "", date: "2026-09-14", stage: "booked" });
  assert.ok(mazda.indexOf("2015 Mazda CX-9 GS") >= 0, "Mazda list tile still shows YMM when Kms is empty");
  assert.ok(mazda.indexOf("appt-km") < 0, "blank Kms does not invent a km line on the list tile");
})();

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

must(/id="acqDrawerToggle"/, "Acquisitions toggle sits beside Canada Drives");
must(/id="acqDrawerBody"/, "Acquisitions kanban uses the same left drawer");
must(/function toggleAcqDrawer\(/, "Acquisitions opens and closes like Canada Drives");
must(/#center\.screen\.ca-on\.acq-on/, "Acquisitions expands the same left Center drawer");
must(/#center\.screen\.ca-on\.acq-on:has\(#centerSheet\.on\)/, "lane sheet does not squash the Kanban back to the booked-list width");
must(/function paintAcqBoard\(/, "Acquisitions paints a Kanban board");
must(/Showing the last 30 days — search to find older records/, "30-day header note");
must(/Pending Decision/, "Pending Decision column");
must(/Follow-up/, "Follow-up column");
must(/Purchased/, "Purchased column");
must(/Pending Close Out/, "Pending Close Out column");
must(/Closed Out/, "Closed Out column");
must(/Stocked In/, "Stocked In column");
must(/Payment Complete/, "Payment Complete column");
must(/Archived/, "Archived column");
must(/view=board/, "mailer board view for live acquisition stages");
must(/class="acq-drawer-toggle"/, "Acquisitions control is a quiet drawer button, not a loud pill");
mustNot(/id="acqDrawerToggle"[^>]*class="[^"]*pill/, "Acquisitions toggle is not a colored pill");
must(/#center \.acre-desk\{[\s\S]{0,220}grid-template-areas:"hero mid market"/, "Acre desk stays hero|mid|market");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");

assert.strictEqual(api.mapBoardColumn("Pending Decision"), "pending-decision", "Pending Decision maps");
assert.strictEqual(api.mapBoardColumn("Follow-up"), "follow-up", "Follow-up maps");
assert.strictEqual(api.mapBoardColumn("Purchased"), "purchased", "Purchased maps");
assert.strictEqual(api.mapBoardColumn("Pending Close Out"), "pending-close", "Pending Close Out maps");
assert.strictEqual(api.mapBoardColumn("Closed Out"), "closed-out", "Closed Out maps");
assert.strictEqual(api.mapBoardColumn("Stocked In"), "stocked-in", "Stocked In maps");
assert.strictEqual(api.mapBoardColumn("Payment Complete"), "payment", "Payment Complete maps");
assert.strictEqual(api.mapBoardColumn("Archived"), "archived", "Archived maps");
assert.strictEqual(api.mapBoardColumn("Appointment Booked"), "", "booked appointments stay off the Kanban");
assert.strictEqual(api.BOARD_COLUMNS.length, 8, "eight Kanban columns");
assert.deepStrictEqual(api.BOARD_COLUMNS.map(function (c) { return c.target; }), [23, 2, 0, 1, 0, 5, 27, 22], "Shawn target counts");
const atlas = api.mapBoardRecord({
  id: "rec-atlas",
  createdTime: "2026-09-15T12:00:00.000Z",
  fields: {
    flds1XRKp8DKl6zaS: "APP-0003349831",
    fld7T0bVJ3z6ndPbi: "2024 Volkswagen Atlas Cross Sport Comfortline",
    fldFLTbpXZAQ5RiOr: "1V2AT2CA6RC255025",
    fldTyRUrsJS9ffZ3Z: { name: "Pending Decision" },
    Agent: { email: "shayne.upper@example.com", name: "Shayne Upper" }
  }
});
assert.strictEqual(atlas.column, "pending-decision", "Atlas lands in Pending Decision");
assert.strictEqual(atlas.appNo, "APP-0003349831", "board card keeps APP id");
assert.strictEqual(atlas.ymm, "2024 Volkswagen Atlas Cross Sport Comfortline", "board card keeps YMM");
assert.strictEqual(atlas.vin, "1V2AT2CA6RC255025", "board card keeps VIN");
assert.strictEqual(atlas.assignee, "shayne.upper", "collaborator email becomes assignee handle");

(function testAcqCardHtml() {
  const fn = html.match(/function acqCardHtml\(row\)\{[\s\S]*?\n\}/);
  assert.ok(fn, "acq card helper extractable");
  function escHtml(s) { return String(s == null ? "" : s); }
  const ACQ_COLUMNS = [
    { id: "pending-decision", label: "Pending Decision", color: "#22C55E", target: 23 }
  ];
  const acqAgeText = function (days) { return (Number(days) || 0) + "d"; };
  const acqCardHtml = eval("(" + fn[0].replace(/^function acqCardHtml/, "function") + ")");
  const card = acqCardHtml({
    id: "rec-atlas",
    column: "pending-decision",
    appNo: "APP-0003349831",
    ymm: "2024 Volkswagen Atlas Cross Sport Comfortline",
    vin: "1V2AT2CA6RC255025",
    assignee: "Shayne.upper",
    ageDays: 0
  });
  assert.ok(card.indexOf("APP-0003349831") >= 0, "card shows APP id");
  assert.ok(card.indexOf("2024 Volkswagen Atlas Cross Sport Comfortline") >= 0, "card shows YMM bold");
  assert.ok(card.indexOf("1V2AT2CA6RC255025") >= 0, "card shows VIN");
  assert.ok(card.indexOf("Shayne.upper") >= 0, "card shows assignee");
  assert.ok(/0d/.test(card), "card shows age in days");
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
