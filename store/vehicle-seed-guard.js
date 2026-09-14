"use strict";

const { toIsoDate } = require("./desk-date");

const COST_KEYS = ["purchase", "packs", "parts", "service", "labor", "gas", "other"];

function finiteNumber(value, fallback) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function photoList(vehicle) {
  const fromArray = Array.isArray(vehicle.photos)
    ? vehicle.photos.filter((url) => typeof url === "string" && url.trim())
    : [];
  const main = typeof vehicle.photo === "string" && vehicle.photo.trim() ? vehicle.photo : null;
  const list = main && !fromArray.includes(main) ? [main, ...fromArray] : fromArray;
  return { photo: main || list[0] || null, photos: list };
}

function costBreakdown(vehicle) {
  const src = vehicle && vehicle.costBreakdown && typeof vehicle.costBreakdown === "object"
    ? vehicle.costBreakdown
    : {};
  const buckets = {};
  for (const key of COST_KEYS) {
    buckets[key] = finiteNumber(src[key], 0);
  }
  if (buckets.purchase <= 0) buckets.purchase = finiteNumber(vehicle.cost, 0);
  return buckets;
}

function str(value) {
  return value == null ? "" : String(value);
}

/**
 * Keep unit detail usable when a seed row is messy (G3709: US dates,
 * empty colour, null floor). Does not invent money or photos.
 */
function normalizeVehicle(vehicle) {
  if (!vehicle || typeof vehicle !== "object") return vehicle;
  const photos = photoList(vehicle);
  const boughtAt = toIsoDate(vehicle.boughtAt) || "";
  const floorDate = toIsoDate(vehicle.floorDate);
  return Object.assign({}, vehicle, {
    trim: str(vehicle.trim),
    color: str(vehicle.color),
    boughtFrom: str(vehicle.boughtFrom),
    buyerStaffId: str(vehicle.buyerStaffId),
    description: str(vehicle.description),
    km: finiteNumber(vehicle.km, 0),
    daysOnLot: finiteNumber(vehicle.daysOnLot, 0),
    cost: finiteNumber(vehicle.cost, 0),
    price: finiteNumber(vehicle.price, 0),
    photo: photos.photo,
    photos: photos.photos,
    boughtAt,
    floorDate: floorDate || null,
    costBreakdown: costBreakdown(vehicle),
  });
}

function normalizeLotVehicles(vehicles) {
  if (!Array.isArray(vehicles)) return [];
  return vehicles.map(normalizeVehicle);
}

module.exports = {
  COST_KEYS,
  normalizeVehicle,
  normalizeLotVehicles,
  photoList,
  costBreakdown,
};
