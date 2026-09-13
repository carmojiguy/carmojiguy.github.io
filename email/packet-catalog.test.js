#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("function packetCatalogHtml(shots, srcFor){");
const end = html.indexOf("\nfunction packetMailHtmlHosted(", start);
assert.ok(start > 0 && end > start, "packetCatalogHtml not found");
const src = html.slice(start, end);

assert.ok(/G&amp;M AUTO SALES/.test(src), "sales-grade brand lockup");
assert.ok(/Georgia/.test(src), "serif title, not a dark dump");
assert.ok(/role="presentation"/.test(src), "table layout for mail clients");
assert.ok(/Photo catalog/.test(src), "photo grid section");
assert.ok(/<!--PACKET_PDF-->/.test(src), "hosted PDF slot");
assert.ok(!/background:#110E1A;color:#fff/.test(src), "dark header dump is gone");

const sandbox = {
  APP: {
    role: "guest",
    year: "2024",
    make: "Hyundai",
    model: "Tucson",
    trim: "Preferred",
    color: "White",
    km: "18400",
    vin: "KM8J3CA17RU123456",
    stock: "",
    dealType: "Retail",
    cdApp: "",
    notes: "One-owner, winter tires included.",
    heard: "",
    inviteName: "Maya Patel",
    clips: []
  },
  escHtml: function (s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  },
  unitLabel: function () { return "2024 Hyundai Tucson"; },
  why: function () { return "Trade-in"; }
};
vm.createContext(sandbox);
vm.runInContext(src + "\nthis.packetCatalogHtml=packetCatalogHtml;", sandbox);

const htmlOut = sandbox.packetCatalogHtml(
  [
    { title: "Front 3/4", cap: "Clean nose", data: "x" },
    { title: "Interior", cap: "", data: "y" }
  ],
  function (s, i) { return "cid:photo" + i + "@inspect"; }
);

assert.ok(htmlOut.indexOf("cid:photo0@inspect") >= 0, "hero keeps CID");
assert.ok(htmlOut.indexOf("cid:photo1@inspect") >= 0, "grid keeps CID");
assert.ok(htmlOut.indexOf("2024 Hyundai Tucson") >= 0, "vehicle title");
assert.ok(htmlOut.indexOf("Maya Patel") >= 0, "customer name");
assert.ok(htmlOut.indexOf("One-owner, winter tires included.") >= 0, "story");
assert.ok(htmlOut.indexOf("G&amp;M AUTO SALES") >= 0, "brand");
assert.ok(htmlOut.indexOf("#F3F0EA") >= 0, "warm paper background");

console.log("packet-catalog: ok");
