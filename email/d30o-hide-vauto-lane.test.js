#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const crypto = require("crypto");
const vm = require("vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const copy404 = fs.readFileSync(path.join(root, "404.html"), "utf8");
const inspect = fs.readFileSync(path.join(root, "inspect-vehicle.html"), "utf8");

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

assert.equal(copy404, html, "404.html stays a byte-identical copy of index.html");
assert.equal(inspect, html, "inspect-vehicle.html stays a byte-identical copy of index.html");

must(/id="buildStamp">build d30o</, "home footer stamp is d30o");
must(/<!--[\s\S]*build d30o[\s\S]*hides generated From V Auto lane/, "file header stamp is d30o hide generated lane");
must(/<!--[\s\S]*build d30o[\s\S]*Thank-you frozen/, "Thank-you stays frozen in the stamp");
must(/<!--[\s\S]*build d30o[\s\S]*sales PDF packet stays; zero Center samples/, "sales PDF / zero-sample lock stays");
must(/id="typeSheet"[\s\S]*build d30o/, "type sheet stamp is d30o");
must(/id="centerDocs"/, "Center documents host stays");
must(/id="centerRunTeam">Run Appraisal Team</, "Run Appraisal Team stays");
must(/id="centerFinalBox"/, "FINAL box stays");
must(/id="centerPacketPdf"/, "Open packet PDF stays");
must(/id="centerUnlock">Unlock</, "Unlock stays");
must(/class="lane-dd-sel"/, "status dropdown stays");
must(/PACKET_ADDS/, "three add-doc pills stay");
must(/V Auto documents/, "V Auto documents pill stays");
must(/OpenLane documents/, "OpenLane documents pill stays");
must(/eBlock documents/, "eBlock documents pill stays");
must(/\{id:"carfax", label:"Carfax"/, "huge Carfax control stays a launcher");
must(/function openMarketDocSheet\(/, "real file add/view sheet stays");
must(/function viewMarketDocUrl\(/, "saved url viewer stays");
must(/function paintCenterDocs\(/, "Center still paints docs");
must(/function finishGuest\(\)\{\s*finishThanks\(\);/, "Thank-you stays frozen");
mustNot(/id="exitRefresh"/, "Refresh stays gone");
mustNot(/openlane:\s*\[\{ask|sold:/, "do not invent OpenLane solds");

const paint = sliceFn("paintPacketDocs", "paintDerivedMarket");
assert.ok(/PACKET_LAUNCH\.forEach/.test(paint), "2x2 launchers including Carfax still paint");
assert.ok(/PACKET_ADDS\.forEach/.test(paint), "three market pills still paint");
assert.ok(/openMarketDocSheet/.test(paint), "Center pills still open the real-file sheet");
assert.ok(/if\(host\.id==="centerDocs"\) return;/.test(paint), "Center vehicle detail returns before generated lane");
assert.ok(/paintDerivedMarket\(host, store, readOnly\)/.test(paint), "Appraise/workbench still append derived market");
assert.ok(paint.indexOf('if(host.id==="centerDocs") return;') < paint.indexOf("paintDerivedMarket(host, store, readOnly)"), "Center skip is before the generated append");

const derived = sliceFn("paintDerivedMarket", "blackBookCard");
assert.ok(/From V Auto · appraisal started/.test(derived), "desk painter still has the V Auto heading for Appraise");
assert.ok(/vautoOfferCard\(m, store, readOnly\)/.test(derived), "desk still can append V Auto buy number");
assert.ok(/blackBookCard\(m, store, readOnly\)/.test(derived), "desk still can append Black Book");
assert.ok(/mmrCard\(m, store, readOnly\)/.test(derived), "desk still can append MMR");
assert.ok(/vautoCompCard\(m, store, readOnly\)/.test(derived), "desk still can append comps");
assert.ok(/carfaxCard\(m, store, readOnly\)/.test(derived), "desk still can append generated Carfax card");

const centerDocs = sliceFn("paintCenterDocs", "marketDocUrlOf");
assert.ok(/paintPacketDocs\(host/.test(centerDocs), "Center detail still uses the shared packet painter");
assert.ok(!/paintDerivedMarket/.test(centerDocs), "Center docs painter does not call derived market itself");
assert.ok(!/vautoOfferCard/.test(centerDocs), "Center docs painter does not append the buy-number card");
assert.ok(!/carfaxCard/.test(centerDocs), "Center docs painter does not append the Clean-title card");

const detail = sliceFn("paintCenterDetail", "landInCenter");
assert.ok(/paintCenterDocs/.test(detail), "detail still paints docs");
assert.ok(/paintCenterFinalBox/.test(detail), "detail still paints FINAL");
assert.ok(/paintCenterRunTeam/.test(detail), "detail still paints Run Appraisal Team");
assert.ok(/paintCenterPacketPdf/.test(detail), "detail still paints Open packet PDF");
assert.ok(/centerUnlock/.test(detail), "detail still paints Unlock");
assert.ok(!/vautoOfferCard/.test(detail), "detail does not append generated V Auto offer");
assert.ok(!/From V Auto/.test(detail), "detail does not paint the generated heading");
assert.ok(/paintCenterVals/.test(detail), "metrics strip still paints on Center detail");
assert.ok(/id="centerValStrip"/.test(html), "metrics vals strip stays in the Center sheet");
assert.ok(/id="centerMarket"/.test(html), "metrics market strip stays in the Center sheet");

must(/const CENTER_VALS=\[[\s\S]*Appraisal Team/, "top-left metrics label is Appraisal Team");
mustNot(/\["maya","MAYA"\]/, "MAYA chip is gone");
mustNot(/Officer Maya/, "not Officer Maya");
must(/\["vauto","VAuto"\]/, "VAuto chip stays");
must(/const CENTER_MARKET=\[[\s\S]*OpenLane avg/, "OpenLane is split including avg km/price");
must(/const CENTER_MARKET=\[[\s\S]*eBlock/, "eBlock box is on the metrics grid");
mustNot(/const CENTER_MARKET=\[[\s\S]*?\["afc","AFC"\]/, "AFC chip is replaced");
must(/function centerMetricsView\(/, "metrics view helper exists");
must(/USD_CAD_MMR/, "MMR converts USD to CAD");
must(/\.acre-market \{ display:grid; grid-template-columns:repeat\(3, 1fr\)/, "market chips wrap three across");
const metricsSrc = sliceFn("centerMetricsView", "paintMetricChip");
assert.ok(!/seedMarketNumbers/.test(metricsSrc), "metrics view does not invent seed numbers");
assert.ok(!/Nearby 1/.test(metricsSrc), "metrics view does not invent comps");

mustNot(/docs\.carfax\.url/, "do not fight d30n Carfax real-file url");

const kick = sliceFn("kickShare", "packetSendId");
assert.equal(sha(kick), "8916eec5374600903af5f69dff305cbc33a4fc168f420d3cc7267e8bb4be9b5f", "kickShare Thank-you hash unchanged");

(function runPaintPacketDocs() {
  function el(tag) {
    const kids = [];
    return {
      tagName: String(tag || "div").toUpperCase(),
      type: "",
      className: "",
      id: "",
      innerHTML: "",
      kids,
      setAttribute: function () {},
      appendChild: function (child) { kids.push(child); return child; }
    };
  }
  let derivedCalls = 0;
  const sandbox = {
    APP: { docs: {} },
    PACKET_LAUNCH: [
      {id:"vauto", label:"V Auto", brand:"vauto-sq", open:"vauto"},
      {id:"carfax", label:"Carfax", brand:"carfax-sq", open:"carfax"},
      {id:"openlane", label:"OpenLane", brand:"openlane-sq", open:"openlane"},
      {id:"eblock", label:"eBlock", brand:"eblock-sq", open:"eblock"}
    ],
    PACKET_ADDS: [
      {id:"vauto_docs", label:"V Auto documents", pack:"vauto"},
      {id:"openlane_docs", label:"OpenLane documents", pack:"openlane"},
      {id:"eblock_docs", label:"eBlock documents", pack:"eblock"}
    ],
    document: { createElement: el },
    marketStore: function (opts) { return (opts && opts.docs) || {}; },
    launchMarkup: function () { return ""; },
    escHtml: function (s) { return String(s || ""); },
    openMarketSite: function () {},
    openMarketDocSheet: function () {},
    marketDocKey: function (id) { return String(id || "").replace(/_docs$/, ""); },
    normalizePacketDoc: function (got) { return got || null; },
    pickPhotoLibrary: function () {},
    toast: function () {},
    paintDerivedMarket: function () { derivedCalls += 1; }
  };
  vm.createContext(sandbox);
  vm.runInContext(paint + "\nthis.paintPacketDocs=paintPacketDocs;", sandbox);

  const center = el("div");
  center.id = "centerDocs";
  center.className = "docs-grid center-docs";
  sandbox.paintPacketDocs(center, {
    docs: { vauto_docs: { have: true, url: "https://example.com/vauto.pdf" } },
    item: { id: "c1", docs: {} },
    readOnly: false
  });
  assert.equal(derivedCalls, 0, "Center centerDocs does not append generated V Auto / Black Book / MMR / comps / Carfax cards");
  assert.equal(center.kids.length, 2, "Center still paints launchers + three pills");
  assert.equal(center.kids[0].className, "research-tools", "huge Carfax control row stays");
  assert.equal(center.kids[0].kids.length, 4, "V Auto / Carfax / OpenLane / eBlock launchers stay");
  assert.equal(center.kids[1].className, "research-adds", "three market pills stay");
  assert.equal(center.kids[1].kids.length, 3, "V Auto / OpenLane / eBlock pills stay");
  assert.ok(!center.kids.some(function (n) { return n.className === "research-derived" || n.className === "desk-lane" || n.className === "desk-empty"; }), "no empty generated heading on Center");

  const desk = el("div");
  desk.id = "docsList";
  desk.className = "docs-grid";
  sandbox.paintPacketDocs(desk, { docs: { vauto_docs: { have: true } } });
  assert.equal(derivedCalls, 1, "Appraise docsList still gets the derived painter");
})();

(function runCenterMetricsView() {
  const from = html.indexOf("function metricBlank(");
  const to = html.indexOf("\nfunction paintMetricChip(", from);
  assert.ok(from > 0 && to > from, "metrics helpers extractable");
  const moneyFrom = html.indexOf("function moneyNum(");
  const moneyTo = html.indexOf("\nfunction seedMarketNumbers(", moneyFrom);
  const prettyFrom = html.indexOf("function moneyPretty(");
  const prettyTo = html.indexOf("\nfunction emptyAppraisalFinal(", prettyFrom);
  const teamFrom = html.indexOf("function teamSlot(");
  const teamTo = html.indexOf("\nfunction moneyShort(", teamFrom);
  const finalFrom = html.indexOf("function hasAppraisalFinalNumbers(");
  const finalTo = html.indexOf("\nfunction syncAppraisalFinalFromTeam(", finalFrom);
  const cdFrom = html.indexOf("function leadSourceOf(");
  const cdTo = html.indexOf("\nfunction isConsumerAcquisition(", cdFrom);
  const cd2From = html.indexOf("function isCanadaDrives(");
  const cd2To = html.indexOf("\nfunction cdAppNumber(", cd2From);
  const sandbox = { USD_CAD_MMR: 1.35 };
  vm.createContext(sandbox);
  vm.runInContext(
    html.slice(moneyFrom, moneyTo) +
    html.slice(prettyFrom, prettyTo) +
    html.slice(teamFrom, teamTo) +
    html.slice(finalFrom, finalTo) +
    html.slice(cdFrom, cdTo) +
    html.slice(cd2From, cd2To) +
    html.slice(from, to) +
    "\nthis.centerMetricsView=centerMetricsView;this.round50=round50;this.vautoBuyFromMarket=vautoBuyFromMarket;this.usdToCadMmr=usdToCadMmr;",
    sandbox
  );
  const empty = sandbox.centerMetricsView({ leadSource: "My Loan" });
  assert.equal(empty.vauto.value, "—", "no extract → VAuto blank");
  assert.equal(empty.book.value, "—", "no extract → Black Book blank");
  assert.equal(empty.mmr.value, "—", "no extract → MMR blank");
  assert.equal(empty.predicted.value, "—", "non-Canada Drives Predicted stays blank");
  assert.equal(empty.olforecast.value, "—", "no OpenLane extract → blank");
  assert.equal(empty.eblock.value, "—", "no eBlock extract → blank");

  const seeded = sandbox.centerMetricsView({
    docs: {
      vauto_docs: {
        have: true,
        extract: {
          live: false,
          market: {
            market: 20000, average: 18000, mmr: 17000, comps: [{who:"Nearby 1", price:19000, km:80000}]
          }
        }
      }
    }
  });
  assert.equal(seeded.vauto.value, "—", "seeded/demo extract does not fill VAuto");
  assert.equal(seeded.book.value, "—", "seeded/demo extract does not fill Black Book");

  const live = sandbox.centerMetricsView({
    team: { shabot: { min: "22800", target: "24000", max: "25000" } },
    leadSource: "Canada Drives",
    cdOffer: "21500",
    docs: {
      vauto_docs: {
        extract: {
          live: true,
          currency: "USD",
          facts: [["Market", "$20,000"], ["Average before km", "$18,400"], ["MMR", "$10,000"]],
          market: { market: 20000, average: 18400, mmr: 10000 }
        }
      },
      openlane_docs: {
        extract: {
          live: true,
          parsedFields: { olOffer: true, olAvgPrice: true, olKm: true },
          market: { olOffer: 19100, olAvgPrice: 18800, olKm: 84000, parsedFields: { olOffer: true, olAvgPrice: true, olKm: true } }
        }
      },
      eblock_docs: {
        extract: {
          live: true,
          facts: [["Average of vehicles", "$17,900"], ["Average km", "91,000 km"]],
          market: { ebAvg: 17900, ebKm: 91000, parsedFields: { ebAvg: true, ebKm: true } }
        }
      }
    }
  });
  assert.equal(live.team.value, "$24,000", "Appraisal Team uses Shabot FINAL target");
  assert.ok(/MIN/.test(live.team.note) && /MAX/.test(live.team.note), "Appraisal Team shows min/max");
  assert.equal(live.vauto.value, "$19,000", "VAuto is 95% of extracted market");
  assert.equal(live.pct.value, "95%", "% Market is 95% when market extract exists");
  assert.equal(live.predicted.value, "$21,500", "Canada Drives predicted offer fills Predicted");
  assert.equal(live.book.value, "$18,400", "Black Book is average before km");
  assert.equal(live.mmr.value, "$13,500", "MMR USD 10000 → CAD at 1.35");
  assert.equal(live.olforecast.value, "$19,100", "OpenLane forecast from extract");
  assert.equal(live.olavg.value, "$18,800", "OpenLane avg price from extract");
  assert.equal(live.olavg.note, "84,000 km", "OpenLane avg km from extract");
  assert.equal(live.eblock.value, "$17,900", "eBlock avg selling price from extract");
  assert.equal(live.eblock.note, "91,000 km", "eBlock avg km from extract");
  assert.equal(sandbox.usdToCadMmr(10000), 13500, "USD→CAD helper");
  assert.equal(sandbox.vautoBuyFromMarket(20000).pctOf, 19000, "95% of market helper");
})();

console.log("d30o-hide-vauto-lane: ok");
