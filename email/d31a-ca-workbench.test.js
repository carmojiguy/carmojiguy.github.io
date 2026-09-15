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

must(/id="buildStamp">build d31a</, "footer stamp is d31a");
must(/<!--[\s\S]*build d31a[\s\S]*drop the verbal-only tag forever/, "header stamp is d31a CA workbench");
must(/id="typeSheet"[\s\S]*build d31a/, "type sheet stamp is d31a");

const job = slice('id="wbJob"', 'id="verify"');
mustNot(/Verbal only/i, "VERBAL ONLY tag is gone forever");
mustNot(/id="wbJob"[\s\S]*Verbal only/i, "job cards never show Verbal only");
assert.ok(!/Verbal only/i.test(job), "workbench job has no Verbal only tag");
assert.ok(/id="wbStory"/.test(job), "What's the Story stays");
assert.ok(/What.?s the Story\?/.test(job), "What's the Story? title stays");
assert.ok(/Walk the car and talk/.test(job), "story helper is walk-and-talk");
assert.ok(/any length/.test(job), "mic is any length");
assert.ok(/Inside and outside condition/.test(job), "inside/outside condition");
assert.ok(/high-value options/.test(job), "high-value options");
assert.ok(/selling features and hinderances/.test(job), "selling features + hinderances");
mustNot(/Verbal description only/, "no Verbal description only copy");
mustNot(/verbal description only/, "no verbal description only copy");
mustNot(/Year, make, VIN, and seller stay as Airtable filled them/, "Airtable-only story copy is gone");

assert.ok(/id="wbWalk"/.test(job), "Walk-around stays");
assert.ok(/Photos in order/.test(job), "Photos in order stays");
assert.ok(/Photos only/.test(job), "walk control is photos only");
assert.ok(/No video on this control/.test(job), "no video on the walk-around control");
assert.ok(!/video/i.test(job.replace(/No video on this control/, "")), "walk card does not advertise video");
must(/\$\("wbWalk"\)\.onclick = function\(\)\{ if\(!requireAppraiseType\(\)\) return; show\("photos"\); \}/, "walk opens existing Multimedia photos");

assert.ok(/id="wbDmg"/.test(job), "Critical / Damage photos stay");
assert.ok(/>Critical</.test(job), "Critical tag stays");
assert.ok(/Damage photos/.test(job), "Damage photos stay");

assert.ok(!/id="wbSendCard"/.test(job), "Airtight Send card is removed from CA workbench");
assert.ok(!/Airtight Send/.test(job), "Airtight Send tag is gone from CA workbench");
assert.ok(!/Send the packet/.test(job), "Send the packet is gone from CA workbench");
mustNot(/id="wbSendCard"/, "salesperson CA workbench has no Send card");
mustNot(/Airtight Send/, "Airtight Send copy is gone");

must(/id="apptSearch"/, "app # search stays");
must(/if\(typed\) q \+= \(q \? "&" : "\?"\) \+ "q=" \+ encodeURIComponent\(typed\)/, "typed app number still ?q=");
must(/data-appt-region="GTA"/, "GTA tab stays");
must(/data-appt-region="Ottawa"/, "Ottawa tab stays");
must(/id="apptTrackerGta"/, "GTA Tracker stays");
must(/id="apptTrackerOttawa"/, "Ottawa Tracker stays");
must(/id="apptNewApp"/, "New application stays");
must(/id="wbHistBtn"/, "History stays");
must(/TRACKER_GTA_URL="https:\/\/docs\.google\.com\/spreadsheets\/d\/1DXKFHK_k1cC_upbxzBIVTLbMKpOIv0u5MB2NbKq5XhM\/edit\?usp=sharing"/, "GTA Tracker sheet id stays");
must(/TRACKER_OTTAWA_URL="https:\/\/docs\.google\.com\/spreadsheets\/d\/1QRmPSMX_-nksYs4ucJxZUfTQcvrMlfbnylJgTL0ckNU\/edit\?usp=sharing"/, "Ottawa Tracker sheet id stays");

must(/function trackerCurrentMonth\(/, "tracker current month helper");
must(/function trackerHref\(/, "tracker href helper");
must(/function openTrackerSheet\(/, "tracker helper stays");
must(/function openTrackerGoogleDoc\(/, "tracker taps open Google Docs");
must(/function paintTrackerSheet\(/, "tracker paints mobile + desk");
must(/function paintApptMonths\(/, "main page paints month pills");
must(/id="apptMonths"/, "main page has month scroller");
must(/class="tracker-mobile"/, "tracker mobile card host");
must(/class="tracker-desk"/, "tracker desktop table host");
must(/@media \(max-width:979px\)\{[\s\S]*\.tracker-desk\{display:none !important\}/, "phone hides the wide table");
must(/@media \(min-width:980px\)\{[\s\S]*\.tracker-mobile\{display:none\}/, "desktop hides stacked cards");
must(/if\(!APP\.trackerMonth\) APP\.trackerMonth=trackerCurrentMonth\(\)/, "tracker opens on current month");
must(/id="trackerSheet"/, "in-app tracker sheet exists");
must(/openTrackerSheet\("GTA"/, "GTA Tracker tap uses the Google Doc opener");
must(/openTrackerSheet\("Ottawa"/, "Ottawa Tracker tap uses the Google Doc opener");
must(/view=tracker/, "month pull asks the mailer for the tracker view");
must(/apptRange:"month"/, "desk defaults to the current month, not Today");
mustNot(/range=\+encodeURIComponent\("'"\+m\+"'!A1"\)/, "quoted September range is gone — it blocked Google Docs");
must(/function openExternalDoc\(/, "Google Doc taps use window.open + fallback");

(function testCurrentMonthHref() {
  const start = html.indexOf("const TRACKER_MONTHS=");
  const end = html.indexOf("\nfunction bindTrackerLinks(", start);
  assert.ok(start > 0 && end > start, "tracker helpers extractable");
  const h = new Function(html.slice(start, end) + "; return { trackerCurrentMonth: trackerCurrentMonth, trackerHref: trackerHref };")();
  assert.strictEqual(h.trackerCurrentMonth(new Date(2026, 8, 14)), "September", "14 Sep 2026 is September");
  assert.strictEqual(h.trackerCurrentMonth(new Date(2026, 0, 1)), "January", "1 Jan is January");
  const href = h.trackerHref("https://docs.google.com/spreadsheets/d/abc/edit?usp=sharing", "September");
  assert.ok(href.indexOf("docs.google.com/spreadsheets") >= 0, "href stays a Google Sheet");
  assert.ok(href.indexOf("usp=sharing") >= 0, "sharing URL stays");
  assert.ok(href.indexOf("range=") < 0, "href has no range= that Google login rejects");
  assert.ok(href.indexOf("'September'") < 0, "href has no quoted sheet name");
})();

assert.strictEqual(api.trackerCurrentMonth(new Date(2026, 8, 14)), "September", "API current month is September");
assert.strictEqual(api.excelSerialDate(46266), "2026-09-01", "Excel serial becomes Sept 1 2026");
const parsed = api.parseTrackerMatrix([
  ["September Appointments"],
  ["Lead Date", "Agent", "Offer Response", "Appointment Status", "App-Number", "Appt. Date", "Seller Name", "Seller City", "Seller Phone", "Year Make Model Trim"],
  ["", "", "", "Confirmed", "APP-0003341090", "46266", "Brad Ong", "Brampton", "(647) 834-7413", "2017 Kia Sportage LX"]
], "GTA", "gta-tracker");
assert.strictEqual(parsed.length, 1, "one tracker row parsed");
assert.strictEqual(parsed[0].appNo, "APP-0003341090", "app number");
assert.strictEqual(parsed[0].seller, "Brad Ong", "seller");
assert.strictEqual(parsed[0].date, "2026-09-01", "appt date");
assert.strictEqual(parsed[0].via, "gta-tracker", "via stays tracker — no invented sold");
assert.ok(api.matchApp(parsed[0], api.needleOf("APP-0003341090")), "q= still matches tracker app #");

const parsedKm = api.parseTrackerMatrix([
  ["September Appointments"],
  ["Lead Date", "Agent", "Offer Response", "Appointment Status", "App-Number", "Appt. Date", "Seller Name", "Seller City", "Seller Phone", "Year Make Model Trim", "VIN", "Kms"],
  ["", "", "", "Confirmed", "APP-0006483345", "46266", "Sample Seller", "Brampton", "(647) 000-0000", "2022 Toyota Rav4 LE", "2T3Z1RFV9NW231154", "50,500"]
], "GTA", "gta-tracker");
assert.strictEqual(parsedKm[0].km, "50500", "Tracker Kms column becomes appointment km");
assert.strictEqual(parsedKm[0].ymm, "2022 Toyota Rav4 LE", "Tracker YMM stays");

must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
must(/id="workbench"/, "CA workbench stays");
must(/#workbench \.wb-pick-desk/, "desktop workbench is a real two-column desk");
must(/wb-grid \{ grid-template-columns:1fr 1fr 1fr/, "desktop action cards are three across, not a stretched phone");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");

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

console.log("d31a-ca-workbench: ok");
