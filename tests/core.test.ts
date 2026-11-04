import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSession,
  verifySession,
  hashToken,
  requireSameOrigin,
  requireScreenSameOrigin,
} from "../lib/auth";
import { contentSchema } from "../lib/validation";
import { defaultContent } from "../lib/defaults";
import { isActive, taiwanDate, validDate } from "../lib/time";
afterEach(() => vi.unstubAllEnvs());
describe("admin sessions", () => {
  it("rejects tampered, expired, and cross-key tokens", () => {
    vi.stubEnv("SESSION_SECRET", "a".repeat(48));
    const issued = Date.now();
    const token = createSession(issued);
    expect(verifySession(token, issued + 1000)).toBe(true);
    expect(verifySession(token + "tamper", issued)).toBe(false);
    expect(verifySession(token, issued + 8 * 3600000 + 1)).toBe(false);
    vi.stubEnv("SESSION_SECRET", "b".repeat(48));
    expect(verifySession(token, issued)).toBe(false);
    expect(hashToken("screen-a")).not.toBe(hashToken("screen-b"));
  });
});
describe("publication validation", () => {
  it("rejects unsafe links and arbitrary image paths", () => {
    expect(
      contentSchema.safeParse({
        ...defaultContent(),
        lineUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    const value = defaultContent();
    value.posters[0].image = "/api/media/../../secret";
    expect(contentSchema.safeParse(value).success).toBe(false);
  });
  it("rejects inverted schedules, duplicate IDs, and invalid durations", () => {
    const value = defaultContent();
    value.posters[0].duration = 0;
    expect(contentSchema.safeParse(value).success).toBe(false);
    value.posters[0].duration = 15;
    value.posters[0].startsAt = "2026-11-05T00:00:00+08:00";
    value.posters[0].endsAt = "2026-11-04T00:00:00+08:00";
    expect(contentSchema.safeParse(value).success).toBe(false);
    const duplicate = defaultContent();
    duplicate.announcements.push(duplicate.announcements[0]);
    expect(contentSchema.safeParse(duplicate).success).toBe(false);
  });
});
describe("Taiwan scheduling", () => {
  it("handles midnight and exact expiry without using host timezone", () => {
    expect(taiwanDate(new Date("2026-11-03T16:00:00Z"))).toBe("2026-11-04");
    const item = {
      startsAt: "2026-11-04T09:00:00+08:00",
      endsAt: "2026-11-04T10:00:00+08:00",
    };
    expect(isActive(item, new Date("2026-11-04T01:00:00Z"))).toBe(true);
    expect(isActive(item, new Date("2026-11-04T02:00:00Z"))).toBe(false);
    expect(validDate("2026-02-30")).toBe(false);
  });
});

describe("screen pairing origin", () => {
  it("allows a screen using the NAS IP while retaining strict admin origin checks", () => {
    vi.stubEnv("APP_ORIGIN", "http://tititamusic:3002");
    const make = (origin: string, host = "192.168.31.100:3002") =>
      new Request("http://localhost:3002/api/pair", {
        method: "POST",
        headers: { origin, host },
      });
    const screen = make("http://192.168.31.100:3002");
    expect(() => requireScreenSameOrigin(screen)).not.toThrow();
    expect(() => requireSameOrigin(screen)).toThrow("無效的請求來源");
    expect(() => requireScreenSameOrigin(make("http://evil.example"))).toThrow(
      "無效的請求來源",
    );
    expect(() =>
      requireScreenSameOrigin(make("https://192.168.31.100:3002")),
    ).toThrow("無效的請求來源");
    expect(() =>
      requireScreenSameOrigin(
        new Request("http://localhost:3002/api/pair", { method: "POST" }),
      ),
    ).toThrow("無效的請求來源");
  });
});
