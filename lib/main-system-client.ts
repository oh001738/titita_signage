/** Same service boundary as LINE OA: server-side X-Internal-Key, bounded timeout, mock adapter. */
import { z } from "zod";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { mockLessons } from "./defaults";
import { lessonSchema } from "./validation";
import { atomicWrite, dataDir } from "./store";
import { taiwanDate } from "./time";
import type { Schedule } from "@/types";
const responseSchema = z.object({
  data: z.object({
    date: z.string(),
    lessons: z.array(lessonSchema).max(1000),
  }),
  error: z.null(),
});
const globals = globalThis as typeof globalThis & {
  signageSchedule?: Schedule;
  signageScheduleFetch?: Promise<Schedule>;
};
export async function fetchSchedule(): Promise<Schedule> {
  const date = taiwanDate();
  if (process.env.MOCK_MODE === "true")
    return {
      date,
      fetchedAt: new Date().toISOString(),
      source: "mock",
      stale: false,
      lessons: mockLessons(date),
      error: null,
    };
  if (
    globals.signageSchedule?.date === date &&
    globals.signageSchedule.fetchedAt &&
    Date.now() - Date.parse(globals.signageSchedule.fetchedAt) < 30_000
  )
    return globals.signageSchedule;
  if (globals.signageScheduleFetch) return globals.signageScheduleFetch;
  globals.signageScheduleFetch = (async () => {
    try {
      const base = process.env.MAIN_SYSTEM_URL;
      const key = process.env.SIGNAGE_API_KEY;
      if (!base || !key) throw new Error("Missing integration configuration");
      const url = new URL(`/api/internal/signage/schedule?date=${date}`, base);
      const response = await fetch(url, {
        headers: { "X-Internal-Key": key },
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
        redirect: "error",
      });
      if (!response.ok) throw new Error("Upstream unavailable");
      const parsed = responseSchema.parse(await response.json());
      if (
        parsed.data.date !== date ||
        parsed.data.lessons.some((l) => l.date !== date)
      )
        throw new Error("Wrong schedule date");
      const fresh: Schedule = {
        date,
        fetchedAt: new Date().toISOString(),
        source: "onecloud",
        stale: false,
        lessons: parsed.data.lessons,
        error: null,
      };
      await atomicWrite(path.join(dataDir(), "schedule-cache.json"), fresh);
      globals.signageSchedule = fresh;
      return fresh;
    } catch {
      let cached = globals.signageSchedule;
      if (!cached) {
        try {
          cached = JSON.parse(
            await readFile(path.join(dataDir(), "schedule-cache.json"), "utf8"),
          ) as Schedule;
        } catch {
          /* No persisted snapshot yet. */
        }
      }
      const usable =
        cached?.date === date &&
        cached.fetchedAt &&
        Date.now() - Date.parse(cached.fetchedAt) < 5 * 60_000;
      return {
        date,
        fetchedAt: cached?.fetchedAt ?? null,
        source: "onecloud",
        stale: true,
        lessons: usable ? cached!.lessons : [],
        error: "課表連線暫停，請以櫃台資訊為準",
      } satisfies Schedule;
    }
  })();
  try {
    return await globals.signageScheduleFetch;
  } finally {
    globals.signageScheduleFetch = undefined;
  }
}
