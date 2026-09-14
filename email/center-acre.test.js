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
must(/ac-v3-apple-180\.png\?v=20260913c/, "apple-touch-icon uses cache-busted brand mark");
must(/ac-v3-192\.png\?v=20260913c/, "192 icon uses cache-busted brand mark");
must(/rel="apple-touch-icon-precomposed"/, "iOS precomposed touch icon linked");
must(/rel="manifest"/, "web app manifest linked");
must(/manifest\.webmanifest\?v=20260913c/, "manifest is cache-busted");
mustNot(/>Just Pictures</, "Just Pictures shortcut removed from Appraise home");
must(/function isLocateSoon\(/, "Locate Coming soon stays after icon rebase");
must(/Coming soon/, "Locate is marked Coming soon");
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
must(/function isCenterSample\(/, "Center can tell a coded sample from a real file");
must(/function seedCenterSamples\(/, "Center boot still calls the sample sweeper");
must(/return !isCenterSample\(x\)/, "sweeper drops leftover sample tiles");
mustNot(/function finishSample\(/, "no finished sample packets");
mustNot(/function centerSampleItems\(/, "no Center sample catalog");
mustNot(/function finishTradeWait\(/, "no waiting-on-customer sample trades");
mustNot(/CENTER_SAMPLE_VER/, "sample version stamp is gone");
mustNot(/sample-v5-/, "v5 sample ids are gone");
mustNot(/sample-v8-/, "v8 sample ids are gone");
mustNot(/Maya Patel/, "Incoming sample customer is gone");
mustNot(/2024 Honda Civic Sport/, "Honda smoke sample is gone");
must(/landingLaneForSend\(app, docs, false\)/, "shared slim uses landingLaneForSend");
mustNot(/function slimSharedCenterItem\([\s\S]*?lane:"inbox"/, "shared slim no longer hardcodes inbox");
must(/lane\|\|"onsite"/, "On-site remains a Center lane");
must(/blackbook/, "Black Book doc slot");
must(/photoCount=photos\.length/, "real Send still counts the walk");
must(/id="inviteHistBtn"/, "trade-in link has History");
must(/id="tradeWaitBtn"/, "trade-in waiting pop-out");
must(/id="usersHistBtn"/, "Users has History");
must(/id="usersHistJump"/, "Users History is a clear jump control");
must(/id="homeHistBtn"/, "Appraise home has History");
must(/id="homeHistJump"/, "Appraise History is a clear jump control");
must(/id="photosHistBtn"/, "Website photos / walk has History");
must(/id="wbHistBtn"/, "Consumer Acquisition has History");
must(/id="webdesk"/, "Website photos desk");
must(/id="centerNavHistBtn"/, "Center desk has History");
must(/id="centerLaneHistJump"/, "Incoming and On-site sheets jump to History");
must(/function sendTradeReminder\(/, "one-tap trade reminder");
must(/function tradeLinkStatus\(/, "Sent / Waiting / Completed");
must(/Waiting on customer/, "waiting-on-customer label");
must(/Reminder sent to/, "reminder never fails the Send toast");
must(/openWebdesk/, "start Website opens the photo desk");
must(/function orderCenterPhotos\(/, "Center photos follow walk-around order");
must(/function walkViewIndex\(/, "walk order uses the same VIEWS keys");
must(/"Walk-around "\+\(step\+1\)\+" of "/, "guest camera nudges walk-around order");
must(/id="walkOrderNote"/, "guest photo list explains walk order");
must(/id="centerGallery"/, "full-screen Center gallery");
must(/function toggleCenterGallery\(/, "double-tap opens and closes gallery");
must(/function bindCenterPhotoGestures\(/, "swipe between walk photos");
must(/@media \(min-width:768px\)/, "tablet breakpoint");
must(/@media \(min-width:1200px\)/, "desktop breakpoint");
must(/centerSplitLayout/, "tablet/desktop keep list+detail");
must(/id="resumeContinue">Continue abandoned session</, "resume Continue abandoned session");
must(/id="resumeFresh">Start a new one</, "resume Start a new one");
must(/function offerResume\(\)\{\s*if\(APP\._resumeOpen \|\| APP\._resumeAsked\) return;/, "abandoned chooser asks guest and staff");
mustNot(/function offerResume\(\)\{\s*if\(APP\.role!=="guest"\) return;/, "staff no longer skip the abandoned chooser");
must(/function tradeLinkId\(/, "same trade-in link has a stable draft id");
must(/function loadDraftSnap\(/, "guest draft restore");
must(/function liveJobProgress\(/, "invite-link fields are not treated as progress");
must(/saveDraftLocal/, "guest progress has a local fallback");
must(/function revealMail\(\)\{/, "sharePacket still has revealMail");
must(/let sentOk=false/, "sharePacket still tracks sentOk");
must(/hideMailOpen\(\);/, "failed Send hides #mailOpen instead of revealing Gmail");
mustNot(/else if\(!sentOk\) revealMail\(\);/, "staff fail no longer reveals Open Gmail");
must(/function hideMailOpen\(\)\{/, "Send path can hide #mailOpen");
must(/Couldn’t send — try again/, "fail is retry");
must(/sentOk=true;\s*finish\(""\);\s*try\{ finishGuest\(\); \}/, "staff and guest success reuse Thank you");
mustNot(/Open Mail and send/, "guests never see Open Mail and send");
mustNot(/Tap Open Gmail and send/, "staff Send never offers Open Gmail");
must(/function landIncomingPacket\(/, "successful Send lands Incoming");
must(/persistCenterMedia\([\s\S]{0,160}return item/, "Incoming row counts even if photo cache lags");
(function testSendDoesNotBlockOnCdApp() {
  const kick = html.slice(html.indexOf("function kickShare(){"), html.indexOf("\nfunction packetSendId("));
  const share = html.slice(html.indexOf("async function sharePacket(){"), html.indexOf("\nfunction resetAll()"));
  assert.ok(kick && share, "Send helpers extractable");
  assert.ok(!/requireCdApp/.test(kick), "kickShare does not block Send on CD app #");
  assert.ok(!/requireCdApp/.test(share), "sharePacket does not block Send on CD app #");
  assert.ok(/nagCdAppAfterSend\(\)/.test(share), "missing CD app # nags after Thank you");
})();
must(/function nagCdAppAfterSend\(/, "CD app # nag helper exists");
mustNot(/\/api\/send/, "packet Send never posts /api/send");
must(/item\.lane="inbox"/, "trade-in invite stubs still land Incoming");
must(/item\.lane=want==="inbox"\?"inbox":"onsite"/, "complete Send lands On-site, not Incoming");
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
must(/function pushVoiceParts\(/, "Send still has pushVoiceParts");
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
must(/function needsAppraiseType\(/, "Appraise form waits for a type");
must(/function requireAppraiseType\(/, "Appraise actions check type first");
must(/function paintAppraiseGate\(/, "Story, pictures, docs, and VIN gray until type");
must(/id="typeGateNote"/, "plain-English type-first note on the Appraise form");
must(/classList\.toggle\("home-gate", !!\(lock && !pending\)\)/, "gated Appraise actions are grayed unless the create form is showing");
must(/id="home"[\s\S]*id="newAppWrap"[\s\S]*id="storyBlock"/, "New application form sits on the HOME Appraise desk");
mustNot(/id="workbench"[\s\S]*id="newAppWrap"/, "create form is not workbench-only after My Loan");
must(/id="buildStamp">build d30s</, "home footer has a visible build stamp");
must(/id="typeSheet"[\s\S]*build d30s/, "type sheet hint includes the build stamp");
must(/id="exitChrome"/, "global Close/Back/Home chrome sits above every sheet");
must(/id="exitClose"/, "visible Close X is always on the exit chrome");
must(/id="exitBack"/, "Back is on the exit chrome");
must(/id="exitHome"/, "Home is on the exit chrome");
must(/function pageClose\(/, "shared Close leaves the open appraisal or sheet");
must(/function pageBack\(/, "shared Back is one step");
must(/function pageHome\(/, "shared Home returns to the start hub");
must(/function dismissOpenLayer\(/, "top overlay closes before the page");
must(/function closeNamedSheet\(/, "named sheets share one closer");
must(/e\.target===sheet/, "backdrop tap closes the open sheet");
must(/z-index:200/, "exit chrome sits above type/story/vin sheets");
must(/\.exit-x/, "Close X is the bright 56px target");
must(/\$\("homeX"\)\.onclick = pageClose/, "Appraise desk X uses the shared closer");
must(/\$\("photosX"\)\.onclick = pageClose/, "photos X uses the shared closer");
must(/\$\("verifyBack"\)\.onclick = pageClose/, "confirm X uses the shared closer");
must(/\$\("wbBack"\)\.onclick = pageClose/, "workbench X uses the shared closer");
must(/\$\("camX"\)\.onclick = pageClose/, "camera X uses the shared closer");
must(/\$\("submitX"\)\.onclick = pageClose/, "packet X uses the shared closer");
must(/if\(wantsAppBack\(\)\) pageBack\(\)/, "device Back uses the shared closer");
must(/id="exitHome">Home/, "Home label is on the chrome");
must(/id="exitBack">Back/, "Back label is on the chrome");
must(/zero Center samples/, "build comment says zero samples");
must(/function shareIncomingBestEffort\(/, "completed Send posts slim Incoming to the mailer store");
must(/MAIL_HOST\+"\/api\/incoming"/, "Incoming share hits MAIL_HOST /api/incoming");
must(/kind:"land"/, "Incoming share posts kind:land");
must(/function mergeIncomingShared\(/, "Center merges shared Incoming");
must(/function scheduleIncomingPull\(/, "Center boot pulls shared Incoming");
must(/try\{ scheduleIncomingPull\(\); \}catch\(e\)\{\}/, "Incoming pull is best-effort on Center boot");
must(/hint\.shared/, "shared Incoming match does not use the open APP.centerId");
must(/item\.linkSent=false/, "shared Incoming leaves the invite stub");
must(/item\.source="guest"/, "shared Incoming becomes a guest appraisal");
must(/id="centerDetailClose"/, "vehicle detail has a visible close X");
must(/aria-label="Close vehicle"/, "detail X is labeled for tap");
must(/function closeCenterDetail\(/, "shared closer closes the vehicle");
must(/function closeCenterOverlay\(/, "backdrop uses the shared closer");
must(/function exitCenterChrome\(/, "Center X uses the shared closer");
must(/centerSheetDim"\)\.onclick = closeCenterOverlay/, "dim tap closes the open layer");
must(/addEventListener\("popstate"/, "device Back closes Center layers");
must(/center-has-detail/, "mobile detail is a sheet over the desk");
must(/center-close-x/, "close control is the bright X");
must(/rgba\(239,232,255/, "Center dim is a bright wash, not a dark trap");
must(/el\.classList\.toggle\("hide", hide\)/, "What's the Story / Type it in / documents / VIN hide until the file is created");
must(/data-new-app/, "home exposes pending New application state");
must(/function openNewApplicationDesk\(\)\{[\s\S]{0,500}show\("home"\)/, "picking My Loan opens the create form on home");
mustNot(/function openNewApplicationDesk\(\)\{[\s\S]{0,500}show\("workbench"\)/, "My Loan create form is not workbench-only");
must(/DEAL_TYPES = \["Trade-in","Locate","Consumer Acquisition"\]/, "Appraise types are Trade-in, Locate, Consumer Acquisition");
mustNot(/DEAL_TYPES = \[[^\]]*General acquisition/, "General acquisition is not a picker choice");
mustNot(/Appraisial/, "docs pill is Appraisal documents, not Appraisial");
must(/id="btnDocs">Appraisal documents</, "btnDocs live label is Appraisal documents");
must(/function isLocateSoon\(/, "Locate is a coming-soon type");
must(/Coming soon/, "Locate chip shows Coming soon");
must(/soon\?" soon":""/, "Locate chip is grayed");
must(/b\.disabled=!!soon/, "Locate chip is not clickable");
must(/p\.purpose==="website"\) return false/, "website photos stay off the Appraise type gate");
must(/startAppraise"\)\.onclick[\s\S]{0,900}openDealType\(\)/, "Appraise vehicle opens type before other actions");
must(/el\.disabled=!!lock/, "gated Appraise buttons are actually disabled");
must(/data-appraise-gate/, "Appraise form exposes the type-gate state");

(function testNeedsAppraiseType() {
  const m = html.match(/function needsAppraiseType\(job, staff\)\{[\s\S]*?\n\}/);
  assert.ok(m, "needsAppraiseType source is extractable");
  const needsAppraiseType = eval("(" + m[0].replace("function needsAppraiseType", "function") + ")");
  assert.strictEqual(needsAppraiseType({ purpose: "appraise", dealType: "" }, true), true, "staff Appraise with no type is gated");
  assert.strictEqual(needsAppraiseType({ purpose: "appraise", dealType: "Trade-in" }, true), false, "chosen type unlocks Appraise");
  assert.strictEqual(needsAppraiseType({ purpose: "website", dealType: "" }, true), false, "website path is not gated");
  assert.strictEqual(needsAppraiseType({ purpose: "appraise", dealType: "" }, false), false, "guests are not gated");
  assert.strictEqual(needsAppraiseType({ purpose: "appraise", dealType: "Locate" }, true), true, "Locate is coming soon and stays gated");
  assert.strictEqual(needsAppraiseType({ purpose: "appraise", dealType: "General acquisition" }, true), false, "existing General acquisition files still open");
  assert.strictEqual(needsAppraiseType({ purpose: "appraise", dealType: "Consumer Acquisition" }, true), false, "Consumer Acquisition is a valid type");
})();
must(/requirePerm\("trade"\)/, "Send trade-in link is a permission, not an Appraise type");
must(/requirePerm\("website"\)/, "Website photos stay on their own start-dock path");
mustNot(/startTrade[\s\S]{0,160}requireAppraiseType/, "trade-in link is not behind the appraisal-type gate");
mustNot(/DEAL_TYPES = \[[^\]]*Website/, "Website is not an Appraise type");
must(/id="apptWrap"/, "appointments picker sits on the Consumer Acquisition workbench");
must(/id="workbench"/, "Consumer Acquisition has its own workbench");
must(/LEAD_SOURCES = \[/, "lead sources are Canada Drives, My Loan, My Auto, Carla");
must(/id:"Carla"/, "Carla is a lead source");
must(/function paintPacketDocs\(/, "document pills share one painter");
must(/function openMarketSite\(/, "vAuto, OpenLane, and eBlock copy VIN and open");
must(/function extractFromUpload\(/, "uploads run the extract pipeline");
must(/function demoExtractFor\(/, "demo extract fills pills when live extract is not wired");
must(/\/api\/extract/, "live extract endpoint is documented");
must(/VIN copied · opening/, "launcher pills copy the VIN");
must(/openMarketSite\("vauto"/, "vAuto launcher copies VIN and opens Provision");
must(/openMarketSite\("openlane"/, "OpenLane launcher copies VIN and opens the site");
must(/openMarketSite\("eblock"/, "eBlock launcher copies VIN and opens the site");
mustNot(/function openOpenlane\(\)\{ openBrand/, "OpenLane is not the old brand-only opener");
mustNot(/function openEblock\(\)\{ openBrand/, "eBlock is not the old brand-only opener");
must(/id="docsList" class="docs-grid"/, "Trade-in photos use the shared 2-across docs grid");
must(/id="wbDocs" class="docs-grid"/, "CA workbench uses the shared 2-across docs grid");
must(/id="centerDocs"/, "Center detail uses the shared docs host");
must(/grid-template-columns:1fr 1fr/, "document pills stay two across");
must(/lockedFromAirtable/, "Airtable-prefilled fields stay locked from the story");
must(/Verbal description only|verbal description only/, "CA story is verbal only");
must(/data-appt-region="GTA"/, "appointments tab GTA");
must(/data-appt-region="Ottawa"/, "appointments tab Ottawa");
must(/id="apptDateBtn"/, "DATE-RANGE-001 Today is a dropdown button");
must(/id="apptDateMenu"/, "DATE-RANGE-001 Today opens a menu");
must(/id="apptTabs"[\s\S]*id="apptDates"/, "Today sits on the GTA/Ottawa row");
must(/data-appt-range="today"/, "DATE-RANGE-001 Today");
must(/data-appt-range="tomorrow"/, "DATE-RANGE-001 Tomorrow");
must(/data-appt-range="month"/, "DATE-RANGE-001 This month");
must(/data-appt-range="lastMonth"/, "DATE-RANGE-001 Last month");
must(/data-appt-range="calendar"/, "DATE-RANGE-001 Calendar");
mustNot(/function sampleAppointments\(/, "no sample appointment cars");
must(/function applyAppointment\(/, "tapping an appointment prefills Appraise");
must(/function loadAppointments\(/, "live Airtable path is explicit");
must(/path:"\/api\/appointments"/, "APPTS_AIRTABLE.path stays /api/appointments");
must(/\/api\/appointments/, "wire-live appointments endpoint");
must(/appfy57egeT1utqaI/, "Command Center base id is documented");
must(/tbl2QiJ40S6A7IzyR/, "Consumer Acquisitions table id is documented");
must(/selqqamHvfGvK4CmK/, "Appointment Booked stage id");
must(/selaCJ91ZmmGKF7i1/, "On-Site Visit stage id");
must(/function apptStageOf\(/, "API stage field maps booked vs on-site");
must(/sel90QtMNs2kN0MbE/, "Canada Drives source id");
must(/function needsAppraiseAppt\(/, "Canada Drives stays gated until an appointment is picked");
must(/function usesCaAppointments\(/, "appointments UI is Canada Drives only");
must(/src && src!=="Canada Drives"\) return false/, "My Loan / My Auto / Carla skip the appointment gate");
must(/function needsNewApplication\(/, "non–Canada Drives CA sources start a New application");
must(/function newAppDeskRedirect\(/, "photos/verify cannot skip the New application form on home");
must(/function completeNewApplication\(/, "New application creates the file and continues into Appraise");
must(/function openNewApplicationDesk\(/, "non-CD sources open the New application desk");
must(/function openCaSource\(/, "lead source routes CD to appointments and everyone else to New application");
must(/else openNewApplicationDesk\(\);/, "picking My Loan / My Auto / Carla opens the New application form immediately");
must(/if\(newAppDeskRedirect\(id\)\)/, "show() bounces photos/verify/workbench to the home create form");
must(/if\(id==="typeSheet" && typeof needsNewApplication==="function" && needsNewApplication\(\)\) openNewApplicationDesk\(\)/, "closing the type sheet with a pending New application opens the form");
must(/\$\("na-first"\)\.focus\(\)/, "New application focuses first name when the form opens");
must(/if\(\$\("newAppCta"\)\) \$\("newAppCta"\)\.classList\.add\("hide"\)/, "My Loan form is not behind a second New application tap");
must(/id="newAppForm"/, "New application is a real create form");
must(/id="newAppGo"/, "New application has a complete-and-continue button");
must(/Create application and continue/, "New application continue CTA is explicit");
must(/id="newAppCta"/, "non-CD sources get a big New application CTA");
must(/id="na-vin"/, "New application collects VIN");
must(/id="na-first"/, "New application collects customer name");
must(/upsertCenterFromApp\(\{source:"appraise"\}\)/, "completed New application lands as a real Center file");
(function testLoadAppointmentsLiveEmpty() {
  const m = html.match(/async function loadAppointments\(\)\{[\s\S]*?\n\}/);
  assert.ok(m, "loadAppointments source is extractable");
  assert.ok(/j\.ok && j\.live && Array\.isArray\(j\.items\)/.test(m[0]), "live true with empty items is still live");
  assert.ok(!/j\.items\.length/.test(m[0]), "empty live does not require items.length");
  assert.ok(!/sampleAppointments\s*\(/.test(m[0]), "loadAppointments does not call sampleAppointments");
  assert.ok(/return \[\]/.test(m[0]), "failed or not-live fetch returns an empty list");
  assert.ok(/const typed=String\(\(\$\("apptSearch"\)/.test(m[0]), "loadAppointments reads the typed app #");
  assert.ok(/if\(typed\) q \+= \(q \? "&" : "\?"\) \+ "q=" \+ encodeURIComponent\(typed\)/.test(m[0]), "typed app # is sent as q=");
  assert.ok(/if\(typed\)/.test(m[0]), "empty search omits q=");
})();
must(/full GTA \+ Ottawa Tracker sheets/, "app # search is tracker sheets, not Airtable-only");
must(/Not on the GTA or Ottawa Tracker/, "empty match copy names the tracker sheets");
must(/function queueLoadAppointments\(/, "app # search reloads appointments instead of only filtering");
must(/APP\.apptSearch=APP\.cdApp/, "home/wb/cd-app fields set the appointment search");
must(/if\(usesCaAppointments\(\)\) openAppointments\(\)/, "CD app fields open CA appointments");
must(/APP\.apptSearch=this\.value;[\s\S]{0,80}queueLoadAppointments\(\)/, "apptSearch input refetches with q=");
(function testUndatedAppointmentsStayOnToday() {
  function startOfDay(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return x.getTime();
  }
  function apptDayIso(off) {
    const n = new Date();
    const d = new Date(n.getFullYear(), n.getMonth(), n.getDate() + (off || 0));
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + m + "-" + day;
  }
  const boundsM = html.match(/function apptRangeBounds\(kind, fromVal, toVal\)\{[\s\S]*?\n\}/);
  const whenM = html.match(/function apptWhen\(row\)\{[\s\S]*?\n\}/);
  const filterM = html.match(/function filteredAppointments\(\)\{[\s\S]*?\n\}/);
  assert.ok(boundsM && whenM && filterM, "appointment date filter helpers extractable");
  const apptRangeBounds = eval("(" + boundsM[0].replace(/^function apptRangeBounds/, "function") + ")");
  const apptWhen = eval("(" + whenM[0].replace(/^function apptWhen/, "function") + ")");
  function $(id) { return { value: "" }; }
  var APP;
  const filteredAppointments = eval("(" + filterM[0].replace(/^function filteredAppointments/, "function") + ")");
  const items = [
    { id: "u", region: "GTA", source: "Canada Drives", date: "" },
    { id: "d", region: "GTA", source: "Canada Drives", date: apptDayIso(0) },
    { id: "t", region: "GTA", source: "Canada Drives", date: apptDayIso(1) },
    { id: "o", region: "Ottawa", source: "Canada Drives", date: "" }
  ];
  function ids(range) {
    APP = { apptRegion: "GTA", leadSource: "Canada Drives", apptRange: range, apptItems: items };
    return filteredAppointments().map(function (r) { return r.id; });
  }
  assert.ok(ids("today").indexOf("u") >= 0, "undated booked rows stay on Today");
  assert.ok(ids("month").indexOf("u") >= 0, "undated booked rows stay on This month");
  assert.ok(ids("tomorrow").indexOf("u") < 0, "undated booked rows leave Tomorrow");
  assert.ok(ids("lastMonth").indexOf("u") < 0, "undated booked rows leave Last month");
  assert.ok(ids("calendar").indexOf("u") < 0, "undated booked rows leave Calendar");
  assert.ok(ids("today").indexOf("d") >= 0, "dated today stays on Today");
  assert.ok(ids("today").indexOf("t") < 0, "tomorrow leaves Today");
  assert.ok(ids("today").indexOf("o") < 0, "region filter still drops Ottawa");
})();
(function testApptSearchFiltersLiveList() {
  const filterM = html.match(/function filteredAppointments\(\)\{[\s\S]*?\n\}/);
  const boundsM = html.match(/function apptRangeBounds\(kind, fromVal, toVal\)\{[\s\S]*?\n\}/);
  const whenM = html.match(/function apptWhen\(row\)\{[\s\S]*?\n\}/);
  assert.ok(filterM && boundsM && whenM, "search uses the live appointment filter");
  function startOfDay(d) {
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return x.getTime();
  }
  const apptRangeBounds = eval("(" + boundsM[0].replace(/^function apptRangeBounds/, "function") + ")");
  const apptWhen = eval("(" + whenM[0].replace(/^function apptWhen/, "function") + ")");
  var searchVal = "APP-4412";
  function $(id) { return { value: id === "apptSearch" ? searchVal : "" }; }
  var APP = {
    apptRegion: "GTA",
    leadSource: "Canada Drives",
    apptRange: "today",
    apptSearch: searchVal,
    apptItems: [
      { id: "hit", region: "Ottawa", source: "Canada Drives", date: "2019-01-01", appNo: "APP-4412" },
      { id: "miss", region: "GTA", source: "Canada Drives", date: "", appNo: "APP-9900" }
    ]
  };
  const filteredAppointments = eval("(" + filterM[0].replace(/^function filteredAppointments/, "function") + ")");
  const ids = filteredAppointments().map(function (r) { return r.id; });
  assert.deepStrictEqual(ids, ["hit"], "app # search finds the live row across region and date");
  searchVal = "4412";
  APP.apptSearch = "4412";
  assert.deepStrictEqual(filteredAppointments().map(function (r) { return r.id; }), ["hit"], "bare Canada Drives digits still match APP-");
  searchVal = "APP-0000";
  APP.apptSearch = "APP-0000";
  assert.deepStrictEqual(filteredAppointments(), [], "unknown app # is empty");
})();
const pending = [];
pending.push((function testLoadAppointmentsSendsQ() {
  const m = html.match(/async function loadAppointments\(\)\{[\s\S]*?\n\}/);
  assert.ok(m, "loadAppointments source is extractable for q=");
  const urls = [];
  const APP = { leadSource: "Canada Drives", apptSearch: "APP-0003200683", apptLive: false, apptLiveNote: "" };
  function usesCaAppointments() { return true; }
  function leadSpec() { return { id: "Canada Drives", airtable: "Canada Drives", sel: "" }; }
  function $(id) { return id === "apptSearch" ? { value: APP.apptSearch } : null; }
  function normalizeAppt(row) { return row; }
  const MAIL_HOST = "https://mailer.example";
  const APPTS_AIRTABLE = { path: "/api/appointments" };
  const highlander = {
    id: "ott-APP0003200683",
    appNo: "APP-0003200683",
    ymm: "2021 Toyota Highlander XLE",
    seller: "Anthony Princewill",
    date: "2026-02-28",
    region: "Ottawa",
    via: "ottawa-tracker"
  };
  async function fetch(url) {
    urls.push(url);
    return { ok: true, json: async function () { return { ok: true, live: true, items: [highlander] }; } };
  }
  const loadAppointments = eval("(" + m[0] + ")");
  return loadAppointments().then(function (items) {
    assert.strictEqual(urls[0], "https://mailer.example/api/appointments?source=Canada%20Drives&q=APP-0003200683", "search hits mailer q=");
    assert.strictEqual(items[0].ymm, "2021 Toyota Highlander XLE", "Ottawa Tracker Highlander is returned");
    APP.apptSearch = "APP-0006447774";
    urls.length = 0;
    return loadAppointments();
  }).then(function () {
    assert.strictEqual(urls[0], "https://mailer.example/api/appointments?source=Canada%20Drives&q=APP-0006447774", "GTA Tracker app # also hits mailer q=");
    APP.apptSearch = "";
    urls.length = 0;
    return loadAppointments();
  }).then(function () {
    assert.strictEqual(urls[0], "https://mailer.example/api/appointments?source=Canada%20Drives", "empty search stays on the slim booked list");
  });
})());
must(/function defaultPerms\(/, "named staff have default permission toggles");
must(/function canPerm\(/, "dock buttons read permission toggles");
must(/function setPerm\(/, "admin can flip permission toggles");
must(/inspect\.users/, "permissions persist on inspect.users");
must(/Send trade-in link · On|label:"Send trade-in link"/, "Users screen has Send trade-in link toggle");
must(/label:"Appraise"/, "Users screen has Appraise toggle");
must(/label:"Website photos"/, "Users screen has Website photos toggle");
must(/label:"Appraisal Center"/, "Users screen has Appraisal Center toggle");
must(/label:"Admin"/, "Users screen has Admin toggle");
mustNot(/label:"Pictures"/, "Users screen has no Pictures-only toggle");
mustNot(/Just Pictures/, "Appraise has no Just Pictures button");
mustNot(/id="btnPictures"/, "pictures-only Appraise path is gone");
mustNot(/id:"pictures"/, "no orphan pictures permission");
must(/id="apptSearch"/, "CA toolbar searches application number");
must(/id="apptNewApp"/, "CA toolbar has New application");
must(/id="apptTrackerGta"/, "GTA Tracker button");
must(/id="apptTrackerOttawa"/, "Ottawa Tracker button");
must(/TRACKER_GTA_URL="https:\/\/docs\.google\.com\/spreadsheets\/d\/1DXKFHK_k1cC_upbxzBIVTLbMKpOIv0u5MB2NbKq5XhM\/edit\?usp=sharing"/, "GTA Tracker is the MyCar.ca GTA sheet");
must(/TRACKER_OTTAWA_URL="https:\/\/docs\.google\.com\/spreadsheets\/d\/1QRmPSMX_-nksYs4ucJxZUfTQcvrMlfbnylJgTL0ckNU\/edit\?usp=sharing"/, "Ottawa Tracker is the MyCar.ca Ottawa sheet");
must(/function startNewApplication\(/, "empty search can start a new CA appraisal");
must(/target="_blank"/, "tracker buttons open a new tab");
must(/label:"Consumer Acquisition"/, "Users screen has Consumer Acquisition toggle");
must(/Only Shawn can grant Consumer Acquisition/, "CA grant is Shawn-only");
must(/id="btnDeskTeam"/, "appraisal create has a Team button");
must(/item\.deskTeam=APP\.deskTeam/, "appraisals persist the desk team");
must(/"Team Flash"/, "Team Flash exists");
must(/"Team Retail"/, "Team Retail exists");
must(/"Team Evo"/, "Team Evo exists");
must(/"Team ABC"/, "Team ABC exists");
must(/"Team Saskatchewan"/, "Team Saskatchewan exists");
must(/"Team Fire"/, "Team Fire exists");
must(/"Team House"/, "Team House exists");
must(/"Team Consumer Acquisition"/, "Team Consumer Acquisition exists");
must(/"Team Trucktown Richmond"/, "Team Trucktown Richmond exists");
must(/"Team Trucktown Smith Falls"/, "Team Trucktown Smith Falls exact spelling");
must(/"Team Trucktown Rockland"/, "Team Trucktown Rockland exists");
mustNot(/Team Trucktown Smiths Falls/, "Smith Falls is not Smiths Falls");
must(/elias\.abdi@myloan\.ca/, "Elias Abdi is on the roster");
must(/david\.m@myloan\.ca":"David Madrid"/, "David Madrid seed name");
must(/tushar\.gupta@myloan\.ca":\["Team Evo"\]/, "Tushar leads Team Evo");
must(/ernest@myloan\.ca":\["Team Flash"\]/, "Ernest leads Team Flash");
must(/tony\.wiebe@myloan\.ca":\["Team Saskatchewan"\]/, "Tony leads Team Saskatchewan");
must(/function isTeamLeader\(/, "Team Leader role exists");
must(/Salesperson/, "Salesperson role exists");
mustNot(/ACCESS_LEVELS/, "no Admin\/Manager\/Sales\/Viewer rank list");
must(/inbox:"Incoming"/, "Center lanes stay Incoming / On-site / History");

(function testNeedsAppraiseAppt() {
  const m = html.match(/function needsAppraiseAppt\(job, staff\)\{[\s\S]*?\n\}/);
  assert.ok(m, "needsAppraiseAppt source is extractable");
  const needsAppraiseType = function () { return false; };
  const needsLeadSource = function (job) {
    return job && job.dealType === "Consumer Acquisition" && !job.leadSource;
  };
  const isConsumerAcquisition = function (item) {
    const t = item ? item.dealType : "";
    return t === "Consumer Acquisition" || t === "Canada Drives";
  };
  const fn = m[0].replace("function needsAppraiseAppt", "function");
  const needsAppraiseAppt = eval("(" + fn + ")");
  assert.strictEqual(needsAppraiseAppt({ purpose: "appraise", dealType: "Consumer Acquisition", leadSource: "Canada Drives", apptId: "" }, true), true, "Canada Drives without appointment stays gated");
  assert.strictEqual(needsAppraiseAppt({ purpose: "appraise", dealType: "Consumer Acquisition", leadSource: "Canada Drives", apptId: "rec1" }, true), false, "picked appointment unlocks");
  assert.strictEqual(needsAppraiseAppt({ purpose: "appraise", dealType: "Consumer Acquisition", leadSource: "Canada Drives", apptId: "new", newApplication: true }, true), false, "Canada Drives new application unlocks");
  assert.strictEqual(needsAppraiseAppt({ purpose: "appraise", dealType: "Consumer Acquisition", leadSource: "Canada Drives", apptId: "", newApplication: true }, true), false, "Canada Drives New application unlocks appointments gate");
  assert.strictEqual(needsAppraiseAppt({ purpose: "appraise", dealType: "Consumer Acquisition", leadSource: "My Loan", apptId: "" }, true), false, "My Loan is new application only");
  assert.strictEqual(needsAppraiseAppt({ purpose: "appraise", dealType: "Consumer Acquisition", leadSource: "My Auto", apptId: "" }, true), false, "My Auto is new application only");
  assert.strictEqual(needsAppraiseAppt({ purpose: "appraise", dealType: "Consumer Acquisition", leadSource: "Carla", apptId: "" }, true), false, "Carla is new application only");
  assert.strictEqual(needsAppraiseAppt({ purpose: "appraise", dealType: "Trade-in", apptId: "" }, true), false, "Trade-in does not need an appointment");
  assert.strictEqual(needsAppraiseAppt({ purpose: "website", dealType: "Consumer Acquisition", leadSource: "Canada Drives", apptId: "" }, true), false, "website path skips appointments");
})();
(function testNeedsNewApplication() {
  const m = html.match(/function needsNewApplication\(job, staff\)\{[\s\S]*?\n\}/);
  assert.ok(m, "needsNewApplication source is extractable");
  const needsAppraiseType = function () { return false; };
  const needsLeadSource = function (job) {
    return job && job.dealType === "Consumer Acquisition" && !job.leadSource;
  };
  const isConsumerAcquisition = function (item) {
    const t = item ? item.dealType : "";
    return t === "Consumer Acquisition" || t === "Canada Drives";
  };
  const needsNewApplication = eval("(" + m[0].replace("function needsNewApplication", "function") + ")");
  assert.strictEqual(needsNewApplication({ purpose: "appraise", dealType: "Consumer Acquisition", leadSource: "My Loan" }, true), true, "My Loan stays gated until New application is created");
  assert.strictEqual(needsNewApplication({ purpose: "appraise", dealType: "Consumer Acquisition", leadSource: "My Auto" }, true), true, "My Auto stays gated until New application is created");
  assert.strictEqual(needsNewApplication({ purpose: "appraise", dealType: "Consumer Acquisition", leadSource: "Carla" }, true), true, "Carla stays gated until New application is created");
  assert.strictEqual(needsNewApplication({ purpose: "appraise", dealType: "Consumer Acquisition", leadSource: "My Loan", newApplication: true }, true), false, "completed New application unlocks Appraise");
  assert.strictEqual(needsNewApplication({ purpose: "appraise", dealType: "Consumer Acquisition", leadSource: "Canada Drives" }, true), false, "Canada Drives uses appointments, not the New application gate");
  assert.strictEqual(needsNewApplication({ purpose: "appraise", dealType: "Trade-in" }, true), false, "Trade-in does not need New application");
})();
(function testNewAppDeskRedirect() {
  const needsM = html.match(/function needsNewApplication\(job, staff\)\{[\s\S]*?\n\}/);
  const redirM = html.match(/function newAppDeskRedirect\(id, job, staff\)\{[\s\S]*?\n\}/);
  assert.ok(needsM && redirM, "newAppDeskRedirect source is extractable");
  const needsAppraiseType = function () { return false; };
  const needsLeadSource = function (job) {
    return job && job.dealType === "Consumer Acquisition" && !job.leadSource;
  };
  const isConsumerAcquisition = function (item) {
    const t = item ? item.dealType : "";
    return t === "Consumer Acquisition" || t === "Canada Drives";
  };
  const needsNewApplication = eval("(" + needsM[0].replace("function needsNewApplication", "function") + ")");
  const newAppDeskRedirect = eval("(" + redirM[0].replace("function newAppDeskRedirect", "function") + ")");
  ["My Loan", "My Auto", "Carla"].forEach(function (src) {
    const job = { purpose: "appraise", dealType: "Consumer Acquisition", leadSource: src };
    assert.strictEqual(newAppDeskRedirect("home", job, true), "", src + " stays on home so the create form is on the Appraise desk");
    assert.strictEqual(newAppDeskRedirect("start", job, true), "", src + " can leave to start");
    assert.strictEqual(newAppDeskRedirect("photos", job, true), "home", src + " cannot reach photos before New application");
    assert.strictEqual(newAppDeskRedirect("verify", job, true), "home", src + " cannot reach verify before New application");
    assert.strictEqual(newAppDeskRedirect("submit", job, true), "home", src + " cannot reach submit before New application");
    assert.strictEqual(newAppDeskRedirect("workbench", job, true), "home", src + " does not stay on workbench before create");
    assert.strictEqual(needsNewApplication(job, true), true, src + " still needs the Create application form");
  });
  assert.strictEqual(newAppDeskRedirect("home", { purpose: "appraise", dealType: "Consumer Acquisition", leadSource: "My Loan", newApplication: true }, true), "", "completed New application can open the Appraise desk");
  assert.strictEqual(newAppDeskRedirect("photos", { purpose: "appraise", dealType: "Consumer Acquisition", leadSource: "My Auto", newApplication: true }, true), "", "completed New application can reach photos");
  assert.strictEqual(newAppDeskRedirect("home", { purpose: "appraise", dealType: "Consumer Acquisition", leadSource: "Canada Drives" }, true), "", "Canada Drives is not bounced to New application");
  assert.strictEqual(newAppDeskRedirect("photos", { purpose: "appraise", dealType: "Trade-in" }, true), "", "Trade-in is not bounced to New application");
})();

(function testDefaultPerms() {
  const m = html.match(/function defaultPerms\(email\)\{[\s\S]*?\n\}/);
  assert.ok(m, "defaultPerms source is extractable");
  const shawnAlias = function (email) {
    return email === "shawn@gmautosales.ca" ? "shawn@myloan.ca" : email;
  };
  const allPermsOn = function () { return { trade: true, appraise: true, website: true, center: true, admin: true }; };
  const defaultPerms = eval("(" + m[0].replace("function defaultPerms", "function") + ")");
  assert.strictEqual(defaultPerms("shawn@myloan.ca").admin, true, "Shawn is admin");
  assert.strictEqual(defaultPerms("wes@thetrucktown.com").trade, true, "Wes has all dock buttons");
  assert.strictEqual(defaultPerms("ryan@papered.com").center, true, "Ryan keeps Center");
  assert.strictEqual(defaultPerms("ryan@papered.com").appraise, true, "Ryan keeps Appraise");
  assert.strictEqual(defaultPerms("someone@myloan.ca").center, false, "others start grayed");
})();

assert.ok(fs.existsSync(path.join(root, "api/appointments.js")), "appointments live-wire API exists");
assert.ok(fs.existsSync(path.join(root, "api/extract.js")), "document extract live-wire API exists");
assert.ok(fs.existsSync(path.join(root, "api/incoming.js")), "shared Incoming mailer endpoint exists");
(function testApptApiStages() {
  const api = require(path.join(root, "api/appointments.js"));
  assert.strictEqual(api.mapStage({ id: "selqqamHvfGvK4CmK", name: "Appointment Booked" }), "booked");
  assert.strictEqual(api.mapStage({ id: "selaCJ91ZmmGKF7i1", name: "On-Site Visit" }), "on-site");
  assert.strictEqual(api.mapStage("On-Site Visit"), "on-site");
  const f = api.formula("Canada Drives");
  assert.ok(f.indexOf("Appointment Booked") >= 0 && f.indexOf("On-Site Visit") >= 0, "formula includes both live stages");
  assert.strictEqual(api.formula("My Loan"), "", "My Loan has no appointment formula");
  assert.strictEqual(api.formula("Car Loans Canada"), "", "Carla / Car Loans Canada has no appointment formula");
  assert.strictEqual(api.usesAppointmentsSource("Canada Drives"), true, "Canada Drives uses appointments");
  assert.strictEqual(api.usesAppointmentsSource("My Auto"), false, "My Auto does not use appointments");
  const src = fs.readFileSync(path.join(root, "api/appointments.js"), "utf8");
  assert.ok(!/sample appointments/i.test(src), "API never mentions sample appointments");
})();
(function testNormalizeApptStage() {
  const stageM = html.match(/function apptStageOf\(v\)\{[\s\S]*?\n\}/);
  const normM = html.match(/function normalizeAppt\(row\)\{[\s\S]*?\n\}/);
  assert.ok(stageM && normM, "stage + normalize helpers extractable");
  function apptRegionOf(v) {
    const s = String(v || "").toUpperCase();
    if (s.indexOf("GTA") >= 0) return "GTA";
    if (s.indexOf("OTTAWA") >= 0) return "Ottawa";
    return "";
  }
  const apptStageOf = eval("(" + stageM[0].replace(/^function apptStageOf/, "function") + ")");
  const normalizeAppt = eval("(" + normM[0].replace(/^function normalizeAppt/, "function") + ")");
  assert.strictEqual(normalizeAppt({ id: "1", stage: "on-site" }).stage, "on-site");
  assert.strictEqual(normalizeAppt({ id: "2", stage: "booked" }).stage, "booked");
  assert.strictEqual(normalizeAppt({ id: "3" }).stage, "booked");
  assert.strictEqual(apptStageOf("On-Site Visit"), "on-site");
  const tracker = normalizeAppt({
    id: "ott-APP0003200683",
    appNo: "APP-0003200683",
    ymm: "2021 Toyota Highlander XLE",
    seller: "Anthony Princewill",
    date: "2026-02-28",
    region: "Ottawa",
    source: "Canada Drives",
    stage: "booked",
    via: "ottawa-tracker"
  });
  assert.strictEqual(tracker.seller, "Anthony Princewill", "tracker seller stays on the card");
  assert.strictEqual(tracker.ymm, "2021 Toyota Highlander XLE", "tracker ymm stays on the card");
  assert.strictEqual(tracker.date, "2026-02-28", "tracker date stays on the card");
  assert.strictEqual(tracker.region, "Ottawa", "tracker Ottawa stays on the card");
})();

must(/id="centerNeedsBtn"/, "Needs docs lane pill");
must(/<b>Needs docs<\/b>/, "Needs docs lane label");
must(/id="docsGate"/, "incomplete docs modal is a custom popup");
must(/Documents incomplete/, "modal title copy");
must(/Send to my team leader to complete/, "primary modal action");
must(/I’ll complete the docs first/, "secondary modal action");
must(/function needsMarketDocsGate\(/, "staff appraisal Send is gated");
must(/function landingLaneForSend\(/, "Send landing lane is explicit");
must(/function laneFromMarketDocs\(/, "shared pull recomputes lane from docs");
must(/function purgeDocsLaneDrift\(/, "leftover wrong lanes are purged on paint");
must(/function openDocsIncompleteModal\(/, "docs modal helper stays");
(function testKickShareNeverBlocksOnDocs() {
  const kickStart = html.indexOf("function kickShare(){");
  const kickEnd = html.indexOf("\nfunction packetSendId(", kickStart);
  assert.ok(kickStart > 0 && kickEnd > kickStart, "kickShare found");
  const kick = html.slice(kickStart, kickEnd);
  assert.ok(/sharePacket\(\);/.test(kick), "kickShare still sends");
  assert.ok(!/openDocsIncompleteModal\(/.test(kick), "kickShare must not open docsGate");
  assert.ok(!/needsMarketDocsGate\(/.test(kick), "kickShare must not return on incomplete docs");
})();
must(/function sendToTeamLeader\(/, "leader path is a named send");
must(/function promoteNeedsDocs\(/, "leader can promote a complete file");
must(/function notifyAppraisal\(/, "client posts durable nags to the mailer");
must(/\/api\/notify-appraisal/, "Pages hits the mailer notify endpoint");
must(/item\.lane="needsdocs"/, "incomplete Send is tagged needsdocs");
mustNot(/sample-v8-docs/, "Needs docs sample file is gone");
must(/function resolveTeamLeaders\(/, "Users roster supplies team leaders");
must(/id="ud-role"/, "Users screen has a Team Leader role");
must(/Team Leader/, "Users screen has a Team Leader toggle");
must(/Cell \(optional SMS\)/, "Users cell is optional — email nags do not need it");
must(/A cell is optional later for SMS/, "Users lead does not require a cell to ship nags");
mustNot(/window\.alert\(|\balert\(/, "docs gate never uses a native alert");

(function testMarketDocsGate() {
  const haveM = html.match(/function packetDocHave\(docs, spec\)\{[\s\S]*?\n\}/);
  const missM = html.match(/function missingMarketDocs\(docs\)\{[\s\S]*?\n\}/);
  const doneM = html.match(/function marketDocsComplete\(docs\)\{[\s\S]*?\n\}/);
  const gateM = html.match(/function needsMarketDocsGate\(app\)\{[\s\S]*?\n\}/);
  const landM = html.match(/function landingLaneForSend\(app, docs, leaderSend\)\{[\s\S]*?\n\}/);
  assert.ok(haveM && missM && doneM && gateM && landM, "market-docs helpers extractable");
  const reqM = html.match(/const MARKET_DOC_REQ=(\[[\s\S]*?\]);/);
  assert.ok(reqM, "MARKET_DOC_REQ extractable");
  const MARKET_DOC_REQ = eval("(" + reqM[1] + ")");
  assert.strictEqual(MARKET_DOC_REQ.length, 3, "completeness is the 3-pill desk");
  assert.strictEqual(MARKET_DOC_REQ[0].id, "vauto");
  assert.strictEqual(MARKET_DOC_REQ[1].id, "openlane");
  assert.strictEqual(MARKET_DOC_REQ[2].id, "eblock");
  const helpers = eval("(function(MARKET_DOC_REQ){\n" +
    haveM[0] + "\n" + missM[0] + "\n" + doneM[0] + "\n" + gateM[0] + "\n" + landM[0] + "\n" +
    "return {packetDocHave:packetDocHave, missingMarketDocs:missingMarketDocs, needsMarketDocsGate:needsMarketDocsGate, landingLaneForSend:landingLaneForSend};\n})(" + JSON.stringify(MARKET_DOC_REQ) + ")");
  const packetDocHave = helpers.packetDocHave;
  const missingMarketDocs = helpers.missingMarketDocs;
  const needsMarketDocsGate = helpers.needsMarketDocsGate;
  const landingLaneForSend = helpers.landingLaneForSend;
  assert.strictEqual(needsMarketDocsGate({ role:"guest", purpose:"appraise" }), false, "guest Send skips the gate");
  assert.strictEqual(needsMarketDocsGate({ role:"employee", purpose:"website" }), false, "website Send skips the gate");
  assert.strictEqual(needsMarketDocsGate({ role:"employee", purpose:"appraise" }), true, "staff appraisal Send is gated");
  const none = missingMarketDocs({});
  assert.ok(none.length >= 3, "empty packet is incomplete");
  const partial = missingMarketDocs({ summary:{have:true}, carfax:{have:true} });
  assert.ok(partial.length >= 1 && partial.length < none.length, "a portion present is incomplete");
  const full = {};
  MARKET_DOC_REQ.forEach(function (s) { full[s.id] = { have:true }; });
  assert.deepStrictEqual(missingMarketDocs(full), [], "full V Auto + OpenLane + eBlock pack is complete");
  assert.deepStrictEqual(missingMarketDocs({ vauto:{have:true}, openlane:{have:true}, eblock:{have:true} }), [], "3-pill flags are complete");
  assert.strictEqual(landingLaneForSend({ role:"guest" }, {}, false), "needsdocs", "guest Send without market docs lands Needs docs");
  assert.strictEqual(landingLaneForSend({ role:"employee", purpose:"website" }, {}, false), "inbox", "website still lands Incoming");
  assert.strictEqual(landingLaneForSend({ role:"employee", purpose:"appraise" }, { summary:{have:true} }, false), "needsdocs", "partial staff packet never enters the AI lane");
  assert.strictEqual(landingLaneForSend({ role:"employee", purpose:"appraise" }, full, false), "onsite", "complete staff packet lands On-site");
  assert.strictEqual(landingLaneForSend({ role:"guest" }, full, false), "onsite", "complete guest packet lands On-site");
  assert.strictEqual(landingLaneForSend({ role:"guest" }, { vauto:{have:true}, openlane:{have:true}, eblock:{have:true} }, false), "onsite", "3-pill guest lands On-site");
  assert.strictEqual(landingLaneForSend({ role:"employee", purpose:"appraise" }, {}, true), "needsdocs", "leader Send stays Needs docs");
  assert.ok(packetDocHave({ vauto:{have:true} }, MARKET_DOC_REQ[0]), "vauto pill counts as V Auto");
  assert.ok(packetDocHave({ vauto_summary:{have:true} }, MARKET_DOC_REQ[0]), "vAuto summary alias counts");
  assert.ok(packetDocHave({ vauto_docs:{have:true} }, MARKET_DOC_REQ[0]), "vauto_docs pack counts");
})();

must(/id="webStudio"/, "Website photos studio screen");
must(/data-ws-tab="history"/, "Website photos History tab");
must(/id="wsHistoryList"/, "History packages list");
must(/Damage stays\. Dirt goes\./, "damage-preserving retouch copy");
must(/web-studio\.js/, "studio engine is a separate file");
must(/id="webHistJump"/, "photos screen History jump");

(function testSeedPurgesSamplesKeepsRealIncoming() {
  const sampleM = html.match(/function isCenterSample\(item\)\{[\s\S]*?\n\}/);
  const seedM = html.match(/function seedCenterSamples\(\)\{[\s\S]*?\n\}/);
  assert.ok(sampleM && seedM, "sample sweeper extractable");
  let store = {
    seq: 1000,
    items: [
      { id: "sample-v5-civic", sample: true, lane: "onsite", ymmt: "2024 Honda Civic Sport" },
      { id: "sample-v8-wait-camry", sampleVer: "acre8", source: "trade-in", linkSent: true, ymmt: "2017 Toyota Camry SE" },
      {
        id: "guest-christine-blazer-20260913",
        source: "guest",
        lane: "inbox",
        vin: "3GNKBHRS0LS577461",
        ymmt: "2020 Chevrolet Blazer LT",
        customer: { name: "Christine Cyr" }
      },
      {
        id: "guest-chris-rav4-20260913",
        source: "guest",
        lane: "inbox",
        vin: "2T3B1RFVXRC466025",
        ymmt: "2024 Toyota RAV4",
        customer: { name: "Chris Cyr" }
      }
    ]
  };
  function centerStore() { return store; }
  function saveCenterStore(next) { store = next; }
  const isCenterSample = eval("(" + sampleM[0].replace("function isCenterSample", "function") + ")");
  const seedCenterSamples = eval("(" + seedM[0].replace("function seedCenterSamples", "function") + ")");
  seedCenterSamples();
  assert.deepStrictEqual(store.items.map(function (x) { return x.id; }), [
    "guest-christine-blazer-20260913",
    "guest-chris-rav4-20260913"
  ], "real Incoming files stay; coded samples leave");
  assert.strictEqual(isCenterSample({ id: "guest-christine-blazer-20260913" }), false, "real Blazer is not a sample");
  assert.strictEqual(isCenterSample({ id: "sample-v5-civic" }), true, "Honda smoke id is a sample");
})();

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
assert.equal(manifest.name, "Appraisal Center", "manifest name");
assert.ok(manifest.icons.some(function (i) { return i.purpose === "maskable" && i.sizes === "512x512"; }), "maskable 512 icon");
assert.ok(manifest.icons.every(function (i) { return /ac-v3-/.test(i.src) && /v=20260913c/.test(i.src); }), "manifest icons are the v3 brand set");
[
  "favicon.ico",
  "apple-touch-icon.png",
  "apple-touch-icon-precomposed.png",
  "apple-touch-icon-180x180.png",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-192.png",
  "icons/icon-maskable-512.png",
  "icons/favicon-32.png",
  "icons/ac-v3-192.png",
  "icons/ac-v3-512.png",
  "icons/ac-v3-apple-180.png",
  "icons/ac-v3-favicon-16.png",
  "icons/ac-v3-favicon-32.png",
  "icons/ac-v3-maskable-192.png",
  "icons/ac-v3-maskable-512.png",
  "icons/ac-v3-1024.png"
].forEach(function (name) {
  assert.ok(fs.existsSync(path.join(root, name)), name + " exists");
});

Promise.all(pending).then(function () {
  console.log("center-acre: ok");
}).catch(function (err) {
  console.error(err);
  process.exit(1);
});
