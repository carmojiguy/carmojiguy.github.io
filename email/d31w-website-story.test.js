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
function sliceFn(name, next) {
  const start = html.indexOf("function " + name + "(");
  assert.ok(start > 0, name + " found");
  const end = next
    ? html.indexOf("\nfunction " + next + "(", start)
    : html.indexOf("\nfunction ", start + 10);
  assert.ok(end > start, name + " end found");
  return html.slice(start, end);
}

must(/id="buildStamp">build d31a</, "home footer stamp is d31w");
must(/<!--[\s\S]*build d31a[\s\S]*website-post story-first/, "header stamp is d31w website-post");
must(/<!--[\s\S]*build d31a[\s\S]*no team select/, "header stamp names no team select");
must(/<!--[\s\S]*build d31a[\s\S]*original start not webdesk/, "header stamp restores original start");
must(/<!--[\s\S]*build d31a[\s\S]*pictures still relaunch\/post/, "header stamp keeps relaunch/post");
must(/<!--[\s\S]*build d31a[\s\S]*Thank-you frozen/, "Thank-you stays frozen in the stamp");
must(/<!--[\s\S]*build d31a[\s\S]*no invented solds/, "no invented solds stays in the stamp");
must(/id="typeSheet"[\s\S]*build d31a/, "type sheet stamp is d31w");

must(/id="startWebsite">Post vehicle to website</, "start pill label stays");
must(/id="storySheet"/, "What's the Story sheet stays");
must(/id="storyTitle">What's the Story\?</, "story sheet title stays");

const startPost = sliceFn("startWebsitePost", "tradeInviteUrl");
assert.ok(startPost.indexOf("setPurpose(\"website\")") >= 0, "original start sets website purpose");
assert.ok(startPost.indexOf("show(\"home\")") >= 0, "original start opens home, not a new desk");
assert.ok(startPost.indexOf("openStoryMic()") >= 0, "story sheet pops first");
assert.ok(startPost.indexOf("openWebdesk") < 0, "website post does not open the webdesk start");
assert.ok(startPost.indexOf("openDeskTeam") < 0, "website post does not open team select");
assert.ok(startPost.indexOf("openDealType") < 0, "website post does not open appraisal type");
assert.ok(startPost.indexOf("paintDeskTeam") < 0, "website post skips team paint");
assert.ok(/show\("home"\)[\s\S]*openStoryMic\(\)/.test(startPost), "home then story — story is first overlay");

must(/\$\("startWebsite"\)\.onclick = function\(\)\{ startWebsitePost\(\); \}/, "Post vehicle to website uses original start");
mustNot(/\$\("startWebsite"\)\.onclick = function\(\)\{ openWebdesk\(\); \}/, "start Website no longer lands on the photo desk");

must(/if\(\$\("teamWrap"\)\) \$\("teamWrap"\)\.classList\.toggle\("hide", web\)/, "applyMode hides team wrap on website");
must(/if\(\$\("teamWrap"\)\) \$\("teamWrap"\)\.classList\.toggle\("hide", guest \|\| isWeb\(\)\)/, "applyRole hides team wrap on website");
must(/if\(\$\("typeWrap"\)\) \$\("typeWrap"\)\.classList\.toggle\("hide", web\)/, "website still skips appraisal type");

const storyMicStart = html.indexOf("function openStoryMic(");
const storyMicEnd = html.indexOf("if($(\"startStory\")", storyMicStart);
assert.ok(storyMicStart > 0 && storyMicEnd > storyMicStart, "openStoryMic block found");
const storyMic = html.slice(storyMicStart, storyMicEnd);
assert.ok(storyMic.indexOf("isWeb()") >= 0, "story sheet has a website-specific prompt");
assert.ok(storyMic.indexOf("year, make, model, trim, and condition of the vehicle") >= 0, "website story is year/make/model/trim/condition");
assert.ok(storyMic.indexOf("What's the Story?") >= 0, "sheet title stays What's the Story?");

const storyHelp = sliceFn("paintStoryHelp", "paintWebsitePhotosChrome");
assert.ok(storyHelp.indexOf("Say the year, make, model, trim, and condition of the vehicle.") >= 0, "home story help matches website story");
assert.ok(storyHelp.indexOf("(ca || web ? \"\"") >= 0, "website story skips ownership/VIN paragraph");

must(/if\(isWeb\(\) && APP\.role!=="guest" && window\.WebStudio\)\{ WebStudio\.open\("studio"\); return; \}/, "pictures still relaunch/post through WebStudio");
must(/\$\("btnSend"\)\.textContent = guest \? "Review my trade" : \(isWeb\(\) \? "Retouch & post" : "Send"\)/, "website photos keep Retouch & post");
must(/id="btnSendAsIs">Send</, "website photos have a Send as-is choice");
must(/\$\("btnSendAsIs"\)\.classList\.toggle\("hide", !web \|\| guest\)/, "Send as-is is website staff only");
must(/async function sendWebsitePacket\(/, "website send has its own packet helper");
must(/\$\("btnSendAsIs"\)\.onclick = function\(\)\{[\s\S]*sendWebsitePacket\(\);/, "Send as-is fires the website packet");

const sendWeb = sliceFn("sendWebsitePacket", "applyMode");
assert.ok(sendWeb.indexOf('disp:"attachment"') >= 0, "website JPEGs are attachments");
assert.ok(sendWeb.indexOf('mime:"image/jpeg"') >= 0, "website send attaches JPEGs");
assert.ok(sendWeb.indexOf('mime:"application/pdf"') >= 0, "website send attaches the listing PDF");
assert.ok(sendWeb.indexOf("buildPdf()") >= 0, "website PDF reuses the listing builder");
assert.ok(sendWeb.indexOf("websiteCopy()") >= 0, "packet body includes the retail description");
assert.ok(sendWeb.indexOf("capturedFiles()") >= 0, "one file per photo in the set");
assert.ok(sendWeb.indexOf("sendFromMe(") >= 0, "website send uses the existing mailer");
assert.ok(sendWeb.indexOf("finishGuest()") >= 0, "website send still lands on frozen Thank-you");
assert.ok(sendWeb.indexOf("cid:") < 0, "website JPEGs are not CID-inline");
assert.ok(sendWeb.indexOf("sharePacket") < 0, "website send does not rewrite sharePacket");

must(/function openWebdesk\(/, "website History desk stays for later");
must(/id="webStudio"/, "relaunch studio screen stays");
must(/id="wsPost">Post to website</, "studio still posts");

const startAppraise = html.slice(html.indexOf("$(\"startAppraise\").onclick"), html.indexOf("if($(\"startCenter\")"));
assert.ok(startAppraise.indexOf("openDealType()") >= 0, "CA / Appraise start is untouched");
assert.ok(startAppraise.indexOf("startWebsitePost") < 0, "website helper is not wired into Appraise");
must(/id="startCenter"[\s\S]*Appraisal Center/, "Appraisal Center start pill stays");
must(/function runAppraisalTeam\(|id="centerRunTeam"|Run Appraisal Team/, "Run Appraisal Team stays");

must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you Send stays frozen");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");

console.log("d31w-website-story: ok");
