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
must(/function writeRetailListing\(/, "retail-ready listing writer");
must(/function applyVinDecode\(/, "VIN decode is stored for the listing");
must(/Write retail description/, "retail description button");
must(/Written from this appraisal file/, "listing is file-based, not AI mush");
must(/VIN decode:/, "listing uses VIN decode facts");
must(/Walk-around photos on the file/, "listing uses photo context");
must(/Market paperwork on the file/, "listing uses market docs");
must(/ex\.live/, "demo extract facts are not treated as real history");
mustNot(/photographed and ready for retail/, "no filler retail mush");
mustNot(/async function generateWebCopy\(\)\{[\s\S]*?\/api\/describe/, "Write retail description does not call /api/describe");
must(/id="buildStamp">build d24</, "build d24 stamp");
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

const retailFrom = html.indexOf("function vinDecodeUseful(");
const retailTo = html.indexOf("\nfunction writeListing()", retailFrom);
assert.ok(retailFrom > 0 && retailTo > retailFrom, "retail listing helpers found");
const rbox = {
  APP: {
    year: "2018",
    make: "Ford",
    model: "F-150",
    trim: "XLT",
    color: "Oxford White",
    km: "118000",
    vin: "1FTEW1EP4JFA20331",
    stock: "A1042",
    notes: "One owner, winter tires in the box, small chip on the hood.",
    vinDecode: { engine: "5.0L 8-cyl", drive: "4WD / 4-Wheel Drive / 4x4", body: "Pickup", doors: "4", fuel: "Gasoline" },
    photos: { qfront: "x", driver: "x", dash: "x" },
    damage: { hood: [{ cap: "Stone chip on the hood" }] },
    closeups: ["x"],
    closeupCap: [],
    docs: {
      carfax: { have: true, extract: { live: true, facts: [["Owners", "2"], ["Accidents", "1 reported"]] } },
      mmr: { have: true, extract: { live: false, facts: [["MMR", "$18,400"]] } }
    }
  },
  VIEWS: [["qfront", "3/4 Front"], ["driver", "Driver side"], ["dash", "Dashboard"]],
  PACKET_DOCS: [
    { id: "carfax", label: "Carfax", kind: "extract" },
    { id: "mmr", label: "MMR", kind: "extract" }
  ]
};
vm.createContext(rbox);
vm.runInContext(html.slice(retailFrom, retailTo) + "\nthis.writeRetailListing=writeRetailListing;", rbox);
const listing = rbox.writeRetailListing();
assert.ok(/F-150/.test(listing), "retail listing names the vehicle");
assert.ok(/Oxford White/.test(listing), "retail listing uses colour");
assert.ok(/118,000 km/.test(listing), "retail listing uses kilometres");
assert.ok(/1FTEW1EP4JFA20331/.test(listing), "retail listing includes VIN");
assert.ok(/5\.0L 8-cyl/.test(listing), "retail listing uses VIN decode engine");
assert.ok(/4WD/.test(listing), "retail listing uses VIN decode drive");
assert.ok(/Stone chip on the hood/.test(listing), "retail listing uses damage notes");
assert.ok(/3\/4 Front/.test(listing), "retail listing uses walk-around photos");
assert.ok(/Carfax Owners 2/.test(listing), "live Carfax facts are quoted");
assert.ok(!/\$18,400/.test(listing), "demo MMR numbers are not quoted as facts");
assert.ok(/MMR/.test(listing), "MMR still named as paperwork on file");
assert.ok(!/photographed and ready for retail/.test(listing), "no filler close");
assert.ok(/no extra claims/.test(listing), "buyer is told the copy is from the file");

const demoBox = {
  APP: {
    year: "2018", make: "Ford", model: "F-150", trim: "XLT", color: "", km: "",
    vin: "1FTEW1EP4JFA20331", notes: "", vinDecode: {},
    photos: {}, damage: {}, closeups: [], docs: {
      carfax: { have: true, extract: { live: false, facts: [["Owners", "1"], ["Accidents", "0 reported"]] } }
    }
  },
  VIEWS: [],
  PACKET_DOCS: [{ id: "carfax", label: "Carfax", kind: "extract" }]
};
vm.createContext(demoBox);
vm.runInContext(html.slice(retailFrom, retailTo) + "\nthis.writeRetailListing=writeRetailListing;", demoBox);
const demoListing = demoBox.writeRetailListing();
assert.ok(/Carfax/.test(demoListing), "demo Carfax is named");
assert.ok(!/0 reported/.test(demoListing), "demo accident count is not a buyer claim");
assert.ok(!/Owners 1/.test(demoListing), "demo owner count is not a buyer claim");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("vin-entry: ok");
