#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const vm = require("vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const start = html.indexOf("function packetRecNote(){");
const end = html.indexOf("\nfunction packetMailHtmlHosted(", start);
assert.ok(start > 0 && end > start, "packetCatalogHtml not found");
const src = html.slice(start, end);

assert.ok(/G&amp;M AUTO SALES/.test(src), "sales-grade brand lockup");
assert.ok(/Georgia/.test(src), "serif title, not a dark dump");
assert.ok(/role="presentation"/.test(src), "table layout for mail clients");
assert.ok(/The sales-grade appraisal PDF is the packet/.test(src), "PDF is the email packet");
assert.ok(/<!--PACKET_PDF-->/.test(src), "hosted PDF slot");
assert.ok(!/Photo catalog/.test(src), "HTML photo catalog dump is gone");
assert.ok(!/Spoken damage notes are attached/.test(src), "lone spoken-note copy is gone");
assert.ok(!/not attached to this email/.test(src), "screen-recording-not-attached copy is gone");
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
    leadSource: "",
    cdApp: "",
    notes: "One-owner, winter tires included.",
    heard: "",
    inviteName: "Maya Patel",
    clips: [],
    _damageMailClip: null
  },
  isCanadaDrives: function () { return false; },
  escHtml: function (s) {
    return String(s || "").replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  },
  unitLabel: function () { return "2024 Hyundai Tucson"; },
  why: function () { return "Trade-in"; },
  packetSenderLine: function () { return "Maya Patel · customer trade-in"; }
};
vm.createContext(sandbox);
vm.runInContext(src + "\nthis.packetCatalogHtml=packetCatalogHtml;this.packetRecNote=packetRecNote;this.packetMailText=packetMailText;this.packetMailClipNote=packetMailClipNote;", sandbox);

const htmlOut = sandbox.packetCatalogHtml(
  [
    { title: "Front 3/4", cap: "Clean nose", data: "x" },
    { title: "Interior", cap: "", data: "y" }
  ],
  function (s, i) { return "cid:photo" + i + "@inspect"; }
);

assert.ok(htmlOut.indexOf("cid:photo0@inspect") >= 0, "cover hero keeps CID");
assert.ok(htmlOut.indexOf("cid:photo1@inspect") < 0, "email body does not dump the photo catalog");
assert.ok(htmlOut.indexOf("2024 Hyundai Tucson") >= 0, "vehicle title");
assert.ok(htmlOut.indexOf("Maya Patel") >= 0, "customer name");
assert.ok(htmlOut.indexOf("One-owner, winter tires included.") >= 0, "story");
assert.ok(htmlOut.indexOf("G&amp;M AUTO SALES") >= 0, "brand");
assert.ok(htmlOut.indexOf("#FAF9FC") >= 0, "PDF-matching paper background");
assert.ok(htmlOut.indexOf("#00A8E8") >= 0, "PDF cyan accent");
assert.ok(htmlOut.indexOf("Walk-around video is attached.") < 0, "HTML does not claim walk video is attached");
assert.ok(htmlOut.indexOf("Spoken damage notes are attached") < 0, "HTML does not attach spoken notes as audio");
assert.ok(htmlOut.indexOf("Photo catalog") < 0, "no catalog heading");

const textOut = sandbox.packetMailText();
assert.ok(/sales-grade appraisal PDF is attached/.test(textOut), "plain text leads with the PDF");
assert.ok(!/photo catalog is in this email/i.test(textOut), "plain text does not sell the catalog");
assert.ok(!/spoken damage note/i.test(textOut), "plain text does not advertise lone audio");

sandbox.APP.clips = [{ dur: 4 }];
sandbox.APP.docs = { carfax: { videos: [{ name: "00_1.mp4", type: "video/mp4" }] } };
const recOut = sandbox.packetCatalogHtml(
  [{ title: "Front 3/4", cap: "", data: "x", audio: "data:audio/mp4;base64,QQ==" }],
  function (s, i) { return "cid:photo" + i + "@inspect"; }
);
assert.ok(recOut.indexOf("not attached to this email") < 0, "no screen-recording-not-attached copy");
assert.ok(recOut.indexOf("picture-and-sound clip") >= 0, "damage becomes one muxed clip");
assert.ok(recOut.indexOf("Walk-around video is attached.") < 0, "recording note never says attached");

console.log("packet-catalog: ok");
