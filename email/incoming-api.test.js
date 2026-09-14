#!/usr/bin/env node
"use strict";

const assert = require("assert");
const path = require("path");
const incoming = require(path.join(__dirname, "..", "api", "incoming.js"));
const upload = require(path.join(__dirname, "..", "api", "upload.js"));

incoming.resetStore();

const land = incoming.route("POST", {
  kind: "land",
  item: {
    sendId: "s9guest",
    vin: "5NMS3DAJ7NH452632",
    ymmt: "2022 Hyundai Santa Fe Preferred",
    source: "guest",
    story: "Full walk is on the file.",
    photoCount: 8,
    thumb: "data:image/jpeg;base64,xxx",
    customer: { name: "Christine Guest", email: "christine@example.com", phone: "(613) 555-0100" },
    docs: { carfax: { have: true, name: "Carfax.pdf", type: "pdf", data: "NOPE" } },
    inviteUnit: "2025 Hyundai Tucson Preferred"
  }
});
assert.equal(land.status, 200);
assert.equal(land.body.ok, true);
assert.ok(land.body.id);

const listed = incoming.route("GET");
assert.equal(listed.status, 200);
assert.equal(listed.body.ok, true);
assert.equal(listed.body.items.length, 1);
assert.equal(listed.body.items[0].vin, "5NMS3DAJ7NH452632");
assert.equal(listed.body.items[0].docs.carfax.have, true);
assert.equal(listed.body.items[0].docs.carfax.data, undefined);
assert.equal(listed.body.items[0].inviteUnit, "2025 Hyundai Tucson Preferred");

incoming.route("POST", {
  kind: "land",
  item: {
    sendId: "s9guest",
    vin: "5NMS3DAJ7NH452632",
    ymmt: "2022 Hyundai Santa Fe Preferred",
    story: "Updated packet.",
    photoCount: 9,
    customer: { name: "Christine Guest" }
  }
});
assert.equal(incoming.listItems().length, 1, "same sendId replaces, does not duplicate");
assert.equal(incoming.listItems()[0].story, "Updated packet.");

assert.equal(incoming.isPacketSend({
  text: "2022 Tucson — Trade-in\n\nThe photo catalog is in this email. The PDF is attached."
}), true);
assert.equal(incoming.isPacketSend({
  text: "2024 Toyota RAV4 — Trade-in\n\nThe sales-grade appraisal PDF is attached. Damage is one picture-and-sound clip."
}), true);
assert.equal(incoming.isPacketSend({
  text: "This is a private link to get a real value on your vehicle"
}), false);

(async function () {
  incoming.resetStore();
  await incoming.persistFromSend({
    kind: "send",
    subject: "2022 Hyundai Santa Fe Preferred — trade-in from Christine Guest",
    text: "2022 Hyundai Santa Fe Preferred — Trade-in\nSent by: Christine Guest · link from Shawn\nVIN 5NMS3DAJ7NH452632\n\nClean AWD.\n\nThe photo catalog is in this email. The PDF is attached.",
    html: '<div style="text-transform:uppercase">Year</div><div>2022</div>',
    parts: [{ mime: "image/jpeg", b64: "abc" }, { mime: "application/pdf", b64: "pdf", disp: "attachment", name: "car.pdf" }]
  }, { id: "gmail1" });
  const fromSend = incoming.listItems();
  assert.equal(fromSend.length, 1);
  assert.equal(fromSend[0].source, "guest");
  assert.equal(fromSend[0].vin, "5NMS3DAJ7NH452632");
  assert.equal(fromSend[0].customer.name, "Christine Guest");

  const sendResp = await upload.route({ kind: "send", to: "shawn@gmautosales.ca", subject: "x", text: "hi" });
  assert.deepEqual(sendResp.body, { ok: false, error: "mailer" }, "upload Thank-you contract unchanged when mailer env is missing");

  const empty = incoming.route("POST", { kind: "land", item: {} });
  assert.equal(empty.body.ok, false);

  incoming.resetStore();
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "sample-v5-civic",
      sample: true,
      vin: "2HGFE2F54RH543210",
      ymmt: "2024 Honda Civic Sport",
      customer: { name: "Alex Ruiz" }
    }
  });
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "guest-christine-blazer-20260913",
      vin: "3GNKBHRS0LS577461",
      ymmt: "2020 Chevrolet Blazer LT",
      source: "guest",
      customer: { name: "Christine Cyr" }
    }
  });
  const afterSkip = incoming.route("GET");
  assert.equal(afterSkip.body.items.length, 1, "sample land is not listed");
  assert.equal(afterSkip.body.items[0].id, "guest-christine-blazer-20260913");

  incoming.resetStore();
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "cmu0avif7rslu",
      sendId: "s1ex074",
      vin: "2T3B1RFVXRC466025",
      ymmt: "2024 TOYOTA RAV4",
      lane: "onsite",
      sentAt: 1789339609336,
      docs: { vauto: { have: true }, openlane: { have: true }, eblock: { have: true } },
      customer: { name: "Chris Cyr" }
    }
  });
  assert.equal(incoming.listItems()[0].lane, "onsite", "complete land keeps On-site");
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "guest-chris-rav4-20260913",
      sendId: "old-rav4",
      vin: "2T3B1RFVXRC466025",
      sentAt: 1757792340000,
      docs: {},
      customer: { name: "Chris Cyr" }
    }
  });
  const rav4 = incoming.listItems();
  assert.equal(rav4.length, 2, "same VIN different sendId stays two remotes");
  const newer = rav4.find(function (x) { return x.sendId === "s1ex074"; });
  const older = rav4.find(function (x) { return x.sendId === "old-rav4"; });
  assert.ok(newer && older, "both sendIds stay");
  assert.equal(newer.docs.vauto.have, true, "empty stub does not wipe 3-pill docs");
  assert.equal(newer.sentAt, 1789339609336, "older stub does not win sentAt");
  assert.equal(newer.id, "cmu0avif7rslu", "newer remote keeps its own id");
  assert.equal(older.id, "guest-chris-rav4-20260913", "older remote keeps its own id");

  incoming.resetStore();
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "lane-hist-1",
      sendId: "s-hist",
      vin: "2T3B1RFVXRC466025",
      ymmt: "2024 Toyota RAV4",
      lane: "history",
      archived: true,
      stage: "Appraised",
      customer: { name: "Chris Cyr" }
    }
  });
  const hist = incoming.listItems()[0];
  assert.equal(hist.lane, "history", "mailer keeps History lane");
  assert.equal(hist.archived, true, "mailer keeps archived true");
  assert.equal(hist.stage, "Appraised", "History land is Appraised");
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "lane-hist-1",
      sendId: "s-hist",
      vin: "2T3B1RFVXRC466025",
      lane: "onsite",
      archived: false,
      stage: "Waiting",
      sentAt: Date.now(),
      customer: { name: "Chris Cyr" }
    }
  });
  assert.equal(incoming.listItems()[0].lane, "onsite", "mailer accepts On-site move");
  assert.equal(incoming.listItems()[0].archived, false, "On-site move clears archived");

  incoming.resetStore();
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "team-act-1",
      sendId: "s-team-act",
      vin: "2T3B1RFVXRC466025",
      ymmt: "2024 Toyota RAV4",
      lane: "onsite",
      teamActivated: true,
      teamActivatedAt: 1700000000000,
      teamStatus: "running",
      customer: { name: "Chris Cyr" }
    }
  });
  const activated = incoming.listItems()[0];
  assert.equal(activated.id, "team-act-1", "activate land keeps sendId/id");
  assert.equal(activated.teamActivated, true, "mailer keeps teamActivated");
  assert.equal(activated.teamStatus, "running", "mailer keeps teamStatus");
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "team-act-1",
      sendId: "s-team-act",
      vin: "2T3B1RFVXRC466025",
      story: "later",
      customer: { name: "Chris Cyr" }
    }
  });
  assert.equal(incoming.listItems().length, 1, "activate land does not create a new card");
  assert.equal(incoming.listItems()[0].teamActivated, true, "later land does not wipe teamActivated");
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "team-act-1",
      sendId: "s-team-act",
      vin: "2T3B1RFVXRC466025",
      teamActivated: false,
      teamStatus: "",
      customer: { name: "Chris Cyr" }
    }
  });
  assert.equal(incoming.listItems().length, 1, "false activate is the same card");
  assert.equal(incoming.listItems()[0].teamActivated, false, "mailer persists teamActivated false");

  incoming.resetStore();
  incoming.route("POST", {
    kind: "land",
    item: {
      sendId: "s-doc-url",
      vin: "2T3B1RFVXRC466025",
      ymmt: "2024 Toyota RAV4",
      customer: { name: "Chris Cyr" },
      docs: {
        vauto: {
          have: true,
          name: "vauto.mp4",
          type: "video/mp4",
          url: "https://example.com/vauto.mp4",
          data: "data:video/mp4;base64,NOPE",
          preview: "https://example.com/vauto.jpg",
          shots: [{ url: "https://example.com/shot.jpg" }, "data:image/jpeg;base64,NO"]
        }
      }
    }
  });
  const withUrl = incoming.listItems()[0];
  assert.equal(withUrl.docs.vauto.url, "https://example.com/vauto.mp4", "mailer keeps docs.url");
  assert.equal(withUrl.docs.vauto.preview, "https://example.com/vauto.jpg", "mailer keeps http preview");
  assert.equal(withUrl.docs.vauto.data, undefined, "mailer still strips base64 data");
  const shotUrls = withUrl.docs.vauto.shots.map(function (s) { return s.url; });
  assert.ok(shotUrls.indexOf("https://example.com/shot.jpg") >= 0, "mailer keeps the extra shot url");
  assert.ok(shotUrls.indexOf("https://example.com/vauto.mp4") >= 0, "mailer keeps the primary url in shots[]");
  assert.equal(withUrl.docs.vauto.shots.length, 2, "primary url is appended into shots[]");

  incoming.resetStore();
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "c-unlock-1",
      sendId: "s-unlock-1",
      vin: "2T3B1RFVXRC466025",
      lane: "history",
      archived: true,
      locked: true,
      superseded: true,
      supersedeLock: true,
      centerLocked: true,
      customer: { name: "Chris Cyr" },
      docs: { vauto: { have: true, name: "walk.mp4", type: "video/mp4", url: "https://example.com/walk.mp4" } },
      appraisalFinal: { min: "22800", target: "24000", max: "25000" }
    }
  });
  assert.equal(incoming.listItems()[0].locked, true, "mailer keeps locked");
  assert.equal(incoming.listItems()[0].superseded, true, "mailer keeps superseded");
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "c-unlock-1",
      sendId: "s-unlock-1",
      locked: false,
      superseded: false,
      supersedeLock: false,
      centerLocked: false,
      staffUnlocked: true,
      lane: "history",
      archived: true,
      customer: { name: "Chris Cyr" },
      docs: { vauto: { have: true, name: "walk.mp4", type: "video/mp4", url: "https://example.com/walk.mp4" } }
    }
  });
  const unlocked = incoming.listItems()[0];
  assert.equal(incoming.listItems().length, 1, "unlock land is the same sendId");
  assert.equal(unlocked.locked, false, "unlock clears locked");
  assert.equal(unlocked.superseded, false, "unlock clears superseded");
  assert.equal(unlocked.supersedeLock, false);
  assert.equal(unlocked.centerLocked, false);
  assert.equal(unlocked.staffUnlocked, true);
  assert.equal(unlocked.lane, "history", "unlock keeps History");
  assert.equal(unlocked.docs.vauto.url, "https://example.com/walk.mp4", "unlock keeps docs.url");
  assert.equal(unlocked.appraisalFinal.target, "24000", "unlock land does not wipe FINAL");

  incoming.resetStore();
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "cmu0avif7rslu",
      sendId: "s1pvwj8g",
      vin: "2T3B1RFVXRC466025",
      ymmt: "2024 Toyota RAV4",
      appraisalFinal: { min: "22800", target: "24000", max: "25000" },
      team: { shabot: { min: "22800", target: "24000", max: "25000", note: "keep" } },
      customer: { name: "Chris Cyr" }
    }
  });
  incoming.route("POST", {
    kind: "team",
    sendId: "s1pvwj8g",
    id: "cmu0avif7rslu",
    vin: "2T3B1RFVXRC466025",
    ymmt: "2024 Toyota RAV4"
  });
  assert.equal(incoming.listItems().length, 1);
  assert.equal(incoming.listItems()[0].teamActivated, true, "kind:team persists teamActivated");
  assert.equal(incoming.listItems()[0].appraisalFinal.target, "24000", "kind:team keeps RAV4 FINAL");
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "cmu0avif7rslu",
      sendId: "s1pvwj8g",
      teamActivated: true,
      teamStatus: "running",
      customer: { name: "Chris Cyr" }
    }
  });
  assert.equal(incoming.listItems()[0].appraisalFinal.min, "22800");
  assert.equal(incoming.listItems()[0].appraisalFinal.target, "24000");
  assert.equal(incoming.listItems()[0].appraisalFinal.max, "25000");

  incoming.resetStore();
  incoming.route("POST", {
    kind: "team",
    sendId: "sir78n6",
    id: "cmu0kchd1rgc1",
    vin: "1FTFW1E87PKE74233",
    ymmt: "2023 Ford F-150"
  });
  assert.equal(incoming.listItems()[0].id, "cmu0kchd1rgc1");
  assert.equal(incoming.listItems()[0].teamActivated, true);
  assert.ok(!incoming.listItems()[0].appraisalFinal || !incoming.listItems()[0].appraisalFinal.target, "F-150 kind:team does not invent FINAL");

  incoming.resetStore();
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "cmu0a6138006k",
      sendId: "s1af19al",
      vin: "3GNKBHRS0LS577461",
      ymmt: "2020 Chevrolet Blazer 2LT",
      appraisalFinal: { min: "15500", target: "17000", max: "18000" },
      team: {
        shabot: { min: "15500", target: "17000", max: "18000", note: "Sided Wes" },
        rybot: { min: "17000", target: "19000", max: "20500", note: "Ryan fighter" },
        webot: { min: "15500", target: "17000", max: "18000", note: "Wes analytical" },
        drebot: { min: "14800", target: "16500", max: "17800", note: "Drew" },
        tbot: { min: "14500", target: "16500", max: "18000", note: "Sean bear" }
      },
      finalRationale: {
        schema_version: "1.0",
        title: "HOW WE GOT HERE",
        markdown: "# HOW WE GOT HERE — Shabot FINAL",
        panel: { rybot: { min: "17000", target: "19000", max: "20500", why: "rich" } }
      },
      customer: { name: "larry laydown" }
    }
  });
  const blazer = incoming.listItems()[0];
  assert.equal(blazer.sendId, "s1af19al");
  assert.equal(blazer.team.rybot.target, "19000", "mailer keeps schema 1.0 team.rybot");
  assert.equal(blazer.team.rybot.note, "Ryan fighter");
  assert.equal(blazer.finalRationale.schema_version, "1.0");
  assert.ok(blazer.finalRationale.markdown.indexOf("HOW WE GOT HERE") >= 0);
  assert.equal(blazer.finalRationale.panel.rybot.target, "19000");

  incoming.resetStore();
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "cmu0kchd1rgc1",
      sendId: "sir78n6",
      vin: "1FTFW1E87PKE74233",
      ymmt: "2023 Ford F-150 Lariat",
      appraisalFinal: { min: "45200", target: "47000", max: "49000" },
      team: {
        shabot: { min: "45200", target: "47000", max: "49000", note: "Sided Wes direction; overruled Ryan high exit; photo-blind cap" },
        rybot: { min: "51000", target: "54000", max: "56000", note: "Exit too rich without photos" },
        webot: { min: "44500", target: "46500", max: "48000", note: "Blind-packet exit" },
        drebot: { min: "46500", target: "49500", max: "52000", note: "Shaved for zero photos" },
        tbot: { min: "43000", target: "45500", max: "48000", note: "Slightly too bear" }
      },
      finalRationale: {
        schema_version: "1.0",
        title: "HOW WE GOT HERE",
        markdown: "# HOW WE GOT HERE — Shabot FINAL\n## 2023 Ford F-150 Lariat · VIN 1FTFW1E87PKE74233",
        panel: {
          Rybot: { min: 51000, target: 54000, max: 56000, why: "Exit too rich without photos" },
          Webot: { min: 44500, target: 46500, max: 48000, why: "Blind-packet exit" },
          Drebot: { min: 46500, target: 49500, max: 52000, why: "Shaved for zero photos" },
          TBot: { min: 43000, target: 45500, max: 48000, why: "Slightly too bear" }
        }
      },
      customer: { name: "F-150" }
    }
  });
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "cmu0kchd1rgc1",
      sendId: "sir78n6",
      teamActivated: true,
      teamStatus: "running",
      team: { shabot: { min: "45200", target: "47000", max: "49000", note: "" } },
      customer: { name: "F-150" }
    }
  });
  const f150Keep = incoming.listItems()[0];
  assert.equal(f150Keep.team.rybot.target, "54000", "shabot-only Center land keeps Rybot numbers");
  assert.equal(f150Keep.team.rybot.note, "Exit too rich without photos", "shabot-only Center land keeps Rybot note");
  assert.equal(f150Keep.team.webot.note, "Blind-packet exit");
  assert.equal(f150Keep.team.drebot.target, "49500");
  assert.equal(f150Keep.team.tbot.max, "48000");
  assert.equal(f150Keep.finalRationale.schema_version, "1.0");
  assert.ok(f150Keep.finalRationale.markdown.indexOf("HOW WE GOT HERE — Shabot FINAL") >= 0, "markdown survives shabot-only land");
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "cmu0kchd1rgc1",
      sendId: "sir78n6",
      team: {
        shabot: { min: "45200", target: "47000", max: "49000", note: "" },
        rybot: { min: "51000", target: "54000", max: "56000", note: "" }
      },
      finalRationale: { schema_version: "1.0" },
      customer: { name: "F-150" }
    }
  });
  const f150Stub = incoming.listItems()[0];
  assert.equal(f150Stub.team.rybot.note, "Exit too rich without photos", "empty next note does not wipe Incoming Rybot note");
  assert.ok(f150Stub.finalRationale.markdown.indexOf("HOW WE GOT HERE") >= 0, "schema_version stub does not wipe markdown");
  assert.equal(f150Stub.finalRationale.panel.Rybot.why, "Exit too rich without photos");

  incoming.resetStore();
  incoming.route("POST", {
    kind: "land",
    item: {
      id: "c-empty-keep",
      sendId: "s-empty-keep",
      vin: "1FTEW1EP6PFA00001",
      ymmt: "Empty file",
      customer: { name: "Empty" }
    }
  });
  const emptyKeep = incoming.listItems()[0];
  assert.ok(!emptyKeep.appraisalFinal || !emptyKeep.appraisalFinal.target, "empty file does not invent FINAL");
  assert.ok(!emptyKeep.team || !emptyKeep.team.rybot || !emptyKeep.team.rybot.target, "empty file does not invent Rybot");

  console.log("incoming-api: ok");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
