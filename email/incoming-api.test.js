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
  assert.equal(rav4.length, 1, "VIN collapse stays one row");
  assert.equal(rav4[0].docs.vauto.have, true, "empty stub does not wipe 3-pill docs");
  assert.equal(rav4[0].sentAt, 1789339609336, "older stub does not win sentAt");
  assert.equal(rav4[0].sendId, "s1ex074");

  console.log("incoming-api: ok");
})().catch(function (err) {
  console.error(err);
  process.exit(1);
});
