"use strict";

/**
 * Lot seed dates arrive as US short (`8/17/26`) and as ISO (`2026-08-17`).
 * Live format.o / Je() runs date-fns parseISO then format, which throws
 * RangeError("Invalid time value") on `8/17/26`. That is a second crash
 * on /inventory/v-g3709 after the hook error recovers.
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toIsoDate(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (us) {
    let year = Number(us[3]);
    if (year < 100) year += 2000;
    const month = Number(us[1]);
    const day = Number(us[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${pad2(month)}-${pad2(day)}`;
  }
  return null;
}

function formatDeskDay(value) {
  const iso = toIsoDate(value);
  if (!iso) return "—";
  const date = new Date(`${iso}T12:00:00-04:00`);
  if (Number.isNaN(+date)) return "—";
  try {
    return new Intl.DateTimeFormat("en-CA", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(date);
  } catch {
    return "—";
  }
}

module.exports = { toIsoDate, formatDeskDay };
