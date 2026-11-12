import assert from "node:assert/strict";
import { test } from "node:test";
import { addDays, addMonths, diffDays, eachDay, isDay, monthGrid, todayParis } from "../lib/dates.ts";

test("isDay refuse les dates impossibles", () => {
  assert.equal(isDay("2026-02-28"), true);
  assert.equal(isDay("2026-02-30"), false);
  assert.equal(isDay("2026-2-3"), false);
  assert.equal(isDay(20260203), false);
});

test("arithmétique de jours insensible aux changements d'heure", () => {
  // Passage à l'heure d'été le 28 mars 2027.
  assert.equal(addDays("2027-03-27", 2), "2027-03-29");
  assert.equal(diffDays("2027-03-27", "2027-03-29"), 2);
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.deepEqual(eachDay("2026-02-11", "2026-02-13"), ["2026-02-11", "2026-02-12"]);
});

test("todayParis suit le fuseau de Paris, pas celui du serveur", () => {
  assert.equal(todayParis(new Date("2026-12-31T23:30:00Z")), "2027-01-01");
  assert.equal(todayParis(new Date("2026-07-01T21:59:00Z")), "2026-07-01");
});

test("grille mensuelle du lundi au dimanche", () => {
  const grid = monthGrid("2026-12-01");
  assert.equal(grid[0], "2026-11-30");
  assert.equal(grid.at(-1), "2027-01-03");
  assert.equal(grid.length % 7, 0);
  assert.equal(addMonths("2026-12-01", 1), "2027-01-01");
});
