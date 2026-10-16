import { test, afterEach } from "node:test";
import assert from "node:assert";
import { resolveCoordinates, parseBirthTime } from "../lib/compute-chart.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

type Hit = {
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country?: string;
  admin1?: string;
  population?: number;
};

/** Stub the geocoder with a per-(query, language) fixture and record calls. */
function stubGeocoder(fixtures: Record<string, Hit[]>) {
  const calls: { name: string; language: string }[] = [];
  globalThis.fetch = (async (url: string | URL) => {
    const u = new URL(String(url));
    const name = u.searchParams.get("name") ?? "";
    const language = u.searchParams.get("language") ?? "";
    calls.push({ name, language });
    return {
      ok: true,
      json: async () => ({ results: fixtures[`${name}|${language}`] ?? [] }),
    };
  }) as unknown as typeof fetch;
  return calls;
}

test("parses birth times and treats a missing one as unknown", () => {
  assert.deepEqual(parseBirthTime("07:15"), { hour: 7, minute: 15 });
  assert.deepEqual(parseBirthTime("07"), { hour: 7, minute: 0 });
  assert.deepEqual(parseBirthTime(null), { hour: null, minute: 0 });
  assert.deepEqual(parseBirthTime("nonsense"), { hour: null, minute: 0 });
});

test("falls back to the first token when 'City State' finds nothing", async () => {
  const calls = stubGeocoder({
    "Springfield|en": [
      {
        name: "Springfield",
        latitude: 39.8,
        longitude: -89.6,
        timezone: "America/Chicago",
        country: "United States",
        admin1: "Illinois",
        population: 114394,
      },
      {
        name: "Springfield",
        latitude: 37.21,
        longitude: -93.29,
        timezone: "America/Chicago",
        country: "United States",
        admin1: "Missouri",
        population: 170188,
      },
    ],
  });

  const got = await resolveCoordinates(
    "Springfield Missouri, United States America",
  );

  // "Springfield Missouri" returns nothing, so it retries with "Springfield"
  // and uses the dropped word to pick Missouri over the higher-ranked Illinois.
  assert.deepEqual(
    calls.map((c) => c.name),
    ["Springfield Missouri", "Springfield"],
  );
  assert.equal(got?.lat, 37.21);
});

test("matches a country typed in the user's own language", async () => {
  stubGeocoder({
    "Eberbach|de": [
      {
        name: "Eberbach-Seltz",
        latitude: 48.92,
        longitude: 8.06,
        timezone: "Europe/Paris",
        country: "Frankreich",
      },
      {
        name: "Eberbach",
        latitude: 49.46,
        longitude: 8.99,
        timezone: "Europe/Berlin",
        country: "Deutschland",
      },
    ],
  });

  // "Deutschland" normalises to germany, which selects the German index and
  // scores the German hit above the French one the API ranked first.
  const got = await resolveCoordinates("Eberbach, Deutschland");
  assert.equal(got?.tz, "Europe/Berlin");
});

test("searches the language index where a native city name actually lives", async () => {
  const calls = stubGeocoder({
    "Wien|de": [
      {
        name: "Wien",
        latitude: 48.2,
        longitude: 16.37,
        timezone: "Europe/Vienna",
        country: "Österreich",
        population: 1691468,
      },
    ],
  });

  const got = await resolveCoordinates("Wien, Österreich");

  assert.deepEqual(calls, [{ name: "Wien", language: "de" }]);
  assert.equal(got?.lat, 48.2);
});

test("retries in English when the country hint finds nothing", async () => {
  const calls = stubGeocoder({
    "Dresden|en": [
      {
        name: "Dresden",
        latitude: 51.05,
        longitude: 13.73,
        timezone: "Europe/Berlin",
        country: "Germany",
      },
    ],
  });

  const got = await resolveCoordinates("Dresden, Deutschland");

  assert.deepEqual(
    calls.map((c) => c.language),
    ["de", "en"],
  );
  assert.equal(got?.tz, "Europe/Berlin");
});

test("prefers the city over the hamlet that shares its name", async () => {
  stubGeocoder({
    "Wien|en": [
      {
        name: "Wien",
        latitude: 39.66,
        longitude: -92.4,
        timezone: "America/Chicago",
        country: "United States",
      },
      {
        name: "Wien",
        latitude: 48.2,
        longitude: 16.37,
        timezone: "Europe/Vienna",
        country: "Austria",
        population: 1691468,
      },
    ],
  });

  // No country typed, so nothing scores — population is the only signal left.
  const got = await resolveCoordinates("Wien");
  assert.equal(got?.tz, "Europe/Vienna");
});

test("returns null rather than guessing when nothing resolves", async () => {
  stubGeocoder({});
  assert.equal(await resolveCoordinates("Qwertyville, Nowhere"), null);
  assert.equal(await resolveCoordinates(""), null);
});
