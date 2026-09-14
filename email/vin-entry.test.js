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

mustNot(/Speak the VIN/, "never show Speak the VIN");
must(/data-vin-act="type"/, "Type action on the VIN field");
must(/data-vin-act="dictate"/, "Dictate action on the VIN field");
must(/data-vin-act="photo"/, "Ownership photo action on the VIN field");
must(/Ownership photo/, "Ownership photo label");
must(/>Dictate</, "Dictate label");
must(/id="na-vin"/, "create-form VIN field stays");
must(/id="v-vin"/, "verify VIN field stays");
must(/id="vinGallery"/, "gallery picker for OCR");
must(/id="btnVinGallery"/, "choose from gallery");
must(/function cleanVinTyped\(/, "uppercase + strip bad VIN chars");
must(/function rejectBadVinLength\(/, "reject bad VIN length");
must(/function bindVinField\(/, "VIN field binders");
must(/function speakVinField\(/, "dictate writes into the VIN field");
must(/function dictateVinSpeech\(/, "dictate speech packer");
must(/function primeVinMic\(/, "Dictate VIN asks for the microphone");
must(/function speakVinField\([\s\S]{0,900}primeVinMic\(/, "Dictate primes mic in the same tap");
must(/function primeVinMic\([\s\S]{0,400}getUserMedia\(\{audio:true/, "mic permission is getUserMedia audio");
must(/function speakVinField\([\s\S]{0,5000}rec\.start\(\)/, "Dictate starts speech recognition");
must(/Allow the microphone, then tap Dictate/, "Dictate permission copy names Dictate");
mustNot(/function speakVinField\([\s\S]*noGum:true/, "Dictate VIN does not skip getUserMedia");
must(/function writeRetailListing\(/, "retail-ready listing writer");
must(/Write retail description/, "retail description button");
must(/photographed and ready for retail/, "retail listing copy");
must(/id="buildStamp">build d31a</, "build d31a stamp");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you-only Send stays");
must(/function revealMailOpen\(\)\{[\s\S]{0,80}hideMailOpen\(\)/, "Open Gmail stays hide-only");
must(/function openNewApplicationDesk\(\)\{[\s\S]{0,500}show\("home"\)/, "My Loan create form stays on HOME");
must(/DEAL_TYPES = \["Trade-in","Locate","Consumer Acquisition"\]/, "A/B/C types stay");

const from = html.indexOf("function cleanVinTyped(");
const to = html.indexOf("function vinOk(", from);
assert.ok(from > 0 && to > from, "cleanVinTyped found");
const sandbox = { APP: {} };
vm.createContext(sandbox);
vm.runInContext(html.slice(from, to) + "\nthis.cleanVinTyped=cleanVinTyped;", sandbox);
assert.equal(sandbox.cleanVinTyped("1ft ew1ep4jfa20331"), "1FTEW1EP4JFA20331", "uppercase and strip spaces");
assert.equal(sandbox.cleanVinTyped("1FTEW1EP4JFA20331EXTRA"), "1FTEW1EP4JFA20331", "caps at 17");
assert.equal(sandbox.cleanVinTyped("abcioq"), "ABC", "drops I O Q");

const packFrom = html.indexOf("function packVinSpeech(");
const packTo = html.indexOf("function phoneticVin(", packFrom);
assert.ok(packFrom > 0 && packTo > packFrom, "dictateVinSpeech found");
const pbox = { APP: {} };
vm.createContext(pbox);
vm.runInContext(
  html.slice(packFrom, packTo) +
  "\nthis.packVinSpeech=packVinSpeech;this.dictateVinSpeech=dictateVinSpeech;",
  pbox
);
assert.equal(
  pbox.dictateVinSpeech("one F T E W one E P four J F A two zero three three one"),
  "1FTEW1EP4JFA20331",
  "spelled-out VIN packs to 17"
);
assert.equal(
  pbox.dictateVinSpeech("one F T E W one E P for J F A two oh three three one"),
  "1FTEW1EP4JFA20331",
  "for → 4 and oh → 0"
);
assert.equal(
  pbox.dictateVinSpeech("1ft ew1ep4jfa20331"),
  "1FTEW1EP4JFA20331",
  "chunked spoken VIN"
);
assert.equal(
  pbox.dictateVinSpeech("2 T 3 B 1 R F V X R C for 6 6 0 to 5"),
  "2T3B1RFVXRC466025",
  "for/to letter-number errors"
);
assert.equal(
  pbox.dictateVinSpeech("be are see 1 2 3"),
  "BRC123",
  "be/are/see → B/R/C"
);

const retailFrom = html.indexOf("function writeRetailListing(");
const retailTo = html.indexOf("\nfunction writeListing()", retailFrom);
assert.ok(retailFrom > 0 && retailTo > retailFrom, "writeRetailListing found");
const rbox = {
  APP: { year: "2018", make: "Ford", model: "F-150", trim: "XLT", color: "Oxford White", km: "118000", vin: "1FTEW1EP4JFA20331", notes: "" }
};
vm.createContext(rbox);
vm.runInContext(html.slice(retailFrom, retailTo) + "\nthis.writeRetailListing=writeRetailListing;", rbox);
const listing = rbox.writeRetailListing();
assert.ok(/F-150/.test(listing), "retail listing names the vehicle");
assert.ok(/ready for retail/.test(listing), "retail listing is retail-ready");
assert.ok(/1FTEW1EP4JFA20331/.test(listing), "retail listing includes VIN");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("vin-entry: ok");
