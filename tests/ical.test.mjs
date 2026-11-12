import assert from "node:assert/strict";
import { test } from "node:test";
import { buildIcal, parseIcal } from "../lib/ical-parse.ts";

const AIRBNB = [
  "BEGIN:VCALENDAR",
  "PRODID;X-RICAL-TZSOURCE=TZINFO:-//Airbnb Inc//Hosting Calendar 0.8.8//EN",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "DTEND;VALUE=DATE:20270220",
  "DTSTART;VALUE=DATE:20270213",
  "UID:abc-123@airbnb.com",
  "DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/",
  " details/XXXX\\nPhone Number (Last 4 Digits): 1234",
  "SUMMARY:Reserved",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "DTSTART;VALUE=DATE:20270301",
  "UID:block-1@airbnb.com",
  "SUMMARY:Airbnb (Not available)",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

test("lit un export Airbnb (dates entières, lignes repliées)", () => {
  assert.deepEqual(parseIcal(AIRBNB), [
    { uid: "abc-123@airbnb.com", start: "2027-02-13", end: "2027-02-20", summary: "Reserved" },
    // Sans DTEND : une nuit.
    { uid: "block-1@airbnb.com", start: "2027-03-01", end: "2027-03-02", summary: "Airbnb (Not available)" },
  ]);
});

test("convertit les heures UTC en jour de Paris et ignore les événements annulés", () => {
  const text = [
    "BEGIN:VCALENDAR",
    "BEGIN:VEVENT",
    "UID:utc",
    // 23h30 UTC le 31 décembre = 0h30 le 1er janvier à Paris.
    "DTSTART:20261231T233000Z",
    "DTEND:20270105T090000Z",
    "SUMMARY:Séjour\\, famille",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:tz",
    "DTSTART;TZID=Europe/Paris:20270211T150000",
    "DTEND;TZID=Europe/Paris:20270213T100000",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:cancelled",
    "STATUS:CANCELLED",
    "DTSTART;VALUE=DATE:20270401",
    "DTEND;VALUE=DATE:20270403",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\n");
  assert.deepEqual(parseIcal(text), [
    { uid: "utc", start: "2027-01-01", end: "2027-01-05", summary: "Séjour, famille" },
    { uid: "tz", start: "2027-02-11", end: "2027-02-13", summary: null },
  ]);
});

test("refuse ce qui n'est pas un calendrier et ignore les dates invalides", () => {
  assert.throws(() => parseIcal("<html>Connexion requise</html>"), /iCal/);
  const text = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART;VALUE=DATE:20270231\nEND:VEVENT\nEND:VCALENDAR";
  assert.deepEqual(parseIcal(text), []);
});

test("l'export est relu à l'identique", () => {
  const events = [{ uid: "r1@petit-sport-chalet", start: "2026-12-20", end: "2026-12-27", summary: "Réservé" }];
  const ics = buildIcal("Le Petit Sport Chalet 1", events, new Date("2026-11-11T10:00:00Z"));
  assert.match(ics, /DTSTART;VALUE=DATE:20261220\r\nDTEND;VALUE=DATE:20261227/);
  assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
  assert.deepEqual(parseIcal(ics), events);
});
