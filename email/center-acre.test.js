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

must(/id="startDock"/, "staff start has a bottom dock");
must(/id="startAppraise"/, "keeps Appraise vehicle");
must(/id="startCenter"/, "keeps Appraisal Center");
must(/id="startWebsite"/, "keeps Post vehicle to website");
must(/id="startTrade"/, "keeps Send trade-in link");
must(/id="startUsers"/, "keeps Users");
must(/#startAppraise, #startCenter, #startWebsite \{ top:auto/, "start pills are not mid-photo");
must(/class="start-dock"/, "start dock wrapper present");
must(/id="centerInboxBtn"/, "Incoming pop-out button id stays inbox");
must(/<b>Incoming<\/b>/, "Incoming pop-out button label");
must(/id="centerTitleNav">Incoming/, "Incoming sheet title");
must(/Incoming is clear/, "Incoming empty state");
must(/They leave Incoming and On-site/, "archive help uses Incoming");
must(/inbox:"Incoming"/, "lane label maps inbox to Incoming");
must(/Open <b>Incoming<\/b>/, "empty desk mentions Incoming");
mustNot(/>Inbox</, "no customer-facing Inbox label");
mustNot(/Inbox is clear/, "no Inbox empty state");
mustNot(/Open <b>Inbox<\/b>/, "desk copy no longer says Inbox");
mustNot(/They leave Inbox and On-site/, "archive help no longer says Inbox");
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
must(/sample-v5-tucson/, "Incoming sample Tucson interest");
must(/Maya Patel/, "Incoming sample customer name");
must(/\(613\) 555-0142/, "Incoming sample customer phone");
must(/Jay Cyr/, "Incoming sample salesperson");
must(/2025 Hyundai Tucson Preferred/, "Incoming sample interest vehicle");
must(/sample-v5-corolla/, "on-site sample GR Corolla");
must(/sample-v5-wrangler/, "history archive sample Wrangler");
must(/lane:"inbox"/, "samples tagged inbox");
must(/lane:"onsite"/, "samples tagged on-site");
must(/CENTER_SAMPLE_VER="acre5"/, "sample version acre5");
must(/function finishSample\(/, "samples are finished packets");
must(/function sampleDocs\(/, "sample market docs");
must(/blackbook/, "Black Book doc slot");
must(/photoCount=photos\.length/, "samples get a full walk");
mustNot(/photoCount:0/, "no empty sample photo counts");
must(/@media \(min-width:768px\)/, "tablet breakpoint");
must(/@media \(min-width:1200px\)/, "desktop breakpoint");
must(/centerSplitLayout/, "tablet/desktop keep list+detail");
must(/id="resumeContinue">Continue</, "guest resume Continue");
must(/id="resumeFresh">Start over</, "guest resume Start over");
must(/function tradeLinkId\(/, "same trade-in link has a stable draft id");
must(/function loadDraftSnap\(/, "guest draft restore");
must(/function liveJobProgress\(/, "invite-link fields are not treated as progress");
must(/saveDraftLocal/, "guest progress has a local fallback");
must(/function revealMail\(\)\{/, "staff sharePacket still has revealMail");
must(/let sentOk=false/, "sharePacket still tracks sentOk");
must(/else if\(!sentOk\) revealMail\(\);/, "failed staff send still reveals mail");
must(/function hideMailOpen\(\)\{/, "guest path can hide #mailOpen");
must(/Couldn’t send — try again/, "guest fail is retry");
mustNot(/Open Mail and send/, "guests never see Open Mail and send");
must(/PAGE=\[250,249,252\]/, "sales-grade bright PDF cover");
must(/item\.interest=APP\.inviteUnit/, "trade-in persist interest vehicle");
must(/item\.salesperson=/, "persist salesperson on center files");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("center-acre: ok");
