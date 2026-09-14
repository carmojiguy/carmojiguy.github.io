#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");
const vm = require("vm");

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
function sha(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

must(/id="buildStamp">build d31a</, "footer stamp stays d31a");
must(/<!--[\s\S]*build d31a[\s\S]*desktop walk-around drop-sort on the photos desk/, "header names desktop walk drop");
must(/id="typeSheet"[\s\S]*build d31a/, "type sheet stamp stays d31a");
must(/id="deskWalkHint"/, "desk drop hint exists");
must(/id="deskWalkFiles"/, "desk file picker exists");
must(/function deskWalkDropOn\(/, "desk drop gate exists");
must(/function walkHintFromName\(/, "filename hint mapper exists");
must(/function planDeskWalkDrop\(/, "auto-sort planner exists");
must(/function parseJpegExifDate\(/, "EXIF date reader exists");
must(/function applyDeskWalkFiles\(/, "drop apply exists");
must(/function persistDeskWalkPhotos\(/, "drop persist exists");
must(/function bindDeskWalkSlot\(/, "per-slot drop exists");
must(/function bindDeskWalkDrop\(/, "page drop exists");
must(/APP && APP\.role!=="guest"/, "desk drop is staff only");
must(/min-width:980px/, "desk gate stays 980");
must(/\$\("btnStart"\)\.onclick = function\(\)\{ openCamera\("photos","qfront"\); \}/, "phone start pose still opens the camera walk");
must(/function openCamera\(mode, id\)\{/, "camera walk stays");
must(/"Walk-around "\+\(step\+1\)\+" of "/, "guest camera still nudges walk-around order");
must(/id="walkOrderNote"/, "phone walk copy stays");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
mustNot(/id="exitRefresh"/, "Refresh stays gone");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");
must(/function applyCenterLaneMove\(/, "d30h lane move stays");
must(/function openMarketDocSheet\(/, "d30i market pills stay");
must(/function matchStoryTrim\(/, "d30k spoken trim stays");
must(/function unlockCenterItem\(/, "d30l Unlock stays");
must(/function orderCenterPhotos\(/, "Center photos still follow walk-around order");
must(/function walkViewIndex\(/, "walk order still uses VIEWS keys");
must(/>Critical</, "Critical damage tag stays");
must(/id="wbDmg"/, "Critical / Damage photos stay on CA");

const kick = sliceFn("kickShare", "packetSendId");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare Thank-you hash unchanged");
assert.ok(!/applyDeskWalkFiles/.test(kick), "Send does not ingest desk drops");
assert.ok(!/planDeskWalkDrop/.test(kick), "Send does not auto-sort photos");

const cam = sliceFn("openCamera", "nextEmpty");
assert.ok(/show\("camera"\)/.test(cam), "openCamera still shows the phone camera");
assert.ok(!/applyDeskWalkFiles/.test(cam), "openCamera is not rewritten by desk drop");

const keep = sliceFn("keepShot", "stopDamageMic");
assert.ok(/APP\.photos\[APP\.viewId\] = data/.test(keep), "keepShot still writes the camera walk");
assert.ok(!/planDeskWalkDrop/.test(keep), "keepShot is not rewritten by desk drop");

const persist = sliceFn("persistDeskWalkPhotos", "applyDeskWalkPlan");
assert.ok(/scheduleDraftSave\(\)/.test(persist), "drop persist uses the appraisal draft timer");
assert.ok(/flushDraft\(\)/.test(persist), "drop persist flushes photos into the draft store");

const apply = sliceFn("applyDeskWalkPlan", "applyDeskWalkFiles");
assert.ok(/APP\.photos\[p\.view\]=r\.data/.test(apply), "bulk drop writes walk slots on APP.photos");
assert.ok(/APP\.damage\[p\.view\]\.push/.test(apply), "overflow / damage hints stay on damage slots");
assert.ok(/persistDeskWalkPhotos\(\)/.test(apply), "bulk drop persists after assign");
assert.ok(/paintLists\(\)/.test(apply), "bulk drop repaints the walk-around slots");

assert.ok(/if\(APP\.photos\[v\[0\]\]\) out\.push/.test(html), "Send / packet still packs APP.photos walk slots");
assert.ok(/dmgShots\(v\[0\]\)/.test(html), "Send / packet still packs damage extras");

const viewsMatch = html.match(/const VIEWS = \[([\s\S]*?)\];/);
assert.ok(viewsMatch, "VIEWS catalog found");
const load = vm.createContext({ VIEWS: eval(viewsMatch[0].replace("const VIEWS =", "")) });
vm.runInContext(
  sliceFn("walkViewIndex", "walkIndex") +
  ";this.walkViewIndex=walkViewIndex;this.walkHintFromName=walkHintFromName;this.parseExifDateString=parseExifDateString;this.parseJpegExifDate=parseJpegExifDate;this.exifOrFileDate=exifOrFileDate;this.planDeskWalkDrop=planDeskWalkDrop;",
  load
);

function hint(name) {
  return load.walkHintFromName(name);
}
assert.strictEqual(hint("qfront.jpg").view, "qfront", "qfront filename");
assert.strictEqual(hint("3-4-front.jpg").view, "qfront", "3/4 front filename");
assert.strictEqual(hint("front.jpg").kind, "walk");
assert.strictEqual(hint("front.jpg").view, "front", "front stays the head-on slot");
assert.strictEqual(hint("driver-side.JPG").view, "driver");
assert.strictEqual(hint("rear.png").view, "rear");
assert.strictEqual(hint("passenger side.webp").view, "pass");
assert.strictEqual(hint("interior.jpg").view, "interior");
assert.strictEqual(hint("dash.jpg").view, "dash");
assert.strictEqual(hint("console.jpg").view, "console");
assert.strictEqual(hint("IMG_1234.jpg"), null, "no hint when the name is a camera roll number");
assert.strictEqual(hint("dent-driver.jpg").kind, "damage");
assert.strictEqual(hint("dent-driver.jpg").view, "driver");

const named = load.planDeskWalkDrop([
  { name: "rear.jpg", date: 9 },
  { name: "front.jpg", date: 8 },
  { name: "driver-side.jpg", date: 7 }
], {});
assert.strictEqual(named.walk.map(function (p) { return p.view; }).sort().join(","), "driver,front,rear", "filename hints land on those slots");
assert.strictEqual(named.damage.length, 0, "hinted walk files do not invent extras");

const dated = load.planDeskWalkDrop([
  { name: "IMG_3.jpg", date: 300 },
  { name: "IMG_1.jpg", date: 100 },
  { name: "IMG_2.jpg", date: 200 }
], {});
assert.strictEqual(dated.walk.map(function (p) { return p.view; }).join(","), "qfront,front,driver", "EXIF/date fills empty slots in walk order");
assert.strictEqual(dated.walk[0].i, 1, "oldest unnamed file is 3/4 front");
assert.strictEqual(dated.damage.length, 0, "three unnamed files do not invent extras");

const skipTaken = load.planDeskWalkDrop([{ name: "IMG_9.jpg", date: 1 }], { qfront: true, front: true });
assert.strictEqual(skipTaken.walk.map(function (p) { return p.view; }).join(","), "driver", "date fill skips occupied slots");

const extra = load.planDeskWalkDrop([
  { name: "front.jpg", date: 1 },
  { name: "front-2.jpg", date: 2 },
  { name: "scratch-rear.jpg", date: 3 }
], { front: true });
assert.ok(extra.walk.every(function (p) { return p.view !== "front"; }), "bulk drop does not overwrite a filled slot");
assert.ok(extra.damage.some(function (p) { return p.view === "front" || p.view === "rear"; }), "overflow and damage hints go to extras/damage");

const empty = load.planDeskWalkDrop([], {});
assert.strictEqual(empty.walk.length, 0, "no files means no invented walk photos");
assert.strictEqual(empty.damage.length, 0, "no files means no invented extras");

assert.strictEqual(load.parseExifDateString("2024:03:18 09:15:00"), Date.UTC(2024, 2, 18, 9, 15, 0), "EXIF date string parses");
assert.strictEqual(load.exifOrFileDate(null, { lastModified: 42 }), 42, "file date is the EXIF fallback");

assert.ok(!/data:image\/jpeg;base64,AAA/.test(sliceFn("applyDeskWalkFiles", "bindDeskWalkSlot")), "apply does not invent a fake photo");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("d31m desk walk drop: ok");
