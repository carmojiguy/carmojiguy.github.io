#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const vm = require("vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function must(re, msg) {
  assert.ok(re.test(html), msg);
}
function mustNot(re, msg) {
  assert.ok(!re.test(html), msg);
}

must(/\/api\/remind/, "pages post reminder jobs to the mailer");
must(/MAIL_HOST\+"\/api\/remind"|MAIL_HOST\)\+"\/api\/remind"/, "remind URL is MAIL_HOST + /api/remind");
must(/function syncFileReminders\(/, "state-change hook is named and obvious");
must(/function remindOpen\(/, "incomplete-docs can call remindOpen");
must(/function remindDone\(/, "incomplete-docs can call remindDone");
must(/function applyRemindExtra\(/, "upsert passthrough for incomplete / attention flags");
must(/syncFileReminders\(item, prevRemind\)/, "patchCenter and upsert register on transition");
must(/ernie@|ernest@myloan\.ca/, "Flash leader comes from PR #8 seed (Ernest)");
must(/elias\.abdi@myloan\.ca/, "Flash leader comes from PR #8 seed (Elias)");
must(/kyle@myloan\.ca/, "Retail leader Kyle");
must(/lord\.grande@myloan\.ca/, "Retail + House leader Lord");
must(/tushar\.gupta@myloan\.ca/, "Evo leader Tushar");
must(/toEmail:SHAWN_REMIND_EMAIL|SHAWN_REMIND_EMAIL="shawn@myloan\.ca"/, "on-site reminds Shawn only");
mustNot(/setInterval\([^)]*15|setTimeout\([^)]*900000/, "no 15-minute timer in the page");
must(/kind:"send"/, "guest/staff Send still posts kind:send");
must(/timedFetch\(MAIL_HOST\+"\/api\/upload"/, "Send still hits /api/upload");
must(/function sharePacket\(\)|async function sharePacket\(\)/, "packet Send stays");
must(/id="thanks"|finishGuest\(/, "Thank you path stays");
must(/function loadAppointments\(/, "CA appointments stay");
must(/hideMailOpen\(\)/, "Send still hides Open Gmail");
must(/never unhide on Send/, "Open Gmail stays a hidden leftover, not a Send path");

const start = html.indexOf("/* ===== 15-min reminders (Shawn lock) =====");
const end = html.indexOf("/* ===== /15-min reminders =====");
assert.ok(start > 0 && end > start, "reminder block is marked for the other agent");
const block = html.slice(start, end);

const posts = [];
const sandbox = {
  posts: posts,
  APP: { userEmail: "jay.cyr@myloan.ca", userName: "Jay Cyr", deskTeam: "Team Retail", requestedBy: "", docs: {} },
  DESK_TEAMS: ["Team Flash","Team Retail","Team Evo","Team ABC","Team Saskatchewan","Team Fire","Team House","Team Consumer Acquisition"],
  SEED_LEADERS: {
    "kyle@myloan.ca": ["Team Retail"],
    "lord.grande@myloan.ca": ["Team Retail", "Team House"],
    "tushar.gupta@myloan.ca": ["Team Evo"],
    "ernest@myloan.ca": ["Team Flash"],
    "elias.abdi@myloan.ca": ["Team Flash"],
    "david.m@myloan.ca": ["Team Fire"],
    "tony.wiebe@myloan.ca": ["Team Saskatchewan"]
  },
  PACKET_DOCS: [
    {id:"vauto", label:"vAuto", kind:"launch"},
    {id:"carfax", label:"Carfax", kind:"extract"},
    {id:"mmr", label:"MMR", kind:"extract"},
    {id:"blackbook", label:"Black Book", kind:"extract"},
    {id:"summary", label:"Appraisal summary", kind:"extract"},
    {id:"compset", label:"Competitive set", kind:"extract"}
  ],
  MAIL_HOST: "https://gnm-guest-mailer-shawn-6802.vercel.app",
  SHAWN_COPY: "shawn@myloan.ca",
  staffEmail: function (v) { return String(v || "").trim().toLowerCase(); },
  uniqEmails: function (list) {
    const out = [];
    (Array.isArray(list) ? list : String(list || "").split(/[,\s]+/)).forEach(function (e) {
      const v = String(e || "").trim().toLowerCase();
      if (v && out.indexOf(v) < 0) out.push(v);
    });
    return out;
  },
  unitLabel: function () { return ""; },
  normalizeTeams: function (v) {
    if (Array.isArray(v)) return v;
    return v ? [v] : [];
  },
  personTeams: function () { return []; },
  loadRoster: function () {
    return [
      {email:"kyle@myloan.ca", leader:true, teams:["Team Retail"], name:"Kyle"},
      {email:"lord.grande@myloan.ca", leader:true, teams:["Team Retail","Team House"], name:"Lord Grande"},
      {email:"tushar.gupta@myloan.ca", leader:true, teams:["Team Evo"], name:"Tushar Gupta"},
      {email:"ernest@myloan.ca", leader:true, teams:["Team Flash"], name:"Ernest"},
      {email:"elias.abdi@myloan.ca", leader:true, teams:["Team Flash"], name:"Elias Abdi"},
      {email:"jay.cyr@myloan.ca", leader:false, teams:["Team Retail"], name:"Jay Cyr"}
    ];
  },
  timedFetch: function (url, req) {
    posts.push({url: url, body: JSON.parse(req.body)});
    return Promise.resolve({ok: true});
  },
  fetch: function () { throw new Error("raw fetch should not be used when timedFetch exists"); }
};
vm.createContext(sandbox);
vm.runInContext(block, sandbox);

const retail = sandbox.leadersForDeskTeam("Team Retail");
assert.deepEqual(retail.slice().sort(), ["kyle@myloan.ca", "lord.grande@myloan.ca"], "Retail leaders are Kyle + Lord");
assert.deepEqual(sandbox.leadersForDeskTeam("House").slice().sort(), ["lord.grande@myloan.ca"], "House leader is Lord");
assert.deepEqual(sandbox.leadersForDeskTeam("Team Evo"), ["tushar.gupta@myloan.ca"], "Evo leader is Tushar");
assert.deepEqual(sandbox.leadersForDeskTeam("Flash").slice().sort(), ["elias.abdi@myloan.ca", "ernest@myloan.ca"], "Flash leaders are PR #8 Ernest + Elias");

const incomplete = {
  id: "c-inc-1",
  ymmt: "2021 Honda Civic",
  vin: "2HGFC2F59MH123456",
  appNo: "A-1001",
  salesperson: "Jay Cyr",
  salespersonEmail: "jay.cyr@myloan.ca",
  deskTeam: "Team Retail",
  incomplete: true,
  lane: "leader",
  missing: ["Ownership", "Carfax"],
  docs: {carfax: {have: false}}
};
assert.strictEqual(sandbox.isIncompleteLeaderLane(incomplete), true, "incomplete + leader lane is open");
assert.strictEqual(sandbox.isOnsiteAttention(incomplete), false, "leader-lane file is not an on-site Shawn job");

const openInc = sandbox.remindPayload("open", "incomplete", incomplete);
assert.strictEqual(openInc.action, "open");
assert.strictEqual(openInc.kind, "incomplete");
assert.strictEqual(openInc.id, "c-inc-1");
assert.strictEqual(openInc.unit, "2021 Honda Civic");
assert.strictEqual(openInc.vin, "2HGFC2F59MH123456");
assert.strictEqual(openInc.appNo, "A-1001");
assert.strictEqual(openInc.salespersonEmail, "jay.cyr@myloan.ca");
assert.strictEqual(openInc.salespersonName, "Jay Cyr");
assert.strictEqual(openInc.team, "Team Retail");
assert.deepEqual(openInc.missing, ["Ownership", "Carfax"]);
assert.ok(openInc.details.indexOf("Jay Cyr") >= 0, "details name the salesperson");
assert.ok(openInc.details.indexOf("Ownership") >= 0, "details list missing docs");
assert.deepEqual(openInc.toEmail.split(",").sort(), ["kyle@myloan.ca", "lord.grande@myloan.ca"], "incomplete To is Retail leaders");
assert.notStrictEqual(openInc.toEmail.indexOf("shawn@myloan.ca"), 0, "incomplete does not target Shawn as the only To");

const onsite = {
  id: "c-on-1",
  ymmt: "2023 Toyota GR Corolla",
  vin: "JTND4MBE5P0123456",
  appNo: "A-1002",
  salesperson: "Tushar Gupta",
  requestedBy: "tushar.gupta@myloan.ca",
  deskTeam: "Team Evo",
  lane: "onsite",
  stage: "Waiting"
};
assert.strictEqual(sandbox.isOnsiteAttention(onsite), true, "on-site Waiting needs Shawn");
const openOn = sandbox.remindPayload("open", "onsite", onsite);
assert.strictEqual(openOn.kind, "onsite");
assert.strictEqual(openOn.toEmail, "shawn@myloan.ca", "on-site To is Shawn only");
assert.strictEqual(openOn.team, "Team Evo");

const guestSend = {id:"c-guest", lane:"inbox", stage:"Waiting", source:"guest", sent:true};
assert.strictEqual(sandbox.isIncompleteLeaderLane(guestSend), false, "normal Incoming send is not incomplete");
assert.strictEqual(sandbox.isOnsiteAttention(guestSend), false, "Incoming send is not on-site attention");

const staffSend = {id:"c-staff", lane:"inbox", stage:"Waiting", source:"appraise"};
assert.strictEqual(sandbox.isIncompleteLeaderLane(staffSend), false, "silent staff Send to Incoming is not a reminder");
assert.strictEqual(sandbox.isOnsiteAttention(staffSend), false, "Incoming staff Send is not on-site");

sandbox.syncFileReminders(incomplete, {incomplete:false, onsite:false});
sandbox.syncFileReminders(incomplete, sandbox.remindSnapshot(incomplete));
sandbox.syncFileReminders(Object.assign({}, incomplete, {incomplete:false, lane:"inbox", promoted:true}), sandbox.remindSnapshot(incomplete));
sandbox.syncFileReminders(onsite, {incomplete:false, onsite:false});
sandbox.syncFileReminders(onsite, sandbox.remindSnapshot(onsite));
sandbox.syncFileReminders(Object.assign({}, onsite, {stage:"Appraised", lane:"history"}), sandbox.remindSnapshot(onsite));
sandbox.syncFileReminders({id:"c-note", lane:"onsite", stage:"Waiting", notes:"typed"}, {incomplete:false, onsite:true});

assert.strictEqual(posts.length, 4, "only open/done transitions post — not note keystrokes or repeats");
assert.strictEqual(posts[0].url, "https://gnm-guest-mailer-shawn-6802.vercel.app/api/remind");
assert.strictEqual(posts[0].body.action, "open");
assert.strictEqual(posts[0].body.kind, "incomplete");
assert.strictEqual(posts[1].body.action, "done");
assert.strictEqual(posts[1].body.kind, "incomplete");
assert.strictEqual(posts[2].body.action, "open");
assert.strictEqual(posts[2].body.kind, "onsite");
assert.strictEqual(posts[2].body.toEmail, "shawn@myloan.ca");
assert.strictEqual(posts[3].body.action, "done");
assert.strictEqual(posts[3].body.kind, "onsite");

const flagged = {id:"x", lane:"inbox"};
sandbox.applyRemindExtra(flagged, {incomplete:true, lane:"leader", missing:["Carfax"]});
assert.strictEqual(flagged.incomplete, true, "passthrough keeps incomplete");
assert.strictEqual(flagged.lane, "leader", "passthrough keeps leader lane over inbox");
assert.deepEqual(flagged.missing, ["Carfax"]);

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("reminders: ok");
