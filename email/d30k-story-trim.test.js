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

must(/id="buildStamp">build d30t</, "home footer stamp is d30k");
must(/<!--[\s\S]*build d30t[\s\S]*LE \/ XLE \/ Limited trim/, "header stamp is d30k story trim");
must(/id="typeSheet"[\s\S]*build d30t/, "type sheet stamp is d30k");
must(/function parseStory\(/, "parseStory stays");
must(/function normalizeSpoken\(/, "normalizeSpoken stays");
must(/function applyStory\(/, "applyStory stays");
must(/function matchStoryTrim\(/, "spoken trim matcher exists");
must(/function spokenTrimClearer\(/, "typed trim is not blindly overwritten");
must(/\\bx\\s\+l\\s\+e\\b/, "normalizeSpoken collapses X L E");
must(/\\bl\\s\+e\\b/, "normalizeSpoken collapses L E");
must(/trd off-road/, "TRD Off-Road is in the trim list");
must(/"prime"/, "Prime is in the trim list");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
mustNot(/id="exitRefresh"/, "Refresh stays gone");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");
must(/function applyCenterLaneMove\(/, "d30h lane move stays");
must(/function openMarketDocSheet\(/, "d30i market pills stay");
must(/function applyCenterItemToApp\(/, "Unlock / History apply stays");

const parseStart = html.indexOf("function spokenSmall(");
const parseEnd = html.indexOf("\nfunction writeRetailListing(", parseStart);
assert.ok(parseStart > 0 && parseEnd > parseStart, "spoken parse block found");
const applyStart = html.indexOf("function typedTrimValue(");
const applyEnd = html.indexOf("\nfunction openVerify(", applyStart);
assert.ok(applyStart > 0 && applyEnd > applyStart, "applyStory block found");

function load(app, fields) {
  const box = {
    APP: Object.assign({
      year: "", make: "", model: "", trim: "", color: "", km: "", vin: "",
      heard: "", notes: "", webcopy: "", lockedFromAirtable: false
    }, app || {}),
    storyVin: function () { return ""; },
    $: function (id) { return (fields && fields[id]) || null; }
  };
  vm.createContext(box);
  vm.runInContext(
    html.slice(parseStart, parseEnd) +
    html.slice(applyStart, applyEnd) +
    ";this.parseStory=parseStory;this.normalizeSpoken=normalizeSpoken;this.applyStory=applyStory;this.matchStoryTrim=matchStoryTrim;this.spokenTrimClearer=spokenTrimClearer;",
    box
  );
  return box;
}

const rav4Le = load().parseStory("2024 Toyota RAV4 LE");
assert.strictEqual(rav4Le.year, "2024", "year from digits");
assert.strictEqual(rav4Le.make, "Toyota", "make Toyota");
assert.strictEqual(rav4Le.model, "RAV4", "model RAV4");
assert.strictEqual(rav4Le.trim, "LE", "LE sticks when spoken as LE");

const xleSpelled = load().parseStory("twenty twenty four Toyota Rav 4 X L E");
assert.strictEqual(xleSpelled.year, "2024", "twenty twenty four → 2024");
assert.strictEqual(xleSpelled.make, "Toyota", "make from spoken Toyota");
assert.strictEqual(xleSpelled.model, "RAV4", "Rav 4 → RAV4");
assert.strictEqual(xleSpelled.trim, "XLE", "X L E sticks as XLE");

assert.strictEqual(load().parseStory("2022 Toyota Highlander XLE").trim, "XLE", "XLE as one word");
assert.strictEqual(load().parseStory("2021 Toyota Camry ex lee").trim, "XLE", "ex lee → XLE");
assert.strictEqual(load().parseStory("2020 Toyota RAV4 XSE").trim, "XSE", "XSE");
assert.strictEqual(load().parseStory("2019 Toyota RAV4 Nightshade").trim, "Nightshade", "Nightshade");
assert.strictEqual(load().parseStory("2018 Toyota Tacoma TRD").trim, "TRD", "TRD");
assert.strictEqual(load().parseStory("2018 Toyota Tacoma T R D").trim, "TRD", "T R D → TRD");
assert.strictEqual(load().parseStory("2017 Toyota Camry Hybrid").trim, "Hybrid", "Hybrid");
assert.strictEqual(load().parseStory("2016 Toyota Camry L").trim, "L", "base L");
assert.strictEqual(load().parseStory("2024 Toyota RAV4 Prime").trim, "Prime", "Prime");
assert.strictEqual(load().parseStory("2023 Toyota Tacoma TRD Off-Road").trim, "TRD Off-Road", "TRD Off-Road before TRD");
assert.strictEqual(load().parseStory("2023 Toyota Tacoma TRD Sport").trim, "TRD Sport", "TRD Sport before TRD");
assert.strictEqual(load().parseStory("2022 Toyota RAV4 Adventure").trim, "Adventure", "Adventure");
assert.strictEqual(load().parseStory("2021 Toyota RAV4 Trail").trim, "Trail", "Trail");
assert.strictEqual(load().parseStory("2024 Toyota RAV4 LE AWD").trim, "LE", "AWD does not wipe LE");
assert.strictEqual(load().parseStory("2024 Toyota RAV4 AWD").trim, "AWD", "AWD is option-ok when no other trim");
assert.strictEqual(load().normalizeSpoken("X L E"), "xle", "normalizeSpoken X L E → xle");
assert.strictEqual(load().normalizeSpoken("L E"), "le", "normalizeSpoken L E → le");
assert.strictEqual(load().normalizeSpoken("X S E"), "xse", "normalizeSpoken X S E → xse");
assert.strictEqual(load().normalizeSpoken("T R D"), "trd", "normalizeSpoken T R D → trd");
assert.strictEqual(load().parseStory("2015 Ford F-150 XLT").trim, "XLT", "existing XLT stays");
assert.strictEqual(load().parseStory("2014 Honda CR-V Limited").trim, "Limited", "existing Limited stays");
assert.strictEqual(load().parseStory("2013 Ford Escape Sport").trim, "Sport", "existing Sport stays");
assert.strictEqual(load().parseStory("2012 Hyundai Tucson SE").trim, "SE", "existing SE stays");

const keep = load({ trim: "Limited" });
keep.applyStory("2024 Toyota RAV4 LE");
assert.strictEqual(keep.APP.trim, "Limited", "typed Limited is not overwritten by spoken LE");

const fields = load({ trim: "" }, { "v-trim": { value: "Sport" } });
fields.applyStory("2024 Toyota RAV4 Limited");
assert.strictEqual(fields.APP.trim, "Sport", "typed Sport in the trim field stays");

const clearer = load({ trim: "LE" });
clearer.applyStory("2024 Toyota RAV4 XLE");
assert.strictEqual(clearer.APP.trim, "XLE", "spoken XLE is clearer than typed LE");

const empty = load({ trim: "" });
empty.applyStory("2024 Toyota RAV4 LE");
assert.strictEqual(empty.APP.trim, "LE", "empty trim takes spoken LE");
assert.strictEqual(empty.APP.year, "2024", "year fills");
assert.strictEqual(empty.APP.make, "Toyota", "make fills");
assert.strictEqual(empty.APP.model, "RAV4", "model fills");

["404.html", "inspect-vehicle.html"].forEach(function (name) {
  const copy = fs.readFileSync(path.join(root, name), "utf8");
  assert.equal(copy, html, name + " must stay in sync with index.html");
});

console.log("d30k story trim: ok");
