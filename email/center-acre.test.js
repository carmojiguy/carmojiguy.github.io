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
must(/#start:has\(#startDock:not\(\.hide\)\) \.start-bg/, "staff start photo ends above the thumb dock");
must(/z-index:24/, "start thumb dock sits above the hero");
must(/rel="apple-touch-icon"/, "apple-touch-icon linked");
must(/rel="manifest"/, "web app manifest linked");
must(/apple-mobile-web-app-title" content="Appraisal Center"/, "iOS home-screen name");
must(/<title>Appraisal Center<\/title>/, "document title");
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
must(/CENTER_SAMPLE_VER="acre7"/, "sample version acre7");
must(/function finishSample\(/, "samples are finished packets");
must(/function sampleDocs\(/, "sample market docs");
must(/blackbook/, "Black Book doc slot");
must(/photoCount=photos\.length/, "samples get a full walk");
mustNot(/photoCount:0/, "no empty sample photo counts");
must(/function orderCenterPhotos\(/, "Center photos follow walk-around order");
must(/VIEWS\.slice\(0, urls\.length\)/, "sample walks use the same VIEWS order");
must(/"Walk-around "\+\(step\+1\)\+" of "/, "guest camera nudges walk-around order");
must(/id="walkOrderNote"/, "guest photo list explains walk order");
must(/id="centerGallery"/, "full-screen Center gallery");
must(/function toggleCenterGallery\(/, "double-tap opens and closes gallery");
must(/function bindCenterPhotoGestures\(/, "swipe between walk photos");
must(/@media \(min-width:768px\)/, "tablet breakpoint");
must(/@media \(min-width:1200px\)/, "desktop breakpoint");
must(/centerSplitLayout/, "tablet/desktop keep list+detail");
must(/id="resumeContinue">Continue</, "guest resume Continue");
must(/id="resumeFresh">Start over</, "guest resume Start over");
must(/function offerResume\(\)\{\s*if\(APP\.role!=="guest"\) return;/, "staff start never hides dock behind resume");
must(/function tradeLinkId\(/, "same trade-in link has a stable draft id");
must(/function loadDraftSnap\(/, "guest draft restore");
must(/function liveJobProgress\(/, "invite-link fields are not treated as progress");
must(/saveDraftLocal/, "guest progress has a local fallback");
must(/function revealMail\(\)\{/, "staff sharePacket still has revealMail");
must(/let sentOk=false/, "sharePacket still tracks sentOk");
must(/else if\(!sentOk\) revealMail\(\);/, "failed staff send still reveals mail after retry");
must(/function hideMailOpen\(\)\{/, "guest path can hide #mailOpen");
must(/Couldn’t send — try again/, "guest fail is retry");
mustNot(/Open Mail and send/, "guests never see Open Mail and send");
must(/function landIncomingPacket\(/, "successful Send lands Incoming");
must(/item\.lane="inbox"/, "successful Send is Incoming not On-site");
must(/function packetSendId\(/, "Send has a stable packet id");
must(/function wasDelivered\(/, "double-tap Send is idempotent");
must(/if\(!\(sent && sent\.ok\)\) sent=await/, "mailer auto-retries once");
must(/function startStaffGoogle\(/, "staff login is one Google tap");
must(/Continue with Google/, "obvious Google button");
must(/SESSION_MS=30\*24\*60\*60\*1000/, "staff stay signed in 30 days");
must(/STAFF_DENY=/, "denied staff get one-sentence copy");
must(/LOGIN_SCOPES="openid email profile"/, "login does not ask for Gmail send");
must(/function packetSenderLine\(/, "email names who sent the packet");
must(/You’re offline\. Your work is saved/, "offline Send keeps the draft");
must(/function startDamageAudio\(/, "damage capture records spoken audio");
must(/function stopDamageAudio\(/, "damage audio stops on shutter");
must(/function damageCaptionLine\(/, "long speech gets a short tattoo line");
must(/id="viewerCapMore"/, "More expands the rest of the dialogue");
must(/id="viewerCapSheet"/, "long caption expands below the photo");
must(/view-cap-sheet/, "caption sheet sits under the photo");
must(/function openShotViewer\(/, "gallery and packet play the tied audio");
must(/function pushVoiceParts\(/, "Send attaches spoken damage audio");
must(/APP\.closeupAudio/, "employee close-ups keep the same voice note");
must(/tattooed on the bottom/, "guest and staff copy says the words are burned in");
mustNot(/if\(t\.length>80\) return false/, "long spoken notes still tattoo");
must(/PAGE=\[250,249,252\]/, "sales-grade bright PDF cover");
must(/item\.interest=APP\.inviteUnit/, "trade-in persist interest vehicle");
must(/item\.salesperson=/, "persist salesperson on center files");
must(/CHRISTINA_COPY="christina@carmoji.ca"/, "Christina Chase is on appraisal Send");
must(/function appraisalCc\(/, "appraisal Send builds a Christina CC");
must(/function isAppraisalSend\(/, "website-only posts skip Christina");
must(/cc:appraisalCc\(\)/, "guest catalog Send CCs Christina");
must(/cc:extra\.cc/, "store mailer payload keeps CC");
must(/\.docs-grid, \.center-docs, \.center-why-docs \{ display:grid; grid-template-columns:1fr 1fr/, "doc pills are two across on every screen");
mustNot(/\.docs-grid \{ grid-template-columns:repeat\(4/, "docs never go three or four across");
mustNot(/#center \.center-docs\{ grid-template-columns:repeat\(3/, "Center docs stay two across on tablet");
must(/min-height:168px/, "doc pills are bigger");
must(/function openTeamWhy\(/, "each bot has an openable thought-process doc");
must(/function teamWhyHtml\(/, "bot why docs include the thought process");
must(/id="centerWhyDocs"/, "decision docs sit on the Center desk");
must(/Open thought process/, "team cards open the why doc");
must(/id="centerApproval"/, "Shawn approval / buy number field");
must(/function buildApprovalPdf\(/, "Complete builds an approval PDF");
must(/function emailApprovalPacket\(/, "Complete emails the approval number");
must(/function isCenterAppraisal\(/, "Complete Christina CC is appraisals only");
must(/cc:\[CHRISTINA_COPY\]/, "approval email CCs Christina");
must(/function canUseCenter\(/, "Appraisal Center is allowlisted");
must(/CENTER_STAFF = \{/, "Center allowlist is explicit");
must(/"kyle@myloan.ca":"Kyle"/, "Kyle is on Center");
must(/"shane@myloan.ca":"Shane"/, "Shane uses the myloan.ca address");
must(/"ryan@papered.com":"Ryan"/, "Ryan stays on Center");
must(/"andrew@autocorp.ca":"Andrew"/, "Andrew stays on Center");
must(/"wes@thetrucktown.com":"Wes"/, "Wes stays on Center");
must(/CENTER_DENY=/, "denied staff get a plain-English Center lock");
must(/#startCenter\.locked/, "Center control is grayed out for everyone else");
must(/function isCanadaDrives\(/, "Canada Drives type is explicit");
must(/function requireCdApp\(/, "Canada Drives application number is required");
must(/function cdAppNumber\(/, "CD application number is read for PDF + email");
must(/CANADA DRIVES APPLICATION NUMBER/, "Send and Complete PDFs print the application number");
must(/id="cdWrap"/, "home shows the CD number field");
must(/id="centerCdWrap"/, "Center Complete shows the CD number field");
must(/classList\.toggle\("hide", !cd\)/, "CD field hides unless type is Canada Drives");
must(/Required\. This number goes on the PDF we email/, "plain-English required label");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
assert.equal(manifest.name, "Appraisal Center", "manifest name");
assert.ok(manifest.icons.some(function (i) { return i.purpose === "maskable" && i.sizes === "512x512"; }), "maskable 512 icon");
[
  "favicon.ico",
  "apple-touch-icon.png",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-192.png",
  "icons/icon-maskable-512.png",
  "icons/favicon-32.png"
].forEach(function (name) {
  assert.ok(fs.existsSync(path.join(root, name)), name + " exists");
});

console.log("center-acre: ok");
