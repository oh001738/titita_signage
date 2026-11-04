import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchSchedule } from "../lib/main-system-client";
import { taiwanDate } from "../lib/time";
import { mockLessons } from "../lib/defaults";
import type { Schedule } from "../types";
const globals = globalThis as typeof globalThis & {
  signageSchedule?: Schedule;
  signageScheduleFetch?: Promise<Schedule>;
};
let dir = "";
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "signage-api-"));
  vi.stubEnv("DATA_DIR", dir);
  vi.stubEnv("MOCK_MODE", "false");
  vi.stubEnv("MAIN_SYSTEM_URL", "http://onecloud.internal:3000");
  vi.stubEnv("SIGNAGE_API_KEY", "test-only-key");
  delete globals.signageSchedule;
  delete globals.signageScheduleFetch;
});
afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  delete globals.signageSchedule;
  delete globals.signageScheduleFetch;
  await rm(dir, { recursive: true, force: true });
});
it("uses a server-side service credential and strips upstream non-public fields", async () => {
  const date = taiwanDate();
  const fetch = vi.fn(async () =>
    Response.json({
      data: {
        date,
        lessons: mockLessons(date).map((l) => ({
          ...l,
          student_name: "private-name",
        })),
      },
      error: null,
    }),
  );
  vi.stubGlobal("fetch", fetch);
  const result = await fetchSchedule();
  expect(result.source).toBe("onecloud");
  expect(result.stale).toBe(false);
  expect(JSON.stringify(result)).not.toContain("private-name");
  expect(fetch.mock.calls[0]?.length).toBe(2);
});
it("uses same-day snapshots for brief outages but never serves yesterday or an expired schedule", async () => {
  const date = taiwanDate();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("offline");
    }),
  );
  globals.signageSchedule = {
    date,
    fetchedAt: new Date(Date.now() - 60000).toISOString(),
    source: "onecloud",
    stale: false,
    lessons: mockLessons(date),
    error: null,
  };
  expect((await fetchSchedule()).lessons.length).toBe(6);
  globals.signageSchedule.fetchedAt = new Date(
    Date.now() - 6 * 60000,
  ).toISOString();
  expect((await fetchSchedule()).lessons).toEqual([]);
  globals.signageSchedule.date = "2000-01-01";
  expect((await fetchSchedule()).lessons).toEqual([]);
});
it("fails visibly on upstream 403 rather than switching to fake lessons", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json({ data: null, error: "Forbidden" }, { status: 403 }),
    ),
  );
  const result = await fetchSchedule();
  expect(result.stale).toBe(true);
  expect(result.source).toBe("onecloud");
  expect(result.lessons).toEqual([]);
});
