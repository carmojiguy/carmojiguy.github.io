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
  assert.equal(withUrl.docs.vauto.shots.length, 1);
  assert.equal(withUrl.docs.vauto.shots[0].url, "https://example.com/shot.jpg");

  console.log("incoming-api: ok");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
