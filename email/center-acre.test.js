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

must(/id="startDock"/, "staff start has a bottom dock");
must(/id="startAppraise"/, "keeps Appraise vehicle");
must(/id="startCenter"/, "keeps Appraisal Center");
must(/id="startWebsite"/, "keeps Post vehicle to website");
must(/id="startTrade"/, "keeps Send trade-in link");
must(/id="startUsers"/, "keeps Users");
must(/#startAppraise, #startCenter, #startWebsite \{ top:auto/, "start pills are not mid-photo");
must(/class="start-dock"/, "start dock wrapper present");
must(/id="centerInboxBtn"/, "Inbox pop-out button");
must(/id="centerOnsiteBtn"/, "On-site pop-out button");
must(/id="centerHistoryBtn"/, "History pop-out button");
must(/One car at a time/, "empty desk copy");
must(/90-day archive/, "90-day archive is visible");
must(/data-range="today"/, "DATE-RANGE-001 Today");
must(/data-range="yesterday"/, "DATE-RANGE-001 Yesterday");
must(/data-range="month"/, "DATE-RANGE-001 This month");
must(/data-range="lastMonth"/, "DATE-RANGE-001 Last month");
must(/data-range="calendar"/, "DATE-RANGE-001 Calendar");
must(/Shabot/, "team rail includes Shabot");
must(/Rybot/, "team rail includes Rybot");
must(/Webot/, "team rail includes Webot");
must(/Drebot/, "team rail includes Drebot");
must(/TBot/, "team rail includes TBot");
must(/placeholder="MIN"/, "team MIN slot");
must(/placeholder="TARGET"/, "team TARGET slot");
must(/placeholder="MAX"/, "team MAX slot");
must(/sample-v4-tucson/, "inbox sample Tucson interest");
must(/Maya Patel/, "inbox sample customer name");
must(/\(613\) 555-0142/, "inbox sample customer phone");
must(/Jay Cyr/, "inbox sample salesperson");
must(/2025 Hyundai Tucson Preferred/, "inbox sample interest vehicle");
must(/sample-v4-corolla/, "on-site sample GR Corolla");
must(/sample-v4-wrangler/, "history archive sample Wrangler");
must(/lane:"inbox"/, "samples tagged inbox");
must(/lane:"onsite"/, "samples tagged on-site");
must(/CENTER_SAMPLE_VER/, "sample versioning");
must(/function revealMail\(\)\{/, "sharePacket still has revealMail");
must(/let sentOk=false/, "sharePacket still tracks sentOk");
must(/if\(!sentOk\) revealMail\(\);/, "failed send still reveals mail");
must(/PAGE=\[250,249,252\]/, "sales-grade bright PDF cover");
must(/item\.interest=APP\.inviteUnit/, "trade-in persist interest vehicle");
must(/item\.salesperson=/, "persist salesperson on center files");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("center-acre: ok");
