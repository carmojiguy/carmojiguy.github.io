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

const emails = [
  "adam@myloan.ca","alex.rubeii@myloan.ca","andrew@myloan.ca","cliff@myloan.ca",
  "david.m@myloan.ca","ernest@myloan.ca","eugene@myloan.ca","hugh@myloan.ca",
  "isabella.coffey@myloan.ca","jason.sarac@myloan.ca","jay.cyr@myloan.ca",
  "jay.jokisch@myloan.ca","joseph.mctag@myloan.ca","kyle@myloan.ca",
  "lord.grande@myloan.ca","nathan.aborameh@myloan.ca","nathan.rutter@myloan.ca",
  "nick.bowley@myloan.ca","osato.om@myloan.ca","phil.frederic@myloan.ca",
  "puncham.girdhar@myloan.ca","sharan.harrison@myloan.ca","shayne.upper@myloan.ca",
  "tony.wiebe@myloan.ca","tushar.gupta@myloan.ca","shawn@myloan.ca","elias.abdi@myloan.ca"
];
emails.forEach(function (e) {
  must(new RegExp(e.replace(/\./g, "\\.")), "seeds " + e);
});

must(/id="userFilters"/, "team filter chips");
must(/id="userSheet"/, "person detail sheet");
must(/id="ud-role"/, "Salesperson / Team Leader toggle");
must(/id="ud-perms"/, "section toggles on person detail");
must(/id="ud-teams"/, "multi-team membership");
must(/ALWAYS_ON_PERMS=\["trade","website"\]/, "trade and website stay always on");
must(/function canOpenUsers\(/, "team leaders can open Users");
must(/key==="ca" && !isShawnActor\(\)/, "non-Shawn cannot write CA");
must(/id="btnDeskTeam"/, "create flow Team button");
must(/DESK_TEAMS=\[/, "desk team list");
must(/"Team Trucktown Richmond"/, "Users + Appraise list Team Trucktown Richmond");
must(/"Team Trucktown Smith Falls"/, "Users + Appraise list Team Trucktown Smith Falls");
must(/"Team Trucktown Rockland"/, "Users + Appraise list Team Trucktown Rockland");
must(/e\.endsWith\("@myloan\.ca"\)/, "Google allowlist still trusts @myloan.ca");
must(/function sharePacket\(\)|async function sharePacket\(\)/, "packet send stays");
mustNot(/ACCESS_LEVELS\s*=/, "rank list is gone");
mustNot(/access === "Viewer"|access==="Manager"/, "no rank comparisons");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("users-teams: ok");
